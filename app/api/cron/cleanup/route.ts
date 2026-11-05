import { NextResponse } from "next/server";
import { cleanupExpiredImages } from "@/lib/cleanup";

/**
 * Route Endpoint untuk Background Cron Job Pembersihan Foto Panen & Terima Barang (>24 jam)
 * Dapat dipanggil secara berkala (misal: setiap tengah malam / per 6 jam)
 * Contoh: curl -X POST http://localhost:3000/api/cron/cleanup
 */
export async function GET(request: Request) {
  try {
    // Proteksi Otorisasi: Wajibkan Bearer CRON_SECRET jika di production atau jika env diset
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (process.env.NODE_ENV === "production" && !cronSecret) {
      return NextResponse.json(
        { message: "CRON_SECRET belum dikonfigurasi di environment server." },
        { status: 500 }
      );
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Akses cron ditolak (Unauthorized)." }, { status: 401 });
    }

    await cleanupExpiredImages();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: "Pembersihan foto kadaluarsa (>24 jam) berhasil dijalankan secara background.",
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
