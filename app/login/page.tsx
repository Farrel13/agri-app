"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper untuk memvalidasi callbackUrl lokal yang aman (Cegah Open Redirect & DOM XSS)
  const getSafeCallbackUrl = (raw: string | null): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (
      trimmed.startsWith("/") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/\\") &&
      !trimmed.startsWith("/login")
    ) {
      return trimmed;
    }
    return null;
  };

  // Jika sudah terotentikasi, otomatis alihkan ke halaman callbackUrl atau dashboard role
  useEffect(() => {
    if (status === "authenticated" && session) {
      const params = new URLSearchParams(window.location.search);
      const safeCallback = getSafeCallbackUrl(params.get("callbackUrl"));
      if (safeCallback) {
        router.replace(safeCallback);
      } else {
        const role = session.user?.role;
        if (role === "PETANI") router.replace("/petani");
        else if (role === "HUB") router.replace("/hub");
        else if (role === "RESTAURANT") router.replace("/restoran");
        else if (role === "ADMIN") router.replace("/admin");
        else router.replace("/");
      }
    }
  }, [status, session, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Login gagal. Periksa kembali username dan password Anda.");
    } else {
      const params = new URLSearchParams(window.location.search);
      const safeCallback = getSafeCallbackUrl(params.get("callbackUrl"));
      router.replace(safeCallback || "/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      <div className="hidden md:flex md:w-1/2 lg:w-5/12 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white p-8 lg:p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-lg font-bold text-white shadow-xs">
              
            </span>
            <span className="text-xl font-bold tracking-tight text-white">AgriApp</span>
          </Link>

          <div className="pt-8 space-y-3">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-700/60 border border-emerald-500/30 text-emerald-200">
              Jaringan Rantai Pasok Pangan Terpadu
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight">
              Masuk ke ruang kerja rantai pasok
            </h2>
            <p className="text-emerald-100/80 text-sm leading-relaxed">
              Integrasi langsung komoditas pertanian segar antara Petani Pemasok, Toko Hub, dan Restoran dengan transparansi stok serta efisiensi harga pangan.
            </p>
          </div>
        </div>

        {/* 3 Pilar Rantai Pasok */}
        <div className="relative z-10 space-y-3 my-8">
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center gap-3">
            <span className="text-lg"></span>
            <div>
              <p className="text-xs font-bold text-white">Petani Pemasok</p>
              <p className="text-[11px] text-emerald-100/70">Daftarkan panen, lacak penjualan, dan kelola modal tani.</p>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center gap-3">
            <span className="text-lg"></span>
            <div>
              <p className="text-xs font-bold text-white">Toko Hub Agregator</p>
              <p className="text-[11px] text-emerald-100/70">Verifikasi kualitas fisik pangan & pantau margin keuntungan bersih.</p>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center gap-3">
            <span className="text-lg"></span>
            <div>
              <p className="text-xs font-bold text-white">Restoran & Pembeli</p>
              <p className="text-[11px] text-emerald-100/70">Pesan bahan baku segar terverifikasi dengan surat jalan pengiriman.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-4 border-t border-emerald-700/40 text-xs text-emerald-200/60 flex justify-between items-center">
          <span>&copy; {new Date().getFullYear()} AgriApp Digital Hub</span>
          <span className="text-[11px] text-emerald-300">v2.1 Stable</span>
        </div>
      </div>

      {/* Sisi Kanan: Form Login di Tengah Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white p-7 sm:p-9 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Masuk ke AgriApp</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Platform rantai pasok pangan digital</p>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-700 p-3.5 rounded-xl text-xs border border-rose-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                spellCheck={false}
                required
                placeholder="cth: padangsari12"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Masukkan kata sandi akun Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-3.5 pr-11 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer transition"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    // Eye slash icon
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-800 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs disabled:opacity-50 cursor-pointer text-sm mt-2"
            >
              {loading ? "Memproses Masuk..." : "Masuk"}
            </button>
          </form>

          <div className="pt-2 text-center text-xs sm:text-sm text-gray-600 border-t border-gray-100">
            Belum punya akun?{" "}
            <Link href="/register" className="text-emerald-800 font-semibold hover:underline">
              Daftar di sini
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
