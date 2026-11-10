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
                <div className="text-2xl mb-3">🌾</div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Langsung dari Petani
                </h3>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  Produk pangan segar dengan foto panen real-time, terbarui tiap 24 jam.
                </p>
              </div>

              {/* Kartu 2 */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Dikurasi oleh Hub
                </h3>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  Setiap bahan melewati verifikasi mutu oleh Toko Hub terpercaya sebelum dijual.
                </p>
              </div>

              {/* Kartu 3 */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="text-2xl mb-3">🚚</div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Pengiriman ke Dapur
                </h3>
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
