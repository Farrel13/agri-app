"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

// Tipe data input untuk halaman tambah panen
export interface TambahPanenInput {
  name: string;
  stock: number;
  unit: string;
  priceFarmer: number;
}

// 1. Fungsi khusus untuk dipanggil langsung dari komponen Client/Page dengan objek
export async function tambahPanen(data: TambahPanenInput) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "PETANI") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const { name, stock, unit, priceFarmer } = data;

    if (!name || isNaN(stock) || isNaN(priceFarmer) || stock <= 0 || priceFarmer <= 0) {
      return { success: false, message: "Mohon isi semua data dengan benar." };
    }

    await prisma.product.create({
      data: {
        name,
        stock: Number(stock),
        unit,
        priceFarmer: Number(priceFarmer),
        userId: session.user.id,
        isVerified: false,
      },
    });

    revalidatePath("/petani");
    return { success: true, message: "Hasil panen berhasil ditambahkan!" };
  } catch (error) {
    console.error("Gagal menambah produk:", error);
    return { success: false, message: "Terjadi kesalahan pada server." };
  }
}

// 2. Fungsi untuk penanganan via HTML Form (FormData)
export async function addProductAction(formData: FormData) {
  const name = formData.get("name") as string;
  const stock = Number(formData.get("stock"));
  const unit = formData.get("unit") as string;
  const priceFarmer = Number(formData.get("priceFarmer"));

  return tambahPanen({ name, stock, unit, priceFarmer });
}