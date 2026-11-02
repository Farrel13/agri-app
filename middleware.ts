import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  async function (req) {
    const url = req.nextUrl.pathname;
    const token = req.nextauth.token;
    const role = token?.role;

    // 1. Jika user SUDAH login tapi mencoba akses halaman login/register, lempar ke beranda
    if (token && (url === "/login" || url === "/register")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 2. Kunci akses halaman Petani
    if (url.startsWith("/petani") && role !== "PETANI") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 3. Kunci akses halaman Hub
    if (url.startsWith("/hub") && role !== "HUB") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 4. Kunci akses halaman Restoran
    if (url.startsWith("/restoran") && role !== "RESTAURANT") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 5. Kunci akses halaman Admin
    if (url.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
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
  matcher: ["/", "/login", "/register", "/petani/:path*", "/hub/:path*", "/restoran/:path*", "/admin/:path*"],
};
