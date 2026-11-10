import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;

  // Cek apakah request memakai HTTPS (baik langsung atau via header reverse proxy di Vercel)
  const isHttps =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https" ||
    process.env.NODE_ENV === "production";

  // Coba ambil token JWT NextAuth dengan deteksi cookie yang sesuai
  let token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isHttps,
  });

  // Fallback: jika null, coba tanpa secureCookie
  if (!token && isHttps) {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: false,
    });
  }

  const role = token?.role;

  // Helper untuk redirect dengan header anti-cache
  const createRedirect = (target: string) => {
    const res = NextResponse.redirect(new URL(target, req.url));
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  };

  // 1. Jika belum login dan mencoba mengakses protected routes
  const isProtected =
    url.startsWith("/petani") ||
    url.startsWith("/hub") ||
    url.startsWith("/restoran") ||
    url.startsWith("/admin");

  if (isProtected && !token) {
    return createRedirect(`/login?callbackUrl=${encodeURIComponent(url)}`);
  }

  // 2. Jika SUDAH login tapi membuka halaman login atau register, redirect ke dashboard role masing-masing
  if (token && (url === "/login" || url === "/register")) {
    if (role === "PETANI") return createRedirect("/petani");
    if (role === "HUB") return createRedirect("/hub");
    if (role === "RESTAURANT") return createRedirect("/restoran");
    if (role === "ADMIN") return createRedirect("/admin");
    return createRedirect("/");
  }

  // 3. Batasi akses role (RBAC)
  if (url.startsWith("/petani") && role !== "PETANI") return createRedirect("/");
  if (url.startsWith("/hub") && role !== "HUB") return createRedirect("/");
  if (url.startsWith("/restoran") && role !== "RESTAURANT") return createRedirect("/");
  if (url.startsWith("/admin") && role !== "ADMIN") return createRedirect("/");

  // Teruskan request dengan no-cache header
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/petani/:path*",
    "/hub/:path*",
    "/restoran/:path*",
    "/admin/:path*",
  ],
};
