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

  // Helper untuk mencocokkan route prefix dengan batas segmen '/' yang valid
  const matchRoutePrefix = (path: string, prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);

  // 1. Jika belum login dan mencoba mengakses protected routes
  const isProtected =
    matchRoutePrefix(url, "/petani") ||
    matchRoutePrefix(url, "/hub") ||
    matchRoutePrefix(url, "/restoran") ||
    matchRoutePrefix(url, "/admin");

  if (isProtected && !token) {
    // Pastikan path callbackUrl valid relatif lokal
    const safeUrl =
      url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")
        ? url
        : "/";
    return createRedirect(`/login?callbackUrl=${encodeURIComponent(safeUrl)}`);
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
  if (matchRoutePrefix(url, "/petani") && role !== "PETANI") return createRedirect("/");
  if (matchRoutePrefix(url, "/hub") && role !== "HUB") return createRedirect("/");
  if (matchRoutePrefix(url, "/restoran") && role !== "RESTAURANT") return createRedirect("/");
  if (matchRoutePrefix(url, "/admin") && role !== "ADMIN") return createRedirect("/");

  // Teruskan request yang terotorisasi secara normal
  return NextResponse.next();
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
