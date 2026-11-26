"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes (Adjusting state during render)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  // Jangan render jika belum login atau sedang loading
  if (status === "loading" || !session) return null;

  const role = session.user?.role;
  const username = session.user?.username || session.user?.name || "pengguna";

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 font-sans shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 h-15 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition focus:outline-none cursor-pointer"
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

          <Link href="/" className="font-extrabold text-emerald-800 text-lg flex items-center gap-2 tracking-tight">
            <span className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center text-sm shadow-xs">
              🌾
            </span>
            <span>AgriApp</span>
          </Link>

          {/* Navigasi Khusus Restoran (Desktop) */}
          {role === "RESTAURANT" && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
              <Link
                href="/restoran"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/restoran"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Katalog Bahan
              </Link>
              <Link
                href="/restoran/pesanan"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/restoran/pesanan"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Riwayat Pesanan
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Hub (Desktop) */}
          {role === "HUB" && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
              <Link
                href="/hub"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/hub"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Verifikasi dan Etalase
              </Link>
              <Link
                href="/hub/pesanan"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/hub/pesanan"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Pesanan Masuk
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Petani (Desktop) */}
          {role === "PETANI" && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
              <Link
                href="/petani"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/petani"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Panen dan Penjualan
              </Link>
              <Link
                href="/petani/tambah"
                className="bg-emerald-800 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-900 transition font-medium shadow-xs flex items-center gap-1"
              >
                <span>+</span> Upload Panen
              </Link>
            </div>
          )}

          {/* Navigasi Khusus Admin (Desktop) */}
          {role === "ADMIN" && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg transition ${
                  pathname === "/admin"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Pusat Kontrol Admin
              </Link>
            </div>
          )}
        </div>

        {/* Sisi Kanan: Notifikasi, Identitas (farrel / PETANI), dan Logout */}
        <div className="flex gap-2 sm:gap-3 items-center">
          {/* Lonceng Notifikasi Terintegrasi */}
          <NotificationBell />

          {/* Identitas Pengguna + Label Peran (contoh: farel / HUB, farrel / PETANI) */}
          <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-gray-800 max-w-[130px] truncate" title={session.user?.name || username}>
              {username}
            </span>
            <span className="text-gray-400 font-light">/</span>
            <span className="font-bold text-emerald-800 uppercase text-[11px] tracking-wide">
              {role}
            </span>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/", redirect: true })}
            className="text-xs bg-white text-rose-600 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg font-semibold hover:bg-rose-50 transition border border-rose-200 cursor-pointer shadow-2xs"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top-1">
          <div className="text-[11px] text-gray-500 font-medium px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center">
            <span>Masuk: <strong className="text-gray-800">{username}</strong></span>
            <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px]">{role}</span>
          </div>

          {role === "RESTAURANT" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/restoran"
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === "/restoran"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Katalog Bahan
              </Link>
              <Link
                href="/restoran/pesanan"
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === "/restoran/pesanan"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Riwayat Pesanan
              </Link>
            </div>
          )}

          {role === "HUB" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/hub"
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === "/hub"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Verifikasi dan Etalase
              </Link>
              <Link
                href="/hub/pesanan"
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === "/hub/pesanan"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Pesanan Masuk
              </Link>
            </div>
          )}

          {role === "PETANI" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/petani"
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === "/petani"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Panen dan Penjualan
              </Link>
              <Link
                href="/petani/tambah"
                className="bg-emerald-800 text-white px-3 py-2 rounded-lg font-semibold text-xs shadow-xs text-center"
              >
                + Upload Panen Baru
              </Link>
            </div>
          )}

          {role === "ADMIN" && (
            <div className="flex flex-col gap-1 pt-1">
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  pathname === "/admin"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Pusat Kontrol Admin
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
