export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredImages } from "@/lib/cleanup";
import PesananRestoranClient from "./PesananRestoranClient";

export default async function PesananRestoranPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "RESTAURANT") {
    redirect("/");
  }

  // Bersihkan foto panen & foto penerimaan barang yang > 24 jam
  await cleanupExpiredImages();

  // Ambil daftar pesanan milik restoran yang sedang login
  const orders = await prisma.order.findMany({
    where: { buyerId: session.user.id },
    include: {
      hub: { select: { id: true, name: true } },
      deliveryAddress: true,
      payment: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, unit: true, imageUrl: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <PesananRestoranClient initialOrders={orders} />;
}
