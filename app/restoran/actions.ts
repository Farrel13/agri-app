"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export async function placeOrderAction(items: CartItemInput[]) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "RESTAURANT") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    if (!items || items.length === 0) {
      return { success: false, message: "Keranjang belanja kosong." };
    }

    // Transaksi atomik: kurangi stok langsung di tabel Product
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || product.stock < item.quantity) {
          throw new Error(`Stok untuk ${product?.name || "produk"} tidak mencukupi.`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }
    });

    revalidatePath("/restoran");
    revalidatePath("/hub");
    return { success: true, message: "Pesanan berhasil dibuat!" };
  } catch (error) {
    console.error("Gagal membuat pesanan:", error);
    
    // Mengecek apakah error merupakan instance dari Error bawaan JS/Prisma
    const errorMessage = error instanceof Error ? error.message : "Gagal memproses pesanan.";
    
    return { success: false, message: errorMessage };
  }
}