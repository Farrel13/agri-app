import { prisma } from "@/lib/prisma";

export async function ensureHubOwnership() {
  try {
    // Cari akun HUB pertama sebagai fallback jika ada produk terverifikasi lama tanpa verifiedById
    const defaultHub = await prisma.user.findFirst({
      where: { role: "HUB" },
    });

    if (defaultHub) {
      await prisma.product.updateMany({
        where: {
          isVerified: true,
          verifiedById: null,
        },
        data: {
          verifiedById: defaultHub.id,
        },
      });
    }
  } catch (err) {
    console.error("Gagal sinkronkan kepemilikan hub:", err);
  }
}
