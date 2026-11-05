export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RestoranClient from "./RestoranClient";
import { ensureHubOwnership } from "@/lib/hubSync";
import { cleanupExpiredImages } from "@/lib/cleanup";

export default async function DashboardRestoran() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "RESTAURANT") {
    redirect("/");
  }

  // Bersihkan produk kadaluarsa (> 24 jam)
  await cleanupExpiredImages();

  // Sinkronkan kepemilikan produk lama jika ada
  await ensureHubOwnership();

  // Ambil produk yang sudah diverifikasi oleh Hub dan stoknya masih > 0
  const rawCatalog = await prisma.product.findMany({
    where: {
      isVerified: true,
      stock: { gt: 0 },
    },
    include: {
      user: {
        select: { id: true, name: true }, // Asal Petani
      },
      verifiedBy: {
        select: { id: true, name: true }, // Toko Pedagang (Hub)
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const catalog = rawCatalog.map((p) => {
    const avgRating =
      p.reviews.length > 0
        ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
        : null;
    return {
      ...p,
      averageRating: avgRating,
      reviewCount: p.reviews.length,
    };
  });

  // Ambil daftar alamat milik Restoran ini
  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: { isPrimary: "desc" },
  });

  return <RestoranClient products={catalog} userAddresses={addresses} />;
}
