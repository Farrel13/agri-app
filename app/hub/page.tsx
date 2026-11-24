export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HubClient from "./HubClient";

export default async function DashboardHub() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "HUB") {
    redirect("/");
  }

  // Ambil antrean panen masuk dan etalase toko secara paralel (Promise.all) untuk memangkas latensi database
  const [unverifiedProducts, myStoreProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        isVerified: false,
        stock: { gt: 0 },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
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
    }),
  ]);

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
