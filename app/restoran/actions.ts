"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export async function placeOrderAction(items: CartItemInput[]) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    if (!items || items.length === 0) {
      return { success: false, message: "Keranjang belanja kosong." };
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const deliveryFee = 15000;

    // Ambil produk dan data Hub penjual
    const firstItem = await prisma.product.findUnique({
      where: { id: items[0].productId },
      select: { verifiedById: true },
    });

    // Cari Hub fallback jika produk belum memiliki verifiedById
    let hubId = firstItem?.verifiedById;
    if (!hubId) {
      const defaultHub = await prisma.user.findFirst({ where: { role: "HUB" } });
      hubId = defaultHub?.id || session.user.id;
    }

    // Cari atau buat default Address untuk Restoran
    let address = await prisma.address.findFirst({
      where: { userId: session.user.id },
    });

    if (!address) {
      address = await prisma.address.create({
        data: {
          label: "Dapur Restoran Utama",
          recipientName: session.user.name || "Restoran",
          phoneNumber: "08123456789",
          street: "Jl. Dapur Sejahtera No. 12",
          city: "Jakarta",
          province: "DKI Jakarta",
          postalCode: "12000",
          isPrimary: true,
          userId: session.user.id,
        },
      });
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || product.stock < item.quantity) {
          throw new Error(`Stok untuk ${product?.name || "produk"} tidak mencukupi.`);
        }

        const price = product.priceHub || product.priceFarmer;
        const subtotal = price * item.quantity;
        totalAmount += subtotal;

        // Kurangi stok produk secara atomik
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          pricePerUnit: price,
          subtotal: subtotal,
        });
      }

      const finalAmount = totalAmount + deliveryFee;

      // Otomatisasi Aliran:
      // Uang langsung lunas -> status langsung DIKIRIM (tanpa perlu tunggu persetujuan)
      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId: session.user.id,
          hubId: hubId!,
          addressId: address?.id,
          totalAmount,
          deliveryFee,
          finalAmount,
          status: "DIKIRIM", // Langsung diproses & dikirim otomatis!
          notes: "Estimasi pengantaran Hub: ~1-2 Jam ke Restoran.",
          items: {
            create: orderItemsData,
          },
          payment: {
            create: {
              amount: finalAmount,
              method: "TRANSFER_BANK",
              status: "LUNAS", // Uang langsung masuk & lunas
              paidAt: new Date(),
            },
          },
        },
      });

      // Buat notifikasi otomatis ke Hub & Restoran
      await tx.notification.create({
        data: {
          userId: hubId!,
          title: "Pesanan Baru Langsung Dikirim 🚚",
          message: `Pesanan #${orderNumber} dari ${session.user.name} telah lunas dan sedang dalam perjalanan pengiriman!`,
          type: "PESANAN_BARU",
          linkUrl: "/hub/pesanan",
        },
      });

      return order;
    });

    revalidatePath("/restoran");
    revalidatePath("/restoran/pesanan");
    revalidatePath("/hub/pesanan");

    return {
      success: true,
      message: `Pesanan #${createdOrder.orderNumber} berhasil dibuat! Pembayaran Lunas & pesanan langsung dikirim.`,
    };
  } catch (error) {
    console.error("Gagal membuat pesanan:", error);
    const errorMessage = error instanceof Error ? error.message : "Gagal memproses pesanan.";
    return { success: false, message: errorMessage };
  }
}
