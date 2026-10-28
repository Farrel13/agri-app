export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HubPesananClient from "./HubPesananClient";

export default async function HubPesananPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "HUB") {
    redirect("/");
  }

  // Ambil semua order yang masuk ke toko Hub ini
  const orders = await prisma.order.findMany({
    where: { hubId: session.user.id },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
      deliveryAddress: true,
      payment: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, unit: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return <HubPesananClient initialOrders={orders} />;
}
