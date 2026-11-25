"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { validateImageBuffer } from "@/lib/file-validator";
import { checkServerActionRateLimit } from "@/lib/rate-limit";
import { logServerEvent } from "@/lib/system-logger";

// Verifikasi / Pembelian hasil panen petani oleh toko Hub (Mendukung Pembelian Parsial & Anti Race Condition)
export async function verifyProductAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "HUB") {
      return { success: false, message: "Akses tidak diizinkan." };
    }

    const rateCheck = await checkServerActionRateLimit("verify_product", session.user.id, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const productId = formData.get("productId") as string;
    const priceHub = Number(formData.get("priceHub"));
    const rawQuantity = formData.get("quantity");
    const description = (formData.get("description") as string)?.trim().slice(0, 500) || null;

    if (!productId || isNaN(priceHub) || priceHub <= 0 || priceHub > 1_000_000_000) {
      return { success: false, message: "Harga jual toko harus diisi dengan benar (maks Rp 1 Miliar)." };
    }

    const buyQuantity = rawQuantity !== null && rawQuantity !== undefined && rawQuantity !== ""
      ? Math.floor(Number(rawQuantity))
      : null;

    if (buyQuantity === null || isNaN(buyQuantity) || buyQuantity <= 0 || buyQuantity > 100_000_000) {
      return { success: false, message: "Jumlah kuantitas pembelian harus berupa bilangan bulat positif yang valid (> 0)." };
    }

    // Eksekusi transaksi atomik basis data
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ambil data panen awal untuk verifikasi batasan
      const source = await tx.product.findUnique({
        where: { id: productId },
        include: { user: { select: { id: true, name: true, username: true } } },
      });

      if (!source) {
        throw new Error("NOT_FOUND:Komoditas hasil panen tidak ditemukan.");
      }

      // Pastikan komoditas adalah listing terbuka dari petani
      if (source.isVerified && source.verifiedById && source.verifiedById !== session.user.id) {
        throw new Error("ALREADY_VERIFIED:Produk ini sudah diverifikasi oleh toko Hub lain.");
      }

      // Validasi harga jual Hub tidak boleh di bawah harga modal petani
      if (priceHub < source.priceFarmer) {
        throw new Error(
          `PRICE_TOO_LOW:Harga jual toko tidak boleh lebih rendah dari modal beli petani (Rp ${source.priceFarmer.toLocaleString("id-ID")}).`
        );
      }

      if (source.stock <= 0) {
        throw new Error("OUT_OF_STOCK:Stok hasil panen ini sudah habis.");
      }

      if (buyQuantity > source.stock) {
        throw new Error(
          `INSUFFICIENT_STOCK:Jumlah pembelian (${buyQuantity} ${source.unit}) melebihi stok panen yang tersedia (${source.stock} ${source.unit}).`
        );
      }

      // 2. Lakukan pengurangan stok panen petani secara ATOMIK
      // Kondisi 'stock: { gte: buyQuantity }' menjamin:
      // a. Stok tidak pernah minus (< 0)
      // b. Mencegah bentrok / race condition jika dua pedagang membeli bersamaan
      const updateResult = await tx.product.updateMany({
        where: {
          id: productId,
          stock: { gte: buyQuantity },
        },
        data: {
          stock: { decrement: buyQuantity },
        },
      });

      if (updateResult.count === 0) {
        // Terjadi bentrok dengan pedagang lain yang mengeksekusi pembelian di saat bersamaan
        const refreshed = await tx.product.findUnique({ where: { id: productId } });
        const remaining = refreshed?.stock ?? 0;
        if (remaining <= 0) {
          throw new Error("RACE_CONFLICT:Stok panen baru saja habis dibeli oleh pedagang lain.");
        }
        throw new Error(
          `RACE_CONFLICT:Stok panen baru saja dibeli pedagang lain. Sisa stok saat ini tinggal ${remaining} ${source.unit}. Silakan sesuaikan jumlah pembelian Anda.`
        );
      }

      // 3. Masukkan hasil panen yang dibeli ke etalase Toko Hub pedagang
      const hubExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Cek apakah Toko Hub ini sudah memiliki produk aktif untuk komoditas & petani yang sama
      const existingHubProduct = await tx.product.findFirst({
        where: {
          userId: source.userId,
          name: source.name,
          verifiedById: session.user.id,
          isVerified: true,
        },
      });

      if (existingHubProduct) {
        // Jika sudah ada produk di etalase toko, tambahkan kuantitas stoknya
        await tx.product.update({
          where: { id: existingHubProduct.id },
          data: {
            stock: { increment: buyQuantity },
            priceHub: priceHub,
            description: description || existingHubProduct.description,
            imageExpiresAt: hubExpiresAt,
          },
        });
      } else {
        // Jika belum ada, buat produk etalase baru khusus untuk toko Hub ini
        await tx.product.create({
          data: {
            name: source.name,
            description: description,
            stock: buyQuantity,
            unit: source.unit,
            priceFarmer: source.priceFarmer,
            costFarmer: source.costFarmer || 0,
            priceHub: priceHub,
            isVerified: true,
            userId: source.userId,
            verifiedById: session.user.id,
            imageUrl: source.imageUrl,
            imageExpiresAt: hubExpiresAt,
          },
        });
      }

      // 4. Kirim notifikasi sistem ke Petani
      await tx.notification.create({
        data: {
          userId: source.userId,
          title: `Panen Dibeli Toko Hub! 🛒`,
          message: `Toko Hub '${session.user.name}' membeli ${buyQuantity} ${source.unit} komoditas "${source.name}" (Total: Rp ${(buyQuantity * source.priceFarmer).toLocaleString("id-ID")}).`,
          type: "PANEN_TERVERIFIKASI",
          linkUrl: "/petani",
        },
      });

      return {
        productName: source.name,
        quantity: buyQuantity,
        unit: source.unit,
        farmerName: source.user?.name || "Petani",
      };
    });

    logServerEvent({
      severity: "INFO",
      action: "HUB_BUY_HARVEST",
      message: `Toko Hub '${session.user.username}' membeli ${result.quantity} ${result.unit} '${result.productName}' dari ${result.farmerName} seharga Rp ${priceHub.toLocaleString("id-ID")}`,
      userId: session.user.id,
      endpoint: "ServerAction:verifyProductAction",
      metadata: { productId, quantity: result.quantity, priceHub },
    }).catch(() => {});

    revalidatePath("/hub");
    revalidatePath("/restoran");
    revalidatePath("/petani");
    return {
      success: true,
      message: `Berhasil membeli ${result.quantity} ${result.unit} "${result.productName}" dan memajangnya di etalase tokomu!`,
    };
  } catch (error: unknown) {
    const rawMessage = (error as { message?: string })?.message || "";
    if (rawMessage.includes(":")) {
      const parts = rawMessage.split(":");
      return { success: false, message: parts.slice(1).join(":") };
    }
    console.error("Error verifikasi/pembelian panen:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses pembelian panen." };
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
