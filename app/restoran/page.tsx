export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RestoranClient from "./RestoranClient";

export default async function DashboardRestoran() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  if (session.user.role !== "RESTAURANT") {
    redirect("/");
  }

  // Ambil produk yang sudah diverifikasi oleh Hub dan stoknya masih > 0
  const catalog = await prisma.product.findMany({
    where: {
      isVerified: true,
      stock: { gt: 0 },
    },
    include: {
      user: {
        select: { name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return <RestoranClient products={catalog} />;
}