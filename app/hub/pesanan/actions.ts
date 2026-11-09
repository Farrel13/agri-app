"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";
import { checkServerActionRateLimit } from "@/lib/rate-limit";

// Matriks Transisi Status yang Sah (State Machine)
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  MENUNGGU_PEMBAYARAN: [OrderStatus.DIPROSES_HUB, OrderStatus.DIBATALKAN],
  DIPROSES_HUB: [OrderStatus.DIKIRIM, OrderStatus.DIBATALKAN],
  DIKIRIM: [OrderStatus.SELESAI],
  SELESAI: [], // Status final
  DIBATALKAN: [], // Status final
};

export async function updateOrderStatusAction(orderId: string, status: OrderStatus | string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("update_order_status", session.user.id, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const targetStatus = status as OrderStatus;
    if (!Object.values(OrderStatus).includes(targetStatus)) {
      return { success: false, message: "Pilihan status pesanan tidak valid." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true, items: true },
    });

    if (!order || order.hubId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan atau bukan milik tokomu." };
    }

    // Validasi alur transisi status pesanan (Cegah bypass alur pemesanan)
    const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      return {
        success: false,
        message: `Status pesanan tidak dapat diubah dari "${order.status}" menjadi "${targetStatus}".`,
      };
    }

    // Jika pesanan dibatalkan, kembalikan stok produk secara otomatis
    if (targetStatus === OrderStatus.DIBATALKAN) {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await tx.order.update({
          where: { id: orderId },
          data: { status: targetStatus },
        });
      });
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: targetStatus },
      });
    }

    // Buat notifikasi otomatis ke Restoran pembeli
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        title: `Status Pesanan Diperbarui (${targetStatus})`,
        message: `Pesanan #${order.orderNumber} kamu kini berstatus: ${targetStatus}.`,
        type: "STATUS_PESANAN",
        linkUrl: "/restoran/pesanan",
      },
    });

    revalidatePath("/hub/pesanan");
    revalidatePath("/restoran/pesanan");
    return { success: true, message: `Status pesanan #${order.orderNumber} berhasil diubah ke ${targetStatus}.` };
  } catch (error) {
    console.error("Gagal update status pesanan:", error);
    return { success: false, message: "Gagal memperbarui status pesanan." };
  }
}

// Pengiriman Pesanan lengkap dengan detail logistik & kurir
export async function dispatchOrderAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const orderId = formData.get("orderId") as string;
    const courierName = (formData.get("courierName") as string)?.trim() || "Kurir Toko Hub";
    const courierPhone = (formData.get("courierPhone") as string)?.trim() || "-";
    const vehicleNumber = (formData.get("vehicleNumber") as string)?.trim() || "-";
    const estimatedArrival = (formData.get("estimatedArrival") as string)?.trim() || "~45 Menit";

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true },
    });

    if (!order || order.hubId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan." };
    }

    // Hanya izinkan pengiriman jika barang sudah berstatus DIPROSES_HUB
    if (order.status !== "DIPROSES_HUB") {
      return {
        success: false,
        message: `Hanya pesanan yang sedang diproses (DIPROSES_HUB) yang dapat dikirim. Status saat ini: "${order.status}".`,
      };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "DIKIRIM",
        courierName,
        courierPhone,
        vehicleNumber,
        estimatedArrival,
      },
    });

    // Buat notifikasi pengiriman ke Restoran
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        title: `Pesanan #${order.orderNumber} Sedang Diantar 🚚`,
        message: `Bahan pesananmu sedang dikirim oleh ${courierName} (Plat: ${vehicleNumber}). Estimasi tiba: ${estimatedArrival}.`,
        type: "STATUS_PESANAN",
        linkUrl: "/restoran/pesanan",
      },
    });

    revalidatePath("/hub/pesanan");
    revalidatePath("/restoran/pesanan");
    return { success: true, message: `Pesanan #${order.orderNumber} berhasil diberangkatkan bersama kurir!` };
  } catch (error) {
    console.error("Gagal mengirim pesanan:", error);
    return { success: false, message: "Gagal memproses pengiriman pesanan." };
  }
}

export async function verifyOrderPaymentAction(orderId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, buyer: true },
    });

    if (!order || order.hubId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan." };
    }

    // Hanya izinkan verifikasi jika status masih MENUNGGU_PEMBAYARAN
    if (order.status !== "MENUNGGU_PEMBAYARAN" || order.payment?.status === "LUNAS") {
      return {
        success: false,
        message: "Pesanan ini sudah tidak dalam status menunggu verifikasi pembayaran.",
      };
    }

    await prisma.payment.update({
      where: { orderId },
      data: {
        status: "LUNAS",
        paidAt: new Date(),
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "DIPROSES_HUB" },
    });

    // Notif ke Restoran
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        title: "Pembayaran Diverifikasi Lunas 💰",
        message: `Pembayaran pesanan #${order.orderNumber} telah diverifikasi oleh Toko Hub dan kini sedang dipersiapkan.`,
        type: "STATUS_PESANAN",
        linkUrl: "/restoran/pesanan",
      },
    });

    revalidatePath("/hub/pesanan");
    revalidatePath("/restoran/pesanan");
    return { success: true, message: "Pembayaran telah diverifikasi LUNAS! Pesanan masuk antrean pengemasan." };
  } catch (error) {
    console.error("Gagal verifikasi payment:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}
