"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Jangan render jika belum login atau sedang loading
  if (status === "loading" || !session) return null;

  const role = session.user?.role;

  return (
    <nav className="bg-white border-b border-gray-200 p-4 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-emerald-600 text-lg flex items-center gap-1.5">
            <span>AgriApp</span>
          </Link>

          {/* Navigasi Khusus Restoran */}
          {role === "RESTAURANT" && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
              <Link
                href="/restoran"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/restoran"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Katalog Bahan
              </Link>
              <Link
                href="/restoran/pesanan"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/restoran/pesanan"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Riwayat Pesanan
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Hub */}
          {role === "HUB" && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
              <Link
                href="/hub"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/hub"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Verifikasi dan Etalase
              </Link>
              <Link
                href="/hub/pesanan"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/hub/pesanan"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Pesanan Masuk
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Petani */}
          {role === "PETANI" && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
              <Link
                href="/petani"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/petani"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Panen dan Penjualan
              </Link>
              <Link
                href="/petani/tambah"
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 transition font-medium"
              >
                + Upload Panen
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Admin */}
          {role === "ADMIN" && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/admin"
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Pusat Kontrol Admin
              </Link>
            </div>
          )}
        </div>

        <div className="flex gap-3 items-center">
          {/* Lonceng Notifikasi Terintegrasi */}
          <NotificationBell />

          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-medium text-gray-800 leading-tight">
              {session.user?.name}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {role}
            </span>
          </div>

          <Link
            href="/api/auth/signout"
            className="text-xs bg-white text-rose-500 px-3 py-1.5 rounded-md font-medium hover:bg-gray-50 transition border border-rose-300"
          >
            Logout
          </Link>
        </div>
      </div>
    </nav>
  );
}
