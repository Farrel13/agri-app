"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Jangan render jika belum login atau sedang loading
  if (status === "loading" || !session) return null;

  const role = session.user?.role;

  return (
    <nav className="bg-white shadow-sm border-b p-4 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-extrabold text-emerald-600 text-xl tracking-tight">
            🌾 AgriApp
          </Link>

          {/* Navigasi Khusus Restoran */}
          {role === "RESTAURANT" && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-semibold">
              <Link
                href="/restoran"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/restoran"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Katalog Bahan
              </Link>
              <Link
                href="/restoran/pesanan"
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  pathname === "/restoran/pesanan"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Riwayat Pesanan 🧾
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Hub */}
          {role === "HUB" && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-semibold">
              <Link
                href="/hub"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/hub"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Verifikasi Panen
              </Link>
              <Link
                href="/hub/pesanan"
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  pathname === "/hub/pesanan"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pesanan Masuk 📦
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Petani */}
          {role === "PETANI" && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-semibold">
              <Link
                href="/petani"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/petani"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Hasil Panen Saya
              </Link>
              <Link
                href="/petani/tambah"
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition"
              >
                + Upload Panen
              </Link>
            </div>
          )}
        </div>

        <div className="flex gap-4 items-center">
          <span className="text-xs sm:text-sm text-gray-600">
            Halo, <strong className="text-gray-900">{session.user?.name}</strong>{" "}
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
              {role}
            </span>
          </span>
          <Link
            href="/api/auth/signout"
            className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 transition"
          >
            Logout
          </Link>
        </div>
      </div>
    </nav>
  );
}
