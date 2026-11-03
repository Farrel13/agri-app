import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  async function middleware(req) {
    const url = req.nextUrl.pathname;
    const token = req.nextauth.token;
    const role = token?.role;

    // Helper to create response with no-cache headers
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

    // 1. Jika user SUDAH login tapi mencoba akses halaman login/register, lempar ke beranda
    if (token && (url === "/login" || url === "/register")) {
      return createRedirect("/");
    }

    // 2. Kunci akses halaman Petani
    if (url.startsWith("/petani") && role !== "PETANI") {
      return createRedirect("/");
    }

    // 3. Kunci akses halaman Hub
    if (url.startsWith("/hub") && role !== "HUB") {
      return createRedirect("/");
    }

    // 4. Kunci akses halaman Restoran
    if (url.startsWith("/restoran") && role !== "RESTAURANT") {
      return createRedirect("/");
    }

    // 5. Kunci akses halaman Admin
    if (url.startsWith("/admin") && role !== "ADMIN") {
      return createRedirect("/");
    }

    // Pass through dengan anti-cache header untuk protected pages
    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;

        // Halaman landing page, login, register, dan cron API boleh diakses tanpa token
        if (
          path === "/" ||
          path === "/login" ||
          path === "/register" ||
          path.startsWith("/api/cron")
        ) {
          return true;
        }

        // Halaman dashboard lainnya WAJIB memiliki token (harus login)
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/petani/:path*",
    "/hub/:path*",
    "/restoran/:path*",
    "/admin/:path*",
  ],
};
