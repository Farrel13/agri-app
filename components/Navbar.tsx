"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Jangan render jika belum login atau sedang loading
  if (status === "loading" || !session) return null;

  const role = session.user?.role;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <Link href="/" className="font-bold text-emerald-600 text-lg flex items-center gap-1.5">
            <span>AgriApp</span>
          </Link>

          {/* Navigasi Khusus Restoran (Desktop) */}
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

          {/* Navigasi Khusus Hub (Desktop) */}
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

          {/* Navigasi Khusus Petani (Desktop) */}
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

          {/* Navigasi Khusus Admin (Desktop) */}
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

        <div className="flex gap-2.5 sm:gap-3 items-center">
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

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/", redirect: true })}
            className="text-xs bg-white text-rose-600 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-md font-medium hover:bg-rose-50 transition border border-rose-200 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top-1">
          <div className="text-[11px] text-gray-400 font-medium px-2 pb-1 border-b border-gray-100 flex justify-between items-center">
            <span>Masuk sebagai: <strong className="text-gray-700">{session.user?.name}</strong></span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono">{role}</span>
          </div>

          {role === "RESTAURANT" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/restoran"
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  pathname === "/restoran"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Katalog Bahan Baku
              </Link>
              <Link
                href="/restoran/pesanan"
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  pathname === "/restoran/pesanan"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Riwayat & Status Pesanan
              </Link>
            </div>
          )}

          {role === "HUB" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/hub"
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  pathname === "/hub"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Verifikasi dan Etalase
              </Link>
              <Link
                href="/hub/pesanan"
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  pathname === "/hub/pesanan"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Pesanan Masuk & Laba
              </Link>
            </div>
          )}

          {role === "PETANI" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/petani"
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  pathname === "/petani"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Panen dan Penjualan
              </Link>
              <Link
                href="/petani/tambah"
                className="px-3 py-2 rounded-md text-xs font-medium bg-emerald-600 text-white text-center mt-1"
              >
                + Upload Panen Baru
              </Link>
            </div>
          )}

          {role === "ADMIN" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  pathname === "/admin"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Pusat Kontrol Admin
              </Link>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/", redirect: true })}
              className="w-full text-left px-3 py-2 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer flex items-center justify-between"
            >
              <span>Keluar Akun (Logout)</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
