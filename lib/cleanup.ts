import { prisma } from "@/lib/prisma";

export interface CleanupResult {
  deletedProducts: number;
  archivedProducts: number;
  cleanedOrders: number;
}

/**
 * Membersihkan data yang kadaluarsa:
 * 1. Etalase harian Toko Hub (> 24 jam) di-reset verifikasinya agar katalog restoran selalu segar harian,
 *    tanpa menghapus data panen asli milik Petani.
 * 2. Foto bukti penerimaan barang Order (> 24 jam) dikosongkan dari basis data untuk mencegah pembengkakan storage.
 *
 * Catatan Arsitektur:
 * - Panen petani tidak lagi dihapus harian, melainkan hidup berdasarkan stok hasil panen.
 * - Menerapkan batching/pagination (parameter batchSize) untuk mencegah runtime timeout di Vercel Serverless.
 */
export async function cleanupExpiredImages(batchSize = 50): Promise<CleanupResult> {
  try {
    const now = new Date();

    // 1. Ambil produk etalase Toko Hub yang sudah kadaluarsa harian (> 24 jam)
    const expiredHubProducts = await prisma.product.findMany({
      where: {
        isVerified: true,
        imageExpiresAt: { lte: now },
      },
      select: { id: true },
      take: batchSize,
    });

    let resetHubCount = 0;
    if (expiredHubProducts.length > 0) {
      const hubProductIds = expiredHubProducts.map((p) => p.id);
      // Reset etalase Toko Hub: produk turun dari etalase restoran, tetapi data panen petani tetap aman & utuh
      await prisma.product.updateMany({
        where: { id: { in: hubProductIds } },
        data: {
          isVerified: false,
          verifiedById: null,
          priceHub: null,
          imageExpiresAt: null,
        },
      });
      resetHubCount = hubProductIds.length;
    }

    // 2. Normalisasi data panen petani terdahulu (jika ada sisa imageExpiresAt lama, bersihkan agar tidak terhapus)
    await prisma.product.updateMany({
      where: {
        isVerified: false,
        imageExpiresAt: { not: null },
      },
      data: {
        imageExpiresAt: null,
      },
    });

    // 3. Bersihkan bukti penerimaan pesanan kadaluarsa (> 24 jam)
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
      deletedProducts: 0,
      archivedProducts: resetHubCount,
      cleanedOrders: expiredOrders.length,
    };
  } catch (error) {
    console.error("Gagal menjalankan pembersihan data expired:", error);
    throw error;
  }
}
