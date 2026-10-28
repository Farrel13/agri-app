"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import path from "path";

// Restoran mengonfirmasi barang diterima & upload foto bukti penerimaan (berlaku 24 jam)
export async function completeOrderAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const orderId = formData.get("orderId") as string;
    const notes = (formData.get("notes") as string)?.trim() || "Barang diterima dengan baik.";
    const file = formData.get("image") as File | null;

    if (!orderId) {
      return { success: false, message: "ID Pesanan tidak valid." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.buyerId !== session.user.id) {
      return { success: false, message: "Pesanan tidak ditemukan." };
    }

    let receivedImageUrl: string | null = null;
    let receivedImageExpiresAt: Date | null = null;

    if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name) || ".jpg";
      const filename = `receive-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
      const filePath = path.join(process.cwd(), "public", "uploads", filename);

      await writeFile(filePath, buffer);
      receivedImageUrl = `/uploads/${filename}`;
      // Berlaku 24 jam saja
      receivedImageExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Ubah status pesanan menjadi SELESAI
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "SELESAI",
        receivedAt: new Date(),
        receivedNotes: notes,
        receivedImageUrl,
        receivedImageExpiresAt,
      },
    });

    // Kirim notifikasi ke Hub pedagang bahwa barang sudah sampai dan diterima
    await prisma.notification.create({
      data: {
        userId: order.hubId,
        title: "Pesanan Diterima & Selesai! 🎉",
        message: `Restoran ${session.user.name} telah menerima dan menyelesaikan pesanan #${order.orderNumber}.`,
        type: "STATUS_PESANAN",
        linkUrl: "/hub/pesanan",
      },
    });

    revalidatePath("/restoran/pesanan");
    revalidatePath("/hub/pesanan");
    return { success: true, message: "Penerimaan barang berhasil dikonfirmasi! Pesanan Selesai." };
  } catch (error) {
    console.error("Gagal menyelesaikan pesanan:", error);
    return { success: false, message: "Gagal memproses penyelesaian pesanan." };
  }
}

// Action untuk Restoran memberi rating & review produk
export async function createProductReviewAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const productId = formData.get("productId") as string;
    const rating = Number(formData.get("rating"));
    const comment = (formData.get("comment") as string)?.trim() || "";

    if (!productId || isNaN(rating) || rating < 1 || rating > 5) {
      return { success: false, message: "Rating harus antara 1-5 bintang." };
    }

    await prisma.review.create({
      data: {
        userId: session.user.id,
        productId,
        rating,
        comment,
      },
    });

    revalidatePath("/restoran/pesanan");
    revalidatePath("/restoran");
    return { success: true, message: "Terima kasih atas ulasan kesegaran bahan panen!" };
  } catch (error) {
    console.error("Error review:", error);
    return { success: false, message: "Gagal mengirim ulasan." };
  }
}
