"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Navbar() {
  const { data: session, status } = useSession();

  // Jangan render apapun selama sesi masih di-load atau jika belum login
  if (status === "loading" || !session) return null;

  return (
    <nav className="bg-white shadow-sm border-b p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="font-bold text-emerald-600 text-lg">
          AgriApp
        </div>
        
        <div className="flex gap-4 items-center">
          <span className="text-sm text-gray-600">
            Halo, {session.user?.name} ({session.user?.role})
          </span>
          <Link 
            href="/api/auth/signout" 
            className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100"
          >
            Logout
          </Link>
        </div>
      </div>
    </nav>
  );
}