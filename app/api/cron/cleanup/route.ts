import { NextResponse } from "next/server";
import { cleanupExpiredImages } from "@/lib/cleanup";
import crypto from "crypto";

// Maksimal durasi eksekusi untuk Vercel Serverless Function (maks 60s pada runtime yang mendukung)
export const maxDuration = 60;

/**
 * Route Endpoint untuk Background Cron Job Pembersihan Foto Panen & Terima Barang (>24 jam)
 * Dipanggil secara berkala via Vercel Cron atau external scheduler dengan header Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  try {
    // Proteksi Otorisasi: Wajibkan Bearer CRON_SECRET jika di production atau jika env diset
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization") || "";

    if (process.env.NODE_ENV === "production" && !cronSecret) {
      return NextResponse.json(
        { message: "CRON_SECRET belum dikonfigurasi di environment server." },
        { status: 500 }
      );
    }

    if (cronSecret) {
      const expectedHeader = `Bearer ${cronSecret}`;
      const expectedBuf = Buffer.from(expectedHeader);
      const actualBuf = Buffer.from(authHeader);

      // Gunakan timing-safe comparison untuk mencegah serangan analisis waktu (Timing Attacks)
      if (
        expectedBuf.length !== actualBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, actualBuf)
      ) {
        return NextResponse.json({ message: "Akses cron ditolak (Unauthorized)." }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ message: "Akses cron ditolak (Unauthorized)." }, { status: 401 });
    }

    const result = await cleanupExpiredImages(50);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: "Pembersihan foto kadaluarsa (>24 jam) berhasil dijalankan secara background.",
      details: result,
    });
  } catch (error) {
    console.error("Gagal menjalankan cron cleanup:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat cron cleanup." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
