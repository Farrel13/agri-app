"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await signIn("credentials", {
      username, // Sesuaikan dengan field di authOptions Anda
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Login gagal. Periksa kembali data Anda.");
    } else {
      router.push("/"); // Arahkan ke halaman utama setelah berhasil
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-12 px-4">
      <div className="bg-white p-6 sm:p-8 rounded-xl w-full max-w-md border border-slate-200 shadow-xs space-y-4">
        <div>
          <h1 className="text-xl font-bold text-center text-gray-900">Masuk ke AgriApp</h1>
          <p className="text-xs text-center text-gray-500 mt-1">Platform rantai pasok pangan digital</p>
        </div>

        {error && <div className="bg-rose-50/80 text-rose-700 p-3 rounded-md text-xs border border-rose-200">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:border-emerald-500 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-md hover:bg-emerald-700 transition"
          >
            Masuk
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          Belum punya akun?{" "}
          <Link href="/register" className="text-emerald-600 font-medium hover:underline">
            Daftar di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
