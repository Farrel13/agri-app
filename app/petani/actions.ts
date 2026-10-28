"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { validateImageBuffer } from "@/lib/file-validator";

export interface TambahPanenInput {
  name: string;
  stock: number;
  unit: string;
  priceFarmer: number;
  imageUrl?: string | null;
}

// 1. Fungsi Server Action simpan produk
export async function tambahPanen(data: TambahPanenInput) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "PETANI") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const { name, stock, unit, priceFarmer, imageUrl } = data;

    // Sanitasi dan validasi input
    const cleanName = (name || "").trim().slice(0, 100);
    const cleanUnit = ["kg", "ton", "ikat", "karung"].includes(unit) ? unit : "kg";

    if (!cleanName || isNaN(stock) || isNaN(priceFarmer) || stock <= 0 || priceFarmer <= 0) {
      return { success: false, message: "Mohon isi semua data dengan benar." };
    }

    // Hitung waktu kadaluarsa gambar: 24 jam dari sekarang
    const imageExpiresAt = imageUrl ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

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
    return { success: true, message: "Hasil panen berhasil ditambahkan!" };
  } catch (error) {
    console.error("Gagal menambah produk:", error);
    return { success: false, message: "Terjadi kesalahan pada server." };
  }
}

// 2. Fungsi Server Action menerima FormData dengan pemeriksaan biner forensik
export async function addProductAction(formData: FormData) {
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

      // Uji forensik biner: Magic Byte & Polyglot inspection
      const validation = validateImageBuffer(buffer, 3 * 1024 * 1024);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error || "Berkas gambar ditolak oleh sistem keamanan.",
        };
      }

      // Lindungi dari Path Traversal: Gunakan UUID / Crypto random filename murni
      const randomHex = crypto.randomBytes(16).toString("hex");
      const filename = `${Date.now()}-${randomHex}${validation.sanitizedExt}`;

      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);
      
      imageUrl = `/uploads/${filename}`;
    } catch (err) {
      console.error("Gagal memproses unggahan gambar:", err);
      return { success: false, message: "Gagal memproses unggahan gambar." };
    }
  }

  return tambahPanen({ name, stock, unit, priceFarmer, imageUrl });
}
