import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

/**
 * Membersihkan data yang sudah kadaluarsa melewati batas 24 jam:
 * 2. Membersihkan foto bukti penerimaan barang Order (> 24 jam).
 */
export async function cleanupExpiredImages() {
  try {
    const now = new Date();

    // 1. Cari produk hasil panen yang sudah kadaluarsa (> 24 jam)
    const expiredProducts = await prisma.product.findMany({
      where: {
        imageExpiresAt: { lte: now },
      },
      include: {
        orderItems: true,
      },
    });

    const idsToDelete: string[] = [];
    const idsToArchive: string[] = [];

    for (const item of expiredProducts) {
      // Hapus file fisik di public/uploads jika ada
      if (item.imageUrl && item.imageUrl.startsWith("/uploads/")) {
        const filename = item.imageUrl.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "public", "uploads", filename);
        try {
          await unlink(filePath);
        } catch {}
      }

      // Jika belum ada riwayat order, hapus card sepenuhnya dari database
      if (!item.orderItems || item.orderItems.length === 0) {
        idsToDelete.push(item.id);
      } else {
        // Jika sudah ada riwayat order, hapus foto dan arsipkan stok agar foreign key tidak error
        idsToArchive.push(item.id);
      }
    }

    // Hapus card produk yang sudah kadaluarsa
    if (idsToDelete.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    // Kosongkan foto dan arsipkan produk yang memiliki riwayat transaksi
    if (idsToArchive.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: idsToArchive } },
        data: { imageUrl: null, imageExpiresAt: null, stock: 0 },
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
    console.error("Gagal menjalankan pembersihan data expired (>24 jam):", error);
  }
}
