"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function SessionWatcher() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // 1. Tangani BFCache (Back-Forward Cache): Jika halaman dipanggil kembali dari cache browser setelah logout
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // 2. Client-side guard: jika user sudah unauthenticated pada rute terlindungi, redirect segera ke /login
  useEffect(() => {
    const isProtectedRoute =
      pathname.startsWith("/petani") ||
      pathname.startsWith("/hub") ||
      pathname.startsWith("/restoran") ||
      pathname.startsWith("/admin");

    if (isProtectedRoute && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, pathname, router]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionWatcher />
      {children}
    </SessionProvider>
  );
}
