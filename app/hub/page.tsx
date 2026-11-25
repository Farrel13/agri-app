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

  // Ambil antrean panen, etalase toko, transaksi pesanan, dan pengeluaran secara paralel
  const [unverifiedProducts, myStoreProducts, rawOrders, rawExpenses] = await Promise.all([
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
    prisma.order.findMany({
      where: { hubId: session.user.id },
      include: {
        buyer: { select: { id: true, name: true } },
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
    }),
    prisma.expense.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    }),
  ]);

  // Hitung ringkasan keuangan Hub (Pedagang)
  let totalRevenue = 0;
  let totalFarmerCost = 0;
  let completedOrdersCount = 0;

  const salesEvents: Array<{
    id: string;
    orderNumber: string;
    buyerName: string;
    productName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    farmerCostPerUnit: number;
    revenue: number;
    farmerCost: number;
    netMargin: number;
    date: Date | string;
    status: string;
  }> = [];

  for (const ord of rawOrders) {
    if (ord.status === "SELESAI") {
      completedOrdersCount++;
    }

    const isPaid =
      ord.status !== "DIBATALKAN" &&
      (ord.payment?.status === "LUNAS" || ["DIPROSES_HUB", "DIKIRIM", "SELESAI"].includes(ord.status));

    for (const it of ord.items) {
      const revenue = it.subtotal;
      const farmerCostPerUnit = it.product?.priceFarmer || 0;
      const farmerCost = it.quantity * farmerCostPerUnit;
      const netMargin = revenue - farmerCost;

      if (isPaid) {
        totalRevenue += revenue;
        totalFarmerCost += farmerCost;
      }

      salesEvents.push({
        id: it.id,
        orderNumber: ord.orderNumber,
        buyerName: ord.buyer?.name || "Restoran",
        productName: it.product?.name || "Komoditas",
        quantity: it.quantity,
        unit: it.product?.unit || "kg",
        pricePerUnit: it.pricePerUnit,
        farmerCostPerUnit,
        revenue,
        farmerCost,
        netMargin,
        date: ord.createdAt.toISOString(),
        status: ord.status,
      });
    }
  }

  // Hitung pengeluaran operasional manual (Opsi B untuk Hub)
  const totalManualExpense = rawExpenses.reduce((sum, ex) => sum + ex.amount, 0);
  const totalExpense = totalFarmerCost + totalManualExpense;
  const netProfit = totalRevenue - totalExpense;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const financialStats = {
    totalOrders: rawOrders.length,
    completedOrdersCount,
    totalRevenue,
    totalFarmerCost,
    totalManualExpense,
    totalExpense,
    netProfit,
    profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
  };

  const expenses = rawExpenses.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    amount: e.amount,
    notes: e.notes,
    date: e.date.toISOString(),
  }));

  return (
    <HubClient
      unverifiedProducts={unverifiedProducts}
      myStoreProducts={myStoreProducts}
      financialStats={financialStats}
      salesEvents={salesEvents}
      expenses={expenses}
      hubUser={{
        id: session.user.id,
        name: session.user.name || "Pedagang",
      }}
    />
  );
}
