export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RestoranClient from "./RestoranClient";
import { cleanupExpiredImages } from "@/lib/cleanup";
import { ensureHubOwnership } from "@/lib/hubSync";

export default async function DashboardRestoran() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "RESTAURANT") {
    redirect("/");
  }

  // 1. Bersihkan foto yang sudah melewati batas 24 jam & sinkronkan kepemilikan produk lama
  await cleanupExpiredImages();
  await ensureHubOwnership();

  // 2. Ambil produk yang sudah diverifikasi oleh Hub dan stoknya masih > 0
  const catalog = await prisma.product.findMany({
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
    },
    orderBy: { updatedAt: "desc" },
  });

  return <RestoranClient products={catalog} />;
}
