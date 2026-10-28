"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import path from "path";

// Verifikasi hasil panen petani oleh toko Hub
export async function verifyProductAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const productId = formData.get("productId") as string;
    const priceHub = Number(formData.get("priceHub"));
    const description = (formData.get("description") as string)?.trim() || null;

    if (!productId || isNaN(priceHub) || priceHub <= 0) {
      return { success: false, message: "Harga jual toko harus diisi dengan benar." };
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        priceHub: priceHub,
        description: description,
        isVerified: true,
        verifiedById: session.user.id, // Toko Hub pedagang yang login
      },
    });

    revalidatePath("/hub");
    revalidatePath("/restoran");
    return { success: true, message: "Bahan berhasil diverifikasi dan masuk ke etalase tokomu!" };
  } catch (error) {
    console.error("Error verifikasi:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses verifikasi." };
  }
}

// Hub mengupdate harga / deskripsi / stok / foto bahan yang dijual di tokonya
export async function updateStoreProductAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const productId = formData.get("productId") as string;
    const priceHub = Number(formData.get("priceHub"));
    const stock = Number(formData.get("stock"));
    const description = (formData.get("description") as string)?.trim() || null;
    const file = formData.get("image") as File | null;

    if (!productId || isNaN(priceHub) || isNaN(stock)) {
      return { success: false, message: "Data tidak valid." };
    }

    // Pastikan produk adalah milik toko Hub yang bersangkutan
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.verifiedById !== session.user.id) {
      return { success: false, message: "Anda tidak berhak mengubah produk ini." };
    }

    let newImageUrl: string | undefined = undefined;
    let newExpiresAt: Date | undefined = undefined;

    if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name) || ".jpg";
      const filename = `hub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
      const filePath = path.join(process.cwd(), "public", "uploads", filename);

      await writeFile(filePath, buffer);
      newImageUrl = `/uploads/${filename}`;
      newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam baru
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        priceHub,
        stock,
        description,
        ...(newImageUrl && {
          imageUrl: newImageUrl,
          imageExpiresAt: newExpiresAt,
        }),
      },
    });

    revalidatePath("/hub");
    revalidatePath("/restoran");
    return { success: true, message: "Perubahan etalase toko berhasil disimpan!" };
  } catch (error) {
    console.error("Error update produk toko:", error);
    return { success: false, message: "Gagal memperbarui produk." };
  }
}
