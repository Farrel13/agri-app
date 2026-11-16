import { prisma } from "@/lib/prisma";

export interface CleanupResult {
  deletedProducts: number;
  archivedProducts: number;
  cleanedOrders: number;
}

/**
 * Membersihkan data yang sudah kadaluarsa melewati batas 24 jam:
 * 1. Produk panen tanpa pesanan dihapus; produk panen dengan riwayat pesanan diarsipkan & foto dikosongkan.
 * 2. Foto bukti penerimaan barang Order (> 24 jam) dikosongkan dari basis data.
 *
 * Catatan Arsitektur:
 * - Tidak menggunakan fs/promises lokal karena Vercel Serverless memiliki ephemeral filesystem.
 * - Menerapkan batching/pagination (parameter batchSize) untuk mencegah runtime timeout.
 */
export async function cleanupExpiredImages(batchSize = 50): Promise<CleanupResult> {
  try {
    const now = new Date();

    // 1. Ambil produk panen kadaluarsa secara terbatas (batching)
    const expiredProducts = await prisma.product.findMany({
      where: {
        imageExpiresAt: { lte: now },
      },
      include: {
        orderItems: { select: { id: true }, take: 1 },
      },
      take: batchSize,
    });

    const idsToDelete: string[] = [];
    const idsToArchive: string[] = [];

    for (const item of expiredProducts) {
      if (!item.orderItems || item.orderItems.length === 0) {
        idsToDelete.push(item.id);
      } else {
        idsToArchive.push(item.id);
      }
    }

    if (idsToDelete.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    if (idsToArchive.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: idsToArchive } },
        data: { imageUrl: null, imageExpiresAt: null, stock: 0 },
      });
    }

    // 2. Bersihkan bukti penerimaan pesanan kadaluarsa (> 24 jam)
    const expiredOrders = await prisma.order.findMany({
      where: {
        receivedImageUrl: { not: null },
        receivedImageExpiresAt: { lte: now },
      },
      select: { id: true },
      take: batchSize,
    });

    if (expiredOrders.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: expiredOrders.map((o) => o.id) } },
        data: { receivedImageUrl: null, receivedImageExpiresAt: null },
      });
    }

    return {
      deletedProducts: idsToDelete.length,
      archivedProducts: idsToArchive.length,
      cleanedOrders: expiredOrders.length,
    };
  } catch (error) {
    console.error("Gagal menjalankan pembersihan data expired (>24 jam):", error);
    throw error;
  }
}
