export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminClient from "./AdminClient";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Hanya perbolehkan pengguna dengan role ADMIN
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Ambil semua pengguna platform
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          products: true,
          ordersAsBuyer: true,
          ordersAsHub: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Ambil semua transaksi platform
  const orders = await prisma.order.findMany({
    include: {
      buyer: { select: { id: true, name: true } },
      hub: { select: { id: true, name: true } },
      payment: true,
      items: {
        include: {
          product: { select: { name: true, unit: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Hitung metrik platform
  const totalUsers = users.length;
  const petaniCount = users.filter((u) => u.role === "PETANI").length;
  const hubCount = users.filter((u) => u.role === "HUB").length;
  const restaurantCount = users.filter((u) => u.role === "RESTAURANT").length;

  const totalGMV = orders.reduce((sum, ord) => sum + ord.finalAmount, 0);

  const stats = {
    totalUsers,
    petaniCount,
    hubCount,
    restaurantCount,
    totalOrders: orders.length,
    totalGMV,
  };

  return <AdminClient users={users} orders={orders} stats={stats} />;
}
