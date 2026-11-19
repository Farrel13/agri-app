import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Helper terpusat untuk menginjeksi seluruh security headers pada setiap respons (termasuk error, redirect, dan API)
const applySecurityHeaders = (res: NextResponse) => {
  res.headers.set("X-DNS-Prefetch-Control", "on");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.vercel.app; font-src 'self' data:; connect-src 'self' https://*.vercel.app; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
  );
  return res;
};

// Store in-memory khusus Edge untuk Rate Limiting Brute Force Login
interface EdgeRateLimitRecord {
  count: number;
  resetTime: number;
}
const loginRateLimitMap = new Map<string, EdgeRateLimitRecord>();

function checkLoginEdgeRateLimit(
  ip: string,
  maxAttempts = 3,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    loginRateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (record.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxAttempts - record.count };
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;

  // Helper untuk mencocokkan route prefix dengan batas segmen '/' yang valid
  const matchRoutePrefix = (path: string, prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);

  // Helper untuk redirect dengan header anti-cache & security headers lengkap
  const createRedirect = (target: string) => {
    const res = NextResponse.redirect(new URL(target, req.url));
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return applySecurityHeaders(res);
  };

  // Helper untuk respons blokir WAF dengan status error dan security headers lengkap
  const createBlockedResponse = (message: string, status = 403) => {
    const res = new NextResponse(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
    return applySecurityHeaders(res);
  };

  // Validasi CORS & Isolasi Domain: Mencegah domain pihak ketiga sembarang membaca respons API
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") || "";
  const isAllowedOrigin =
    !origin ||
    origin.includes(host) ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.endsWith(".vercel.app");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin) {
      return applySecurityHeaders(new NextResponse(null, { status: 403 }));
    }
    const preflightRes = new NextResponse(null, { status: 204 });
    preflightRes.headers.set("Access-Control-Allow-Origin", origin || "");
    preflightRes.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    preflightRes.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    preflightRes.headers.set("Access-Control-Allow-Credentials", "true");
    preflightRes.headers.set("Vary", "Origin");
    return applySecurityHeaders(preflightRes);
  }

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

  // 0. RATE LIMITING LOGIN: Blokir brute-force login pada Vercel Edge dengan status 429
  if (req.method === "POST" && url.includes("/api/auth/callback/credentials")) {
    const clientIp =
      req.headers.get("x-vercel-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateCheck = checkLoginEdgeRateLimit(clientIp, 3, 60 * 1000);
    if (!rateCheck.allowed) {
      sendWafAlert(
        "AUTH_BRUTE_FORCE_BLOCKED",
        `Percobaan brute-force login terdeteksi dari IP ${clientIp}. Diblokir oleh Rate Limiter Edge.`,
        "SECURITY_ALERT",
        { ip: clientIp, endpoint: url }
      );

      const rateLimitRes = new NextResponse(
        JSON.stringify({
          error: "Terlalu banyak percobaan login gagal. Silakan coba lagi setelah 1 menit.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
      return applySecurityHeaders(rateLimitRes);
    }
  }

  // 1. INSPEKSI WAF (Web Application Firewall) - Mencegah ancaman OWASP Top 10
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
      return createBlockedResponse("Permintaan diblokir oleh WAF AgriApp (Path Traversal terdeteksi).");
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
      return createBlockedResponse("Akses ditolak oleh Firewall Keamanan Sistem.");
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
      return createBlockedResponse("Permintaan diblokir oleh WAF AgriApp (Pola XSS terdeteksi).");
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
      return createBlockedResponse("Permintaan diblokir oleh WAF AgriApp (Pola SQL Injection terdeteksi).");
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

  // Teruskan request yang terotorisasi secara normal dengan seluruh security headers
  const res = NextResponse.next();
  if (origin && isAllowedOrigin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  return applySecurityHeaders(res);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
