"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { validateImageBuffer } from "@/lib/file-validator";
import { checkServerActionRateLimit } from "@/lib/rate-limit";

// Restoran mengonfirmasi barang diterima & upload foto bukti penerimaan (berlaku 24 jam)
export async function completeOrderAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    // Rate limiting: batasi konfirmasi penerimaan pesanan
    const rateCheck = await checkServerActionRateLimit("complete_order", session.user.id, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
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
      const validation = validateImageBuffer(buffer, 3 * 1024 * 1024);
      if (!validation.isValid) {
        return { success: false, message: validation.error || "Berkas gambar ditolak." };
      }

      const mimeType =
        validation.detectedType === "png"
          ? "image/png"
          : validation.detectedType === "webp"
          ? "image/webp"
          : "image/jpeg";
      receivedImageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
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

    // Rate limiting: cegah spam ulasan (maks 5 review per menit)
    const rateCheck = await checkServerActionRateLimit("create_review", session.user.id, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const productId = formData.get("productId") as string;
    const rating = Math.floor(Number(formData.get("rating")));
    const comment = (formData.get("comment") as string)?.trim().slice(0, 500) || "";

    if (!productId || isNaN(rating) || rating < 1 || rating > 5) {
      return { success: false, message: "Rating harus antara 1-5 bintang." };
    }

    // 1. Verifikasi Transaksi: Hanya boleh mereview produk yang sudah pernah dibeli dan berstatus SELESAI
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          buyerId: session.user.id,
          status: "SELESAI",
        },
      },
    });

    if (!hasPurchased) {
      return {
        success: false,
        message: "Anda hanya dapat memberikan ulasan untuk produk yang sudah pernah Anda beli dan terima (pesanan SELESAI).",
      };
    }

    // 2. Cegah spam / ulasan ganda untuk produk yang sama oleh user yang sama
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: session.user.id,
        productId,
      },
    });

    if (existingReview) {
      return {
        success: false,
        message: "Anda sudah pernah memberikan ulasan untuk produk ini.",
      };
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
