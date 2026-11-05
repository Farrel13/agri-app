"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { checkServerActionRateLimit } from "@/lib/rate-limit";
import { Address } from "@prisma/client";

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface PlaceOrderPayload {
  items: CartItemInput[];
  addressId?: string;
  notes?: string;
  paymentMethod?: "QRIS" | "TRANSFER_BANK" | "E_WALLET" | "COD";
}

export interface PlaceOrderResult {
  success: boolean;
  message: string;
  orderNumbers?: string[];
}

export interface SimulatePaymentResult {
  success: boolean;
  message: string;
}

export interface AddAddressResult {
  success: boolean;
  message: string;
  address?: Address;
}

// 1. Checkout dengan Split Order otomatis per Toko Hub
export async function placeOrderAction(payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    // Rate limiting: cegah spam checkout / order (maks 10 per menit)
    const rateCheck = await checkServerActionRateLimit("place_order", session.user.id, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const { items, addressId, notes, paymentMethod = "QRIS" } = payload;

    if (!items || items.length === 0) {
      return { success: false, message: "Keranjang belanja kosong." };
    }

    // Ambil atau buat alamat pengiriman jika belum ada
    let finalAddressId = addressId;
    if (!finalAddressId) {
      const primaryAddress = await prisma.address.findFirst({
        where: { userId: session.user.id },
        orderBy: { isPrimary: "desc" },
      });

      if (primaryAddress) {
        finalAddressId = primaryAddress.id;
      } else {
        const newAddress = await prisma.address.create({
          data: {
            label: "Dapur Restoran Utama",
            recipientName: session.user.name || "Restoran",
            phoneNumber: "081234567890",
            street: "Jl. Dapur Sejahtera No. 12",
            city: "Jakarta",
            province: "DKI Jakarta",
            postalCode: "12000",
            isPrimary: true,
            userId: session.user.id,
          },
        });
        finalAddressId = newAddress.id;
      }
    }

    // Ambil detail seluruh produk dalam keranjang
    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Kelompokkan item berdasarkan Hub pemilik produk (Multi-Vendor Split Order)
    const itemsByHub = new Map<string, { product: typeof dbProducts[0]; quantity: number }[]>();

    const defaultHub = await prisma.user.findFirst({ where: { role: "HUB" } });

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("Satu atau lebih produk tidak ditemukan.");
      }
      if (product.stock < item.quantity) {
        throw new Error(`Stok untuk "${product.name}" tidak mencukupi (tersisa ${product.stock} ${product.unit}).`);
      }

      const hubId = product.verifiedById || defaultHub?.id;
      if (!hubId) {
        throw new Error(`Produk "${product.name}" belum memiliki toko Hub yang ditunjuk.`);
      }

      if (!itemsByHub.has(hubId)) {
        itemsByHub.set(hubId, []);
      }
      itemsByHub.get(hubId)!.push({ product, quantity: item.quantity });
    }

    const createdOrderNumbers: string[] = [];

    // Eksekusi transaksi database: Buat pesanan per Hub secara independen
    await prisma.$transaction(async (tx) => {
      let hubIndex = 1;

      for (const [hubId, hubItems] of itemsByHub.entries()) {
        const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}${itemsByHub.size > 1 ? `-${hubIndex++}` : ""}`;
        const deliveryFee = 15000; // Ongkir per hub
        let totalAmount = 0;
        const orderItemsData = [];

        for (const { product, quantity } of hubItems) {
          const price = product.priceHub || product.priceFarmer;
          const subtotal = price * quantity;
          totalAmount += subtotal;

          // Kurangi stok produk secara atomik
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: quantity } },
          });

          orderItemsData.push({
            productId: product.id,
            quantity: quantity,
            pricePerUnit: price,
            subtotal: subtotal,
          });
        }

        const finalAmount = totalAmount + deliveryFee;

        // Buat Order dalam status MENUNGGU_PEMBAYARAN
        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId: session.user.id,
            hubId: hubId,
            addressId: finalAddressId,
            totalAmount,
            deliveryFee,
            finalAmount,
            status: "MENUNGGU_PEMBAYARAN",
            notes: notes || "Pesanan bahan baku restoran segar.",
            items: {
              create: orderItemsData,
            },
            payment: {
              create: {
                amount: finalAmount,
                method: paymentMethod,
                status: "PENDING",
              },
            },
          },
        });

        // Kirim notifikasi ke Hub
        await tx.notification.create({
          data: {
            userId: hubId,
            title: `Pesanan Baru #${orderNumber} Masuk 📦`,
            message: `Restoran ${session.user.name} membuat pesanan baru senilai Rp ${finalAmount.toLocaleString("id-ID")} (Menunggu Pembayaran).`,
            type: "PESANAN_BARU",
            linkUrl: "/hub/pesanan",
          },
        });

        createdOrderNumbers.push(orderNumber);
      }
    });

    revalidatePath("/restoran");
    revalidatePath("/restoran/pesanan");
    revalidatePath("/hub/pesanan");

    const message =
      createdOrderNumbers.length > 1
        ? `Berhasil membuat ${createdOrderNumbers.length} pesanan terpisah untuk masing-masing Toko Hub: ${createdOrderNumbers.join(", ")}.`
        : `Pesanan #${createdOrderNumbers[0]} berhasil dibuat! Silakan selesaikan pembayaran.`;

    return {
      success: true,
      message,
      orderNumbers: createdOrderNumbers,
    };
  } catch (error) {
    console.error("Gagal membuat pesanan:", error);
    const errorMessage = error instanceof Error ? error.message : "Gagal memproses pesanan.";
    return { success: false, message: errorMessage };
  }
}

// 2. Simulasi Payment Gateway (Mudah diganti ke Webhook Midtrans / Xendit saat Go-Live)
export async function simulatePaymentAction(
  orderId: string,
  method: "QRIS" | "TRANSFER_BANK" | "E_WALLET"
): Promise<SimulatePaymentResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    // Rate limiting: cegah spam stimulasi pembayaran (maks 10 per menit)
    const rateCheck = await checkServerActionRateLimit("simulate_payment", session.user.id, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, hub: true },
    });

    if (!order || order.buyerId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan." };
    }

    // Update status pembayaran menjadi LUNAS dan pesanan menjadi DIPROSES_HUB
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        status: "LUNAS",
        method: method,
        paidAt: new Date(),
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "DIPROSES_HUB",
      },
    });

    // Kirim notifikasi ke Hub
    await prisma.notification.create({
      data: {
        userId: order.hubId,
        title: "Pembayaran Diterima! Siap Diproses 💰",
        message: `Pembayaran pesanan #${order.orderNumber} dari ${session.user.name} telah LUNAS via ${method}. Mohon siapkan barang.`,
        type: "PESANAN_BARU",
        linkUrl: "/hub/pesanan",
      },
    });

    revalidatePath("/restoran/pesanan");
    revalidatePath("/hub/pesanan");

    return {
      success: true,
      message: `Pembayaran pesanan #${order.orderNumber} sebesar Rp ${order.finalAmount.toLocaleString("id-ID")} berhasil diverifikasi! Pesanan kini sedang diproses oleh Hub.`,
    };
  } catch (error) {
    console.error("Gagal simulasi pembayaran:", error);
    return { success: false, message: "Gagal memproses simulasi pembayaran." };
  }
}

// 3. Tambah Alamat Baru untuk Restoran
export async function addRestaurantAddressAction(formData: FormData): Promise<AddAddressResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    // Rate limiting: cegah spam penambahan alamat (maks 10 per menit)
    const rateCheck = await checkServerActionRateLimit("add_address", session.user.id, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const label = (formData.get("label") as string)?.trim() || "Dapur Cabang";
    const recipientName = (formData.get("recipientName") as string)?.trim() || session.user.name || "Restoran";
    const phoneNumber = (formData.get("phoneNumber") as string)?.trim() || "081234567890";
    const street = (formData.get("street") as string)?.trim();
    const city = (formData.get("city") as string)?.trim();
    const province = (formData.get("province") as string)?.trim() || "DKI Jakarta";
    const postalCode = (formData.get("postalCode") as string)?.trim() || null;

    if (!street || !city) {
      return { success: false, message: "Jalan dan kota wajib diisi." };
    }

    const address = await prisma.address.create({
      data: {
        label,
        recipientName,
        phoneNumber,
        street,
        city,
        province,
        postalCode,
        isPrimary: false,
        userId: session.user.id,
      },
    });

    revalidatePath("/restoran");
    return { success: true, message: "Alamat baru berhasil ditambahkan!", address };
  } catch (error) {
    console.error("Gagal menambah alamat:", error);
    return { success: false, message: "Terjadi kesalahan saat menambah alamat." };
  }
}
