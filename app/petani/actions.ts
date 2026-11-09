"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { validateImageBuffer } from "@/lib/file-validator";
import { checkServerActionRateLimit } from "@/lib/rate-limit";

export interface TambahPanenInput {
  name: string;
  stock: number;
  unit: string;
  priceFarmer: number;
  imageUrl?: string | null;
}

// 1. Fungsi simpan produk panen baru
export async function tambahPanen(data: TambahPanenInput) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "PETANI") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const { name, stock, unit, priceFarmer, imageUrl } = data;

    const cleanName = (name || "").trim().slice(0, 100);
    const cleanUnit = ["kg", "ton", "ikat", "karung"].includes(unit) ? unit : "kg";

    if (!cleanName || isNaN(stock) || isNaN(priceFarmer) || stock <= 0 || priceFarmer <= 0) {
      return { success: false, message: "Mohon isi semua data panen dengan benar." };
    }

    // Setiap produk panen memiliki batas kadaluarsa 24 jam
    const imageExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.product.create({
      data: {
        name: cleanName,
        stock: Math.floor(Number(stock)),
        unit: cleanUnit,
        priceFarmer: Math.floor(Number(priceFarmer)),
        userId: session.user.id,
        isVerified: false,
        imageUrl: imageUrl || null,
        imageExpiresAt: imageExpiresAt,
      },
    });

    revalidatePath("/petani");
    revalidatePath("/hub");
    return { success: true, message: "Hasil panen berhasil didaftarkan!" };
  } catch (error) {
    console.error("Gagal menambah produk:", error);
    return { success: false, message: "Terjadi kesalahan pada server." };
  }
}

// 2. Menerima FormData dengan uji forensik biner
export async function addProductAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PETANI") {
    return { success: false, message: "Akses tidak diizinkan." };
  }

  // Rate limiting: cegah spam pendaftaran panen & upload masif
  const rateCheck = await checkServerActionRateLimit("add_product", session.user.id, 5, 60 * 1000);
  if (!rateCheck.allowed) {
    return { success: false, message: rateCheck.message };
  }

  const name = formData.get("name") as string;
  const stock = Number(formData.get("stock"));
  const unit = formData.get("unit") as string;
  const priceFarmer = Number(formData.get("priceFarmer"));
  const file = formData.get("image") as File | null;

  let imageUrl: string | null = null;

  if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Batasi 1.5MB untuk mencegah pembengkakan database (database bloat)
      const validation = validateImageBuffer(buffer, 1.5 * 1024 * 1024);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error || "Berkas gambar ditolak oleh sistem keamanan.",
        };
      }

      const mimeType =
        validation.detectedType === "png"
          ? "image/png"
          : validation.detectedType === "webp"
          ? "image/webp"
          : "image/jpeg";
      imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch (err) {
      console.error("Gagal memproses unggahan gambar:", err);
      return { success: false, message: "Gagal memproses unggahan gambar." };
    }
  }

  return tambahPanen({ name, stock, unit, priceFarmer, imageUrl });
}

// 3. Edit Panen oleh Petani
export async function updateProductFarmerAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "PETANI") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("update_product", session.user.id, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const productId = formData.get("productId") as string;
    const name = (formData.get("name") as string)?.trim();
    const stock = Number(formData.get("stock"));
    const unit = formData.get("unit") as string;
    const priceFarmer = Number(formData.get("priceFarmer"));
    const file = formData.get("image") as File | null;

    if (!productId || !name || isNaN(stock) || isNaN(priceFarmer) || stock < 0 || priceFarmer <= 0) {
      return { success: false, message: "Data yang dimasukkan tidak valid." };
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.userId !== session.user.id) {
      return { success: false, message: "Produk panen tidak ditemukan atau bukan milik Anda." };
    }

    let newImageUrl: string | undefined = undefined;
    let newExpiresAt: Date | undefined = undefined;

    if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const validation = validateImageBuffer(buffer, 1.5 * 1024 * 1024);
      if (!validation.isValid) {
        return { success: false, message: validation.error || "Gambar ditolak." };
      }

      const mimeType =
        validation.detectedType === "png"
          ? "image/png"
          : validation.detectedType === "webp"
          ? "image/webp"
          : "image/jpeg";
      newImageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        stock: Math.floor(stock),
        unit: ["kg", "ton", "ikat", "karung"].includes(unit) ? unit : existing.unit,
        priceFarmer: Math.floor(priceFarmer),
        ...(newImageUrl && {
          imageUrl: newImageUrl,
          imageExpiresAt: newExpiresAt,
        }),
      },
    });

    revalidatePath("/petani");
    revalidatePath("/hub");
    return { success: true, message: "Data panen berhasil diperbarui!" };
  } catch (error) {
    console.error("Gagal mengupdate panen:", error);
    return { success: false, message: "Terjadi kesalahan saat memperbarui data." };
  }
}

// 4. Hapus Panen oleh Petani
export async function deleteProductFarmerAction(productId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "PETANI") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("delete_product", session.user.id, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { orderItems: true },
    });

    if (!existing || existing.userId !== session.user.id) {
      return { success: false, message: "Produk tidak ditemukan atau bukan milik Anda." };
    }

    // Jika produk sudah memiliki riwayat transaksi di OrderItem, jangan hard-delete
    if (existing.orderItems && existing.orderItems.length > 0) {
      // Set stok menjadi 0 agar tidak bisa dipesan lagi
      await prisma.product.update({
        where: { id: productId },
        data: { stock: 0 },
      });
      revalidatePath("/petani");
      revalidatePath("/hub");
      return {
        success: true,
        message: "Produk memiliki riwayat transaksi, stok berhasil dikosongkan (diarsipkan).",
      };
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    revalidatePath("/petani");
    revalidatePath("/hub");
    return { success: true, message: "Hasil panen berhasil dihapus!" };
  } catch (error) {
    console.error("Gagal menghapus panen:", error);
    return { success: false, message: "Terjadi kesalahan saat menghapus data." };
  }
}
