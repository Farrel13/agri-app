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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Jika sudah terotentikasi, otomatis alihkan ke halaman callbackUrl atau dashboard role
  useEffect(() => {
    if (status === "authenticated" && session) {
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl");
      if (callbackUrl && !callbackUrl.startsWith("/login")) {
        window.location.href = callbackUrl;
      } else {
        const role = session.user?.role;
        if (role === "PETANI") window.location.href = "/petani";
        else if (role === "HUB") window.location.href = "/hub";
        else if (role === "RESTAURANT") window.location.href = "/restoran";
        else if (role === "ADMIN") window.location.href = "/admin";
        else window.location.href = "/";
      }
    }
  }, [status, session]);

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
      setError("Login gagal. Periksa kembali data Anda.");
    } else {
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl");
      window.location.href = callbackUrl && !callbackUrl.startsWith("/login") ? callbackUrl : "/";
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-md hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
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
