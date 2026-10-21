"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function verifyProductAction(productId: string, priceHub: number) {
  try {
    if (!productId || isNaN(priceHub) || priceHub <= 0) {
      return { success: false, message: "Harga Hub harus diisi dengan benar." };
    }

    // Langsung update status verifikasi dan harga di tabel Product
    await prisma.product.update({
      where: { id: productId },
      data: {
        isVerified: true,
        priceHub: priceHub,
      },
    });

    revalidatePath("/hub");
    return { success: true, message: "Produk berhasil diverifikasi dan dipublikasikan!" };
  } catch (error) {
    console.error("Error verifikasi produk:", error);
    return { success: false, message: "Gagal memproses verifikasi." };
  }
}