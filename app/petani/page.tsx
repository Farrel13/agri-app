export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PetaniClient from "./PetaniClient";

export default async function DashboardPetani() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "PETANI") {
    redirect("/");
  }

  // Ambil data produk petani dan catatan pengeluaran secara paralel
  const [rawProducts, rawExpenses] = await Promise.all([
    prisma.product.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        verifiedBy: {
          select: { id: true, name: true, username: true },
        },
        orderItems: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.expense.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        date: "desc",
      },
    }),
  ]);

  // Hitung ringkasan finansial dan penjualan
  let totalRevenue = 0;
  let totalAutoCost = 0;
  let totalSoldUnits = 0;
  let verifiedCount = 0;

  const incomeEvents: Array<{
    id: string;
    orderNumber: string;
    productName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    costPerUnit: number;
    revenue: number;
    costAuto: number;
    net: number;
    date: Date;
  }> = [];

  const products = rawProducts.map((p) => {
    if (p.isVerified) verifiedCount++;

    let productSoldQty = 0;
    let productEarned = 0;
    let productAutoCost = 0;

    for (const item of p.orderItems) {
      if (item.order && item.order.status !== "DIBATALKAN") {
        const itemRevenue = item.quantity * p.priceFarmer;
        const itemCost = item.quantity * (p.costFarmer || 0);

        productSoldQty += item.quantity;
        productEarned += itemRevenue;
        productAutoCost += itemCost;

        incomeEvents.push({
          id: item.id,
          orderNumber: item.order.orderNumber,
          productName: p.name,
          quantity: item.quantity,
          unit: p.unit,
          pricePerUnit: p.priceFarmer,
          costPerUnit: p.costFarmer || 0,
          revenue: itemRevenue,
          costAuto: itemCost,
          net: itemRevenue - itemCost,
          date: item.order.createdAt,
        });
      }
    }

    totalSoldUnits += productSoldQty;
    totalRevenue += productEarned;
    totalAutoCost += productAutoCost;

    const avgRating =
      p.reviews.length > 0
        ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length
        : null;

    return {
      ...p,
      costFarmer: p.costFarmer || 0,
      soldQuantity: productSoldQty,
      totalEarned: productEarned,
      totalCost: productAutoCost,
      averageRating: avgRating,
    };
  });

  // Urutkan riwayat pemasukan dari yang paling baru
  incomeEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Hitung total pengeluaran manual (Opsi B)
  const totalManualExpense = rawExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = totalAutoCost + totalManualExpense;
  const netProfit = totalRevenue - totalExpense;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const stats = {
    totalProducts: products.length,
    verifiedCount,
    totalSoldUnits,
    totalRevenue,
    totalAutoCost,
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
    date: e.date,
  }));

  return (
    <PetaniClient
      products={products}
      stats={stats}
      expenses={expenses}
      incomeEvents={incomeEvents}
    />
  );
}
