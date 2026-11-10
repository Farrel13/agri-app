import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Jika sudah login, langsung alihkan ke dashboard role masing-masing
  if (session) {
    const role = session.user?.role;
    if (role === "PETANI") redirect("/petani");
    if (role === "HUB") redirect("/hub");
    if (role === "RESTAURANT") redirect("/restoran");
    if (role === "ADMIN") redirect("/admin");
  }

  // Jika belum login, tampilkan Landing Page Publik
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col font-sans">
      {/* Navbar sticky */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo & Badge */}
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold text-emerald-600">AgriApp</span>
            <span className="hidden sm:inline-block text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
              Farm-to-Table B2B
            </span>
          </div>

          {/* Navigasi kanan */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-transparent hover:border-gray-200 transition"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
            >
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight tracking-tight">
              Bahan Baku Segar,<br className="hidden sm:block" /> Langsung dari Petani.
            </h1>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed max-w-lg mx-auto">
              Platform B2B rantai pasok pangan — Petani, Hub, dan Restoran terhubung
              dalam satu ekosistem terverifikasi.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                href="/register"
                className="w-full sm:w-auto px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition text-sm"
              >
                Mulai Berbelanja
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-7 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold border border-gray-300 rounded-xl transition text-sm"
              >
                Pelajari Cara Kerja
              </Link>
            </div>

            {/* Feature Cards */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {/* Kartu 1 */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Langsung dari Petani</h3>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  Produk pangan segar dengan foto panen real-time, terbarui tiap 24 jam.
                </p>
              </div>

              {/* Kartu 2 */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Dikurasi oleh Hub</h3>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  Setiap bahan melewati verifikasi mutu oleh Toko Hub terpercaya sebelum dijual.
                </p>
              </div>

              {/* Kartu 3 */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Pengiriman ke Dapur</h3>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  Pesan pagi, estimasi tiba di dapur restoran Anda hari itu juga.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer minimal */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <p className="text-xs text-gray-400 text-center">
          © 2026 AgriApp Indonesia · Platform rantai pasok pangan
        </p>
      </footer>
    </div>
  );
}
