export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredImages } from "@/lib/cleanup";
import TokoClient from "./TokoClient";

interface PageProps {
  params: Promise<{ hubId: string }>;
}

export default async function HalamanTokoHub({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "RESTAURANT") {
    redirect("/");
  }

  const { hubId } = await params;

  // Bersihkan foto expired 24 jam
  await cleanupExpiredImages();

  // Cari data toko pedagang (Hub)
  const hubUser = await prisma.user.findUnique({
    where: { id: hubId, role: "HUB" },
    select: { id: true, name: true, username: true },
  });

  if (!hubUser) {
    notFound();
  }

  // Ambil semua produk yang diverifikasi dan dijual oleh toko Hub ini
  const products = await prisma.product.findMany({
    where: {
      verifiedById: hubId,
      isVerified: true,
      stock: { gt: 0 },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return <TokoClient hubUser={hubUser} products={products} />;
}
