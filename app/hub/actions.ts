"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { validateImageBuffer } from "@/lib/file-validator";
import { checkServerActionRateLimit } from "@/lib/rate-limit";
import { logServerEvent } from "@/lib/system-logger";

// Verifikasi hasil panen petani oleh toko Hub
export async function verifyProductAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("verify_product", session.user.id, 15, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const productId = formData.get("productId") as string;
    const priceHub = Number(formData.get("priceHub"));
    const description = (formData.get("description") as string)?.trim().slice(0, 500) || null;

    if (!productId || isNaN(priceHub) || priceHub <= 0 || priceHub > 1_000_000_000) {
      return { success: false, message: "Harga jual toko harus diisi dengan benar (maks Rp 1 Miliar)." };
    }

    // Cegah IDOR / Pembajakan produk yang sudah diverifikasi oleh Toko Hub lain
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing) {
      return { success: false, message: "Produk panen tidak ditemukan." };
    }

    if (existing.isVerified && existing.verifiedById && existing.verifiedById !== session.user.id) {
      return {
        success: false,
        message: "Produk ini sudah diverifikasi oleh toko Hub lain.",
      };
    }

    // Business Logic: Harga jual toko tidak boleh di bawah harga modal petani
    if (priceHub < existing.priceFarmer) {
      return {
        success: false,
        message: `Harga jual toko tidak boleh lebih rendah dari harga modal beli petani (Rp ${existing.priceFarmer.toLocaleString("id-ID")}).`,
      };
    }

    // Etalase Toko Hub berlaku harian (siklus pasar 24 jam)
    const hubExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.product.update({
      where: { id: productId },
      data: {
        priceHub: priceHub,
        description: description,
        isVerified: true,
        verifiedById: session.user.id, // Toko Hub pedagang yang login
        imageExpiresAt: hubExpiresAt, // Masa berlaku etalase toko pedagang
      },
    });

    logServerEvent({
      severity: "INFO",
      action: "HUB_VERIFY_PRODUCT",
      message: `Toko Hub '${session.user.username}' memverifikasi komoditas '${existing.name}' dengan harga Rp ${priceHub.toLocaleString("id-ID")}`,
      userId: session.user.id,
      endpoint: "ServerAction:verifyProductAction",
      metadata: { productId, priceHub, priceFarmer: existing.priceFarmer },
    }).catch(() => {});

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

    const rateCheck = await checkServerActionRateLimit("update_store_product", session.user.id, 15, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const productId = formData.get("productId") as string;
    const priceHub = Number(formData.get("priceHub"));
    const stock = Number(formData.get("stock"));
    const description = (formData.get("description") as string)?.trim() || null;
    const file = formData.get("image") as File | null;

    if (
      !productId ||
      isNaN(priceHub) ||
      isNaN(stock) ||
      priceHub <= 0 ||
      priceHub > 1_000_000_000 ||
      stock < 0 ||
      stock > 100_000_000
    ) {
      return { success: false, message: "Data harga atau kuantitas stok tidak valid." };
    }

    // Pastikan produk adalah milik toko Hub yang bersangkutan
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.verifiedById !== session.user.id) {
      return { success: false, message: "Anda tidak berhak mengubah produk ini." };
    }

    if (priceHub < existing.priceFarmer) {
      return {
        success: false,
        message: `Harga jual toko tidak boleh lebih rendah dari modal beli petani (Rp ${existing.priceFarmer.toLocaleString("id-ID")}).`,
      };
    }

    let newImageUrl: string | undefined = undefined;
    let newExpiresAt: Date | undefined = undefined;

    if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const validation = validateImageBuffer(buffer, 1.5 * 1024 * 1024);
      if (!validation.isValid) {
        return { success: false, message: validation.error || "Berkas gambar ditolak." };
      }

      const mimeType =
        validation.detectedType === "png"
          ? "image/png"
          : validation.detectedType === "webp"
          ? "image/webp"
          : "image/jpeg";
      newImageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam baru
    }

    const storeExpiresAt = newExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.product.update({
      where: { id: productId },
      data: {
        priceHub,
        stock,
        description,
        imageExpiresAt: storeExpiresAt,
        ...(newImageUrl && {
          imageUrl: newImageUrl,
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

// Cabut produk dari etalase toko Hub (panen petani tetap aman & utuh)
export async function removeStoreProductAction(productId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("remove_store_product", session.user.id, 15, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.verifiedById !== session.user.id) {
      return { success: false, message: "Produk tidak ditemukan di etalase Anda." };
    }

    // Cabut dari etalase Hub tanpa menghapus data komoditas asli milik petani
    await prisma.product.update({
      where: { id: productId },
      data: {
        isVerified: false,
        verifiedById: null,
        priceHub: null,
        imageExpiresAt: null,
      },
    });

    logServerEvent({
      severity: "INFO",
      action: "HUB_REMOVE_PRODUCT",
      message: `Toko Hub '${session.user.username}' menurunkan komoditas '${existing.name}' dari etalase`,
      userId: session.user.id,
      endpoint: "ServerAction:removeStoreProductAction",
      metadata: { productId, name: existing.name },
    }).catch(() => {});

    revalidatePath("/hub");
    revalidatePath("/restoran");
    return { success: true, message: `Bahan "${existing.name}" berhasil diturunkan dari etalase tokomu.` };
  } catch (error) {
    console.error("Gagal menurunkan produk:", error);
    return { success: false, message: "Terjadi kesalahan saat menurunkan produk." };
  }
}
