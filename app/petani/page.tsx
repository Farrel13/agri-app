export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredImages } from "@/lib/cleanup";
import PetaniClient from "./PetaniClient";

export default async function DashboardPetani() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "PETANI") {
    redirect("/");
  }

  // Bersihkan produk/foto yang sudah kadaluarsa (> 24 jam)
  await cleanupExpiredImages();

  // Ambil data produk petani beserta data Hub yang memverifikasi dan riwayat penjualan
  const rawProducts = await prisma.product.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      verifiedBy: {
        select: { id: true, name: true, username: true },
      },
      orderItems: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Hitung ringkasan finansial dan penjualan
  let totalRevenue = 0;
  let totalSoldUnits = 0;
  let verifiedCount = 0;

  const products = rawProducts.map((p) => {
    if (p.isVerified) verifiedCount++;

    // Hitung berapa unit produk ini yang sudah terjual dalam order yang aktif/selesai
    let productSoldQty = 0;
    let productEarned = 0;

    for (const item of p.orderItems) {
      if (item.order && item.order.status !== "DIBATALKAN") {
        productSoldQty += item.quantity;
        productEarned += item.quantity * p.priceFarmer;
      }
    }

    totalSoldUnits += productSoldQty;
    totalRevenue += productEarned;

    const avgRating =
      p.reviews.length > 0
        ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length
        : null;

    return {
      ...p,
      soldQuantity: productSoldQty,
      totalEarned: productEarned,
      averageRating: avgRating,
    };
  });

  const stats = {
    totalProducts: products.length,
    verifiedCount,
    totalSoldUnits,
    totalRevenue,
  };

  return <PetaniClient products={products} stats={stats} />;
}
