"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export async function updateOrderStatusAction(orderId: string, status: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true },
    });

    if (!order || order.hubId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan atau bukan milik tokomu." };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    // Buat notifikasi otomatis ke Restoran pembeli
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        title: `Status Pesanan Diperbarui (${status})`,
        message: `Pesanan #${order.orderNumber} kamu kini berstatus: ${status}.`,
        type: "STATUS_PESANAN",
        linkUrl: "/restoran/pesanan",
      },
    });

    revalidatePath("/hub/pesanan");
    revalidatePath("/restoran/pesanan");
    return { success: true, message: `Status pesanan #${order.orderNumber} berhasil diubah ke ${status}.` };
  } catch (error) {
    console.error("Gagal update status pesanan:", error);
    return { success: false, message: "Gagal memperbarui status pesanan." };
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
      include: { payment: true },
    });

    if (!order || order.hubId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan." };
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

    revalidatePath("/hub/pesanan");
    return { success: true, message: "Pembayaran telah diverifikasi LUNAS!" };
  } catch (error) {
    console.error("Gagal verifikasi payment:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}
