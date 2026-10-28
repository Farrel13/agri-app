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
    role: "PETANI", // Default role
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

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setError(data.message || "Gagal mendaftar");
      }
    } catch {
      setError("Terjadi kesalahan pada server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Daftar Akun Baru</h1>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Email</label>
            <input
              type="email"
              required
              placeholder="nama@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="budi_tani"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              placeholder="Minimal 8 karakter kombinasi"
            />
            {formData.password.length > 0 && (
              <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border text-xs space-y-1">
                <p className="font-medium text-gray-600 mb-1">Syarat Password:</p>
                <div className={`flex items-center gap-1.5 ${hasMinLen ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasMinLen ? "✓" : "○"}</span> Minimal 8 karakter
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasUpper ? "✓" : "○"}</span> Huruf besar (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasLower ? "✓" : "○"}</span> Huruf kecil (a-z)
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasNumber ? "✓" : "○"}</span> Angka (0-9)
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                  <span>{hasSpecial ? "✓" : "○"}</span> Karakter khusus/simbol (@, #, $, dll)
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Daftar Sebagai</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
            >
              <option value="PETANI">Petani</option>
              <option value="HUB">Hub</option>
              <option value="RESTAURANT">Restoran</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 mt-4 cursor-pointer text-sm"
          >
            {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
            Login di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
