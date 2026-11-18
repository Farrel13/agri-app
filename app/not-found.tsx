import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-6xl font-black text-emerald-600 mb-2">404</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-gray-500 mb-6 text-sm">
          Alamat yang Anda tuju tidak tersedia atau telah dipindahkan.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-emerald-600 text-white font-medium text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
