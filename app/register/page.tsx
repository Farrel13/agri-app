"use client";

import { useState } from "react";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/login?registered=true");
      } else {
        const data = await res.json();
        setError(data.message || "Gagal mendaftar");
      }
    } catch {
      setError("Terjadi kesalahan koneksi pada server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="bg-white p-4 rounded-md w-full max-w-xl border border-gray-200">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-800">Daftar Akun AgriApp</h1>
          <p className="text-xs text-gray-500 mt-1">Buat akun untuk mengakses platform</p>
        </div>

        {error && (
          <div className="bg-white text-rose-500 p-3 rounded-md mb-4 text-sm border border-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nama Lengkap / Usaha
              </label>
              <input
                type="text"
                required
                placeholder="cth: Restoran Padang Sari"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                placeholder="cth: padangsari12"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="nama@domain.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nomor WhatsApp / HP
              </label>
              <input
                type="tel"
                required
                placeholder="081234567890"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Peran Akun
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 bg-white text-sm"
            >
              <option value="PETANI">Petani (Pemasok Panen)</option>
              <option value="HUB">Toko Hub (Pengepul / Verifikator Panen)</option>
              <option value="RESTAURANT">Restoran / Pembeli Bisnis</option>
            </select>
          </div>

          {/* Section Alamat */}
          <div className="pt-3 border-t border-gray-200">
            <h3 className="text-xs font-medium text-gray-700 mb-2">
              Alamat Operasional
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Alamat Jalan, Gedung / RT RW
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jl. Melati No. 45 RT 02/05"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kota / Kab</label>
                  <input
                    type="text"
                    required
                    placeholder="Jakarta Barat"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provinsi</label>
                  <input
                    type="text"
                    required
                    placeholder="DKI Jakarta"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kode Pos</label>
                  <input
                    type="text"
                    placeholder="11530"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section Password */}
          <div className="pt-3 border-t border-gray-200">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Kata Sandi (Password)
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
              placeholder="Minimal 8 karakter kombinasi"
            />
            {formData.password.length > 0 && (
              <div className="mt-2 p-2.5 bg-gray-50 rounded-md border border-gray-200 text-xs space-y-1">
                <p className="font-medium text-gray-700 mb-1">Syarat Keamanan Password:</p>
                <div className={`flex items-center gap-1.5 ${hasMinLen ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasMinLen ? "+" : "-"}</span> Minimal 8 karakter
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasUpper ? "+" : "-"}</span> Huruf besar (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasLower ? "+" : "-"}</span> Huruf kecil (a-z)
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasNumber ? "+" : "-"}</span> Angka (0-9)
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasSpecial ? "+" : "-"}</span> Simbol khusus (@, #, $, dll)
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-md hover:bg-emerald-700 transition disabled:opacity-50 mt-2 cursor-pointer text-sm"
          >
            {loading ? "Sedang Mendaftarkan..." : "Daftar Akun Baru"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="text-emerald-600 font-medium hover:underline">
            Masuk di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
