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

  // Hitung Laba Rugi / Margin Hub
  let totalRevenue = 0; // Total uang penjualan bahan
  let totalFarmerCost = 0; // Modal yang harus diserahkan ke petani
  let completedOrdersCount = 0;

  const orders = rawOrders.map((ord) => {
    let orderCost = 0;
    let orderRevenue = 0;

    for (const it of ord.items) {
      orderRevenue += it.subtotal;
      orderCost += it.quantity * (it.product?.priceFarmer || 0);
    }

    const orderProfit = orderRevenue - orderCost;

    if (ord.status !== "DIBATALKAN" && ord.payment?.status === "LUNAS") {
      totalRevenue += orderRevenue;
      totalFarmerCost += orderCost;
    }

    if (ord.status === "SELESAI") {
      completedOrdersCount++;
    }

    return {
      ...ord,
      orderCost,
      orderProfit,
    };
  });

  const netProfit = totalRevenue - totalFarmerCost;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const financialStats = {
    totalOrders: orders.length,
    completedOrdersCount,
    totalRevenue,
    totalFarmerCost,
    netProfit,
    profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
  };

  return <HubPesananClient initialOrders={orders} financialStats={financialStats} />;
}
