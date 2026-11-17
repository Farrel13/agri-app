import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;

  // Helper untuk mencocokkan route prefix dengan batas segmen '/' yang valid
  const matchRoutePrefix = (path: string, prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);

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

  // Helper untuk mencatat WAF event asinkron
  const sendWafAlert = (
    action: string,
    message: string,
    severity = "ALERT",
    meta: Record<string, unknown> = {}
  ) => {
    try {
      const wafLogUrl = new URL("/api/waf/log", req.url).toString();
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";
      fetch(wafLogUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity,
          action,
          message,
          endpoint: url,
          method: req.method,
          ipAddress: ip,
          userAgent: req.headers.get("user-agent"),
          metadata: meta,
        }),
      }).catch(() => {});
    } catch {}
  };

  // 0. INSPEKSI WAF (Web Application Firewall) - Mencegah ancaman OWASP Top 10
  if (url !== "/api/waf/log") {
    const fullQuery = (req.nextUrl.search || "").toLowerCase();
    const fullPath = url.toLowerCase();

    // Deteksi Path Traversal (Directory Traversal)
    if (
      fullPath.includes("../") ||
      fullPath.includes("..\\") ||
      fullQuery.includes("../") ||
      fullQuery.includes("..%2f")
    ) {
      sendWafAlert(
        "PATH_TRAVERSAL_ATTACK",
        `Akses diblokir oleh WAF: Percobaan Path Traversal terdeteksi pada '${url}'`,
        "CRITICAL",
        { url, search: req.nextUrl.search }
      );
      return new NextResponse(
        JSON.stringify({ error: "Permintaan diblokir oleh WAF AgriApp (Path Traversal terdeteksi)." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deteksi Probe Berkas Sensitif / Scanning Bot
    if (
      fullPath.includes("/.env") ||
      fullPath.includes("/.git") ||
      fullPath.includes("wp-login") ||
      fullPath.includes("phpmyadmin") ||
      fullPath.includes("xmlrpc.php")
    ) {
      sendWafAlert(
        "SENSITIVE_FILE_PROBE",
        `Akses diblokir oleh WAF: Pemindaian berkas/path sensitif terdeteksi pada '${url}'`,
        "CRITICAL",
        { url }
      );
      return new NextResponse(
        JSON.stringify({ error: "Akses ditolak oleh Firewall Keamanan Sistem." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deteksi Pola XSS (Cross-Site Scripting) dalam query URL
    if (
      fullQuery.includes("<script") ||
      fullQuery.includes("javascript:") ||
      fullQuery.includes("onerror=") ||
      fullQuery.includes("onload=")
    ) {
      sendWafAlert(
        "XSS_ATTACK_DETECTED",
        `Akses diblokir oleh WAF: Injeksi Cross-Site Scripting (XSS) dalam parameter URL`,
        "ALERT",
        { search: req.nextUrl.search }
      );
      return new NextResponse(
        JSON.stringify({ error: "Permintaan diblokir oleh WAF AgriApp (Pola XSS terdeteksi)." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deteksi Pola SQL Injection dalam query URL
    if (
      fullQuery.includes("union select") ||
      fullQuery.includes("union+select") ||
      fullQuery.includes(" 1=1") ||
      fullQuery.includes("+1=1") ||
      fullQuery.includes("sleep(")
    ) {
      sendWafAlert(
        "SQL_INJECTION_DETECTED",
        `Akses diblokir oleh WAF: Pola SQL Injection terdeteksi dalam kueri URL`,
        "CRITICAL",
        { search: req.nextUrl.search }
      );
      return new NextResponse(
        JSON.stringify({ error: "Permintaan diblokir oleh WAF AgriApp (Pola SQL Injection terdeteksi)." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

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

  // 1. Jika belum login dan mencoba mengakses protected routes
  const isProtected =
    matchRoutePrefix(url, "/petani") ||
    matchRoutePrefix(url, "/hub") ||
    matchRoutePrefix(url, "/restoran") ||
    matchRoutePrefix(url, "/admin");

  if (isProtected && !token) {
    if (matchRoutePrefix(url, "/admin")) {
      sendWafAlert(
        "UNAUTHORIZED_ADMIN_ACCESS",
        `Percobaan akses tidak terotorisasi ke modul Administrator dari user anonim.`,
        "ALERT",
        { url }
      );
    }

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
  if (matchRoutePrefix(url, "/admin") && role !== "ADMIN") {
    sendWafAlert(
      "RBAC_BYPASS_ATTEMPT",
      `User '${token?.username}' dengan role '${role}' mencoba membobol modul Administrator. Akses ditolak.`,
      "ALERT",
      { username: token?.username, role, targetUrl: url }
    );
    return createRedirect("/");
  }

  // Teruskan request yang terotorisasi secara normal
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
