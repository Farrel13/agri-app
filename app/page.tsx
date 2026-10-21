// export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function HomePage() {
  // 1. Ambil sesi pengguna yang sedang login
  const session = await getServerSession(authOptions);

  // 2. Jika belum login, arahkan ke halaman login
  if (!session) {
    redirect("/api/auth/signin");
  }

  // 3. Jika sudah login, cek role dan arahkan ke dashboard masing-masing
  const role = session.user?.role;

  if (role === "PETANI") {
    redirect("/petani");
  } else if (role === "HUB") {
    redirect("/hub");
  } else if (role === "RESTAURANT") {
    redirect("/restoran");
  }

  // Fallback jika role tidak valid
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Akses Ditolak</h1>
        <p className="text-gray-600 mt-2">Role pengguna tidak dikenali.</p>
      </div>
    </div>
  );
}