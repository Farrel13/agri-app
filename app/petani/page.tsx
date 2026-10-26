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

  // Ambil data produk berdasarkan userId petani yang sedang login
  const products = await prisma.product.findMany({
    where: { 
      userId: session.user.id 
    },
    orderBy: { 
      createdAt: "desc" 
    },
  });

  return <PetaniClient products={products} />;
}