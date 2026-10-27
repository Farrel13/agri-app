import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

/**
 * Membersihkan foto produk yang umurnya sudah melewati batas 24 jam.
 * - Menghapus file fisik di public/uploads
 * - Mengosongkan imageUrl & imageExpiresAt di tabel database Product
 */
export async function cleanupExpiredImages() {
  try {
    const now = new Date();

    // 1. Cari semua produk yang gambar expired-nya <= waktu sekarang
    const expiredProducts = await prisma.product.findMany({
      where: {
        imageUrl: { not: null },
        imageExpiresAt: { lte: now },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (expiredProducts.length === 0) return;

    // 2. Hapus file fisik gambar dari disk storage
    for (const item of expiredProducts) {
      if (item.imageUrl && item.imageUrl.startsWith("/uploads/")) {
        const filename = item.imageUrl.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "public", "uploads", filename);
        try {
          await unlink(filePath);
        } catch {
          // Abaikan jika file fisik sudah tidak ada
        }
      }
    }

    // 3. Bersihkan record di database agar imageUrl & imageExpiresAt kembali null
    const expiredIds = expiredProducts.map((p) => p.id);
    await prisma.product.updateMany({
      where: { id: { in: expiredIds } },
      data: {
        imageUrl: null,
        imageExpiresAt: null,
      },
    });
  } catch (error) {
    console.error("Gagal membersihkan foto expired:", error);
  }
}
