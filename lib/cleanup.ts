import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

/**
 * Membersihkan file foto yang umurnya sudah melewati batas 24 jam.
 * 1. Foto panen Product (imageUrl & imageExpiresAt)
 * 2. Foto bukti penerimaan barang Order (receivedImageUrl & receivedImageExpiresAt)
 */
export async function cleanupExpiredImages() {
  try {
    const now = new Date();

    // 1. Bersihkan foto produk hasil panen expired
    const expiredProducts = await prisma.product.findMany({
      where: {
        imageUrl: { not: null },
        imageExpiresAt: { lte: now },
      },
      select: { id: true, imageUrl: true },
    });

    for (const item of expiredProducts) {
      if (item.imageUrl && item.imageUrl.startsWith("/uploads/")) {
        const filename = item.imageUrl.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "public", "uploads", filename);
        try {
          await unlink(filePath);
        } catch {}
      }
    }

    if (expiredProducts.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: expiredProducts.map((p) => p.id) } },
        data: { imageUrl: null, imageExpiresAt: null },
      });
    }

    // 2. Bersihkan foto bukti penerimaan pesanan restoran yang sudah > 24 jam
    const expiredOrders = await prisma.order.findMany({
      where: {
        receivedImageUrl: { not: null },
        receivedImageExpiresAt: { lte: now },
      },
      select: { id: true, receivedImageUrl: true },
    });

    for (const ord of expiredOrders) {
      if (ord.receivedImageUrl && ord.receivedImageUrl.startsWith("/uploads/")) {
        const filename = ord.receivedImageUrl.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "public", "uploads", filename);
        try {
          await unlink(filePath);
        } catch {}
      }
    }

    if (expiredOrders.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: expiredOrders.map((o) => o.id) } },
        data: { receivedImageUrl: null, receivedImageExpiresAt: null },
      });
    }
  } catch (error) {
    console.error("Gagal membersihkan foto expired:", error);
  }
}
