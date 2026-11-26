"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "PETANI",
    phoneNumber: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [regTicket, setRegTicket] = useState<string>("");
  const [faxNumber, setFaxNumber] = useState<string>(""); // Honeypot field
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Ambil ephemeral registration ticket bertanda tangan saat form pertama kali dimuat
  const loadTicket = () => {
    fetch("/api/register")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ticket) setRegTicket(data.ticket);
      })
      .catch((err) => console.error("Gagal mengambil tiket pendaftaran:", err));
  };

  useEffect(() => {
    loadTicket();
  }, []);

  // Kriteria password
  const hasMinLen = formData.password.length >= 8;
  const hasUpper = /[A-Z]/.test(formData.password);
  const hasLower = /[a-z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);
  const isPasswordStrong = hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isPasswordStrong) {
      setError("Pastikan password memenuhi semua kriteria keamanan.");
      return;
    }

    if (!formData.street || !formData.city || !formData.phoneNumber) {
      setError("Mohon lengkapi alamat operasional dan nomor telepon aktif.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          faxNumber,
          regTicket,
        }),
      });

      if (res.ok) {
        router.push("/login?registered=true");
      } else {
        const data = await res.json();
        setError(data.message || "Gagal mendaftar");
        if (data.message && data.message.includes("tiket")) {
          loadTicket();
        }
      }
    } catch {
      setError("Terjadi kesalahan koneksi pada server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-10 px-4 font-sans">
      <div className="bg-white p-6 sm:p-10 rounded-2xl w-full max-w-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Judul & Subjudul */}
        <div className="text-center md:text-left border-b border-gray-100 pb-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 mb-2">
            ← Kembali ke Beranda
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Daftar Akun AgriApp</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Buat akun untuk mengakses ekosistem rantai pasok.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 p-3.5 rounded-xl text-xs border border-rose-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Honeypot Field (Anti-Bot) */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none select-none"
            tabIndex={-1}
          >
            <label htmlFor="hp_fax_number">Nomor Fax Kantor</label>
            <input
              id="hp_fax_number"
              type="text"
              name="faxNumber"
              tabIndex={-1}
              autoComplete="off"
              value={faxNumber}
              onChange={(e) => setFaxNumber(e.target.value)}
            />
          </div>

          {/* Kelompok 1 — Identitas & Peran */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-bold text-gray-900">Identitas & Peran Akun</h2>
            </div>

            {/* Baris 1: Nama Lengkap / Usaha & Username */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nama Lengkap / Usaha
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="contoh: Restoran Padang Sari"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  placeholder="contoh: padangsari12"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>
            </div>

            {/* Baris 2: Email & Nomor WhatsApp / HP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@domain.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nomor WhatsApp / HP
                </label>
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="081234567890"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>
            </div>

            {/* Baris Penuh: Peran Akun */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Peran Akun
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition cursor-pointer"
              >
                <option value="PETANI">Petani (Pemasok Panen)</option>
                <option value="HUB">Toko Hub (Pengepul / Verifikator Panen)</option>
                <option value="RESTAURANT">Restoran / Pembeli Bisnis</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Pilih peran operasional Anda dalam siklus rantai pasok AgriApp.
              </p>
            </div>
          </div>

          {/* Kelompok 2 — Alamat Operasional */}
          <div className="pt-5 border-t border-gray-200 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-sm font-bold text-gray-900">Alamat Operasional</h2>
            </div>

            {/* Baris penuh: Alamat Jalan, Gedung / RT RW */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Alamat Jalan, Gedung / RT RW
              </label>
              <input
                type="text"
                required
                placeholder="Jl. Melati No. 45 RT 02/RW 05, Kelurahan Cibinong"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
              />
            </div>

            {/* Tiga kolom: Kota / Kab, Provinsi, dan Kode Pos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kota / Kab</label>
                <input
                  type="text"
                  required
                  placeholder="cth: Bogor"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Provinsi</label>
                <input
                  type="text"
                  required
                  placeholder="cth: Jawa Barat"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kode Pos</label>
                <input
                  type="text"
                  placeholder="cth: 16911"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                />
              </div>
            </div>
          </div>

          {/* Kelompok 3 — Keamanan */}
          <div className="pt-5 border-t border-gray-200 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-sm font-bold text-gray-900">Keamanan Akun</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg pl-3.5 pr-11 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition"
                  placeholder="Minimal 8 karakter kombinasi huruf besar, kecil, angka, simbol"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer transition"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {formData.password.length > 0 && (
                <div className="mt-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <p className="font-semibold text-gray-700">Syarat Minimal Karakter:</p>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${hasMinLen ? "text-emerald-700 font-semibold" : "text-gray-400"}`}>
                      <span>{hasMinLen ? "✓" : "○"}</span> Minimal 8 karakter
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUpper ? "text-emerald-700 font-semibold" : "text-gray-400"}`}>
                      <span>{hasUpper ? "✓" : "○"}</span> Huruf besar (A-Z)
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasLower ? "text-emerald-700 font-semibold" : "text-gray-400"}`}>
                      <span>{hasLower ? "✓" : "○"}</span> Huruf kecil (a-z)
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-700 font-semibold" : "text-gray-400"}`}>
                      <span>{hasNumber ? "✓" : "○"}</span> Angka (0-9)
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-emerald-700 font-semibold" : "text-gray-400"} col-span-2`}>
                      <span>{hasSpecial ? "✓" : "○"}</span> Simbol khusus (@, #, $, %, dll)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-800 text-white font-semibold py-3 px-4 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs disabled:opacity-50 cursor-pointer text-sm mt-4"
          >
            {loading ? "Sedang Mendaftarkan..." : "Daftar Akun Baru"}
          </button>
        </form>

        <div className="pt-2 text-center text-xs sm:text-sm text-gray-600 border-t border-gray-100">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="text-emerald-800 font-semibold hover:underline">
            Masuk di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
