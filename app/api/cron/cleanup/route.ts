import { NextResponse } from "next/server";
import { cleanupExpiredImages } from "@/lib/cleanup";

/**
 * Route Endpoint untuk Background Cron Job Pembersihan Foto Panen & Terima Barang (>24 jam)
 * Dapat dipanggil secara berkala (misal: setiap tengah malam / per 6 jam)
 * Contoh: curl -X POST http://localhost:3000/api/cron/cleanup
 */
export async function GET(request: Request) {
  try {
    // Opsional: Cek Authorization / CRON_SECRET jika diperlukan di production
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ message: "Unauthorized cron execution" }, { status: 401 });
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
