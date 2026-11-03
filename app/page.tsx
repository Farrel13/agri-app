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

  // Jika belum login, tampilkan Landing Page Publik yang sederhana dan bersih
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col font-sans">
      {/* Navbar Landing */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-600">AgriApp</span>
            <span className="hidden sm:inline-block ml-1 text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded">
              B2B Farm-to-Table
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-emerald-600 px-3 py-2 transition"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-md transition"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            Platform rantai pasok pangan terintegrasi
          </h1>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-lg mx-auto">
            Hubungkan petani langsung ke restoran melalui toko hub terverifikasi.
            Kelola stok, pesanan, dan pengiriman dalam satu platform.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition text-sm"
            >
              Daftar Sekarang
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-medium border border-gray-300 rounded-md transition text-sm"
            >
              Masuk
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 bg-gray-50 border-t border-gray-200 text-gray-500 text-center text-xs">
        <div className="max-w-5xl mx-auto px-4">
          <p>&copy; 2026 AgriApp Indonesia.</p>
        </div>
      </footer>
    </div>
  );
}
