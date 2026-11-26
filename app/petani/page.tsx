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

  // 1. Kumpulkan riwayat pemasukan secara murni tanpa mutasi
  const incomeEvents = rawProducts.flatMap((p) =>
    p.orderItems
      .filter((item) => item.order && item.order.status !== "DIBATALKAN")
      .map((item) => {
        const itemRevenue = item.quantity * p.priceFarmer;
        const itemCost = item.quantity * (p.costFarmer || 0);
        return {
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
        };
      })
  );

  // Urutkan riwayat pemasukan dari yang paling baru
  const sortedIncomeEvents = [...incomeEvents].sort((a, b) => b.date.getTime() - a.date.getTime());

  // 2. Olah daftar produk secara murni
  const products = rawProducts.map((p) => {
    const validItems = p.orderItems.filter(
      (item) => item.order && item.order.status !== "DIBATALKAN"
    );
    const productSoldQty = validItems.reduce((sum, item) => sum + item.quantity, 0);
    const productEarned = productSoldQty * p.priceFarmer;
    const productAutoCost = productSoldQty * (p.costFarmer || 0);

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

  // 3. Hitung ringkasan finansial dan penjualan dengan agregasi murni
  const verifiedCount = products.filter((p) => p.isVerified).length;
  const totalSoldUnits = products.reduce((sum, p) => sum + p.soldQuantity, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.totalEarned, 0);
  const totalAutoCost = products.reduce((sum, p) => sum + p.totalCost, 0);

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
    date: e.date.toISOString(),
  }));

  const serializedIncomeEvents = sortedIncomeEvents.map((it) => ({
    ...it,
    date: it.date.toISOString(),
  }));

  return (
    <PetaniClient
      products={products}
      stats={stats}
      expenses={expenses}
      incomeEvents={serializedIncomeEvents}
    />
  );
}
