export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredImages } from "@/lib/cleanup";
import { ensureHubOwnership } from "@/lib/hubSync";
import HubClient from "./HubClient";

export default async function DashboardHub() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "HUB") {
    redirect("/");
  }

  // 1. Bersihkan foto expired 24 jam & sinkronkan kepemilikan data lama
  await cleanupExpiredImages();
  await ensureHubOwnership();

  // 2. Ambil antrean panen masuk per hari dari petani (belum diverifikasi)
  const unverifiedProducts = await prisma.product.findMany({
    where: { isVerified: false },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 3. Ambil etalase toko milik Hub yang sedang login ini
  const myStoreProducts = await prisma.product.findMany({
    where: {
      isVerified: true,
      verifiedById: session.user.id,
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

  return (
    <HubClient
      unverifiedProducts={unverifiedProducts}
      myStoreProducts={myStoreProducts}
      hubUser={{
        id: session.user.id,
        name: session.user.name || "Pedagang",
      }}
    />
  );
}
