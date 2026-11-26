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
  const rawOrders = await prisma.order.findMany({
    where: { hubId: session.user.id },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
      deliveryAddress: true,
      payment: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
              priceFarmer: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Hitung Laba Rugi / Margin per pesanan
  const orders = rawOrders.map((ord) => {
    let orderCost = 0;
    let orderRevenue = 0;

    for (const it of ord.items) {
      orderRevenue += it.subtotal;
      orderCost += it.quantity * (it.product?.priceFarmer || 0);
    }

    const orderProfit = orderRevenue - orderCost;

    return {
      ...ord,
      orderCost,
      orderProfit,
    };
  });

  return <HubPesananClient initialOrders={orders} />;
}
