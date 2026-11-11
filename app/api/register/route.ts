import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-logger";
import {
  generateRegistrationTicket,
  verifyRegistrationTicket,
} from "@/lib/registration-ticket";

/**
 * GET: Mengambil ephemeral registration ticket bertanda tangan HMAC
 * Dipanggil saat form register dimuat di browser pengguna
 */
export async function GET() {
  const ticket = generateRegistrationTicket();
  return NextResponse.json({ ticket });
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();

    const {
      name,
      email,
      username,
      password,
      role,
      phoneNumber,
      street,
      city,
      province,
      postalCode,
      faxNumber, // 1. Honeypot Field (harus selalu kosong untuk manusia)
      regTicket, // 2. Ephemeral Session Ticket + Time-check
    } = body;

    // 1. UJI HONEYPOT: Jika field faxNumber terisi, request dipastikan berasal dari automated bot
    if (faxNumber && typeof faxNumber === "string" && faxNumber.trim().length > 0) {
      logSecurityEvent({
        level: "SECURITY_ALERT",
        action: "HONEYPOT_TRIGGERED",
        ip: clientIp,
        details: { field: "faxNumber", honeypotValue: faxNumber.slice(0, 50) },
      });
      return NextResponse.json(
        { message: "Terjadi kesalahan saat memproses data pendaftaran." },
        { status: 400 }
      );
    }

    // 2. UJI EPHEMERAL TICKET & WAKTU PENGISIAN WAJAR (Minimum 3 detik, Maksimal 2 jam)
    const ticketCheck = verifyRegistrationTicket(regTicket, 3000, 2 * 60 * 60 * 1000);
    if (!ticketCheck.valid) {
      logSecurityEvent({
        level: "WARN",
        action: `REGISTRATION_TICKET_${ticketCheck.reason}`,
        ip: clientIp,
        details: { reason: ticketCheck.reason, elapsedMs: ticketCheck.elapsedMs },
      });
      return NextResponse.json(
        { message: ticketCheck.message || "Validasi formulir pendaftaran gagal." },
        { status: 400 }
      );
    }

    // 3. RATE LIMITING BERLAPIS (NAT-FRIENDLY)
    // a. Limit per Registration Ticket: Maksimal 3 kali submit per tiket sesi form
    const ticketRate = await checkRateLimit(`reg_ticket_${ticketCheck.ticketId}`, 3, 60 * 1000);
    if (!ticketRate.success) {
      return rateLimitResponse("Terlalu banyak percobaan pada formulir ini. Silakan muat ulang halaman.");
    }

    // b. Limit per Target Email (jika diisi)
    if (email && typeof email === "string") {
      const emailRate = await checkRateLimit(`reg_email_${email.toLowerCase().trim()}`, 2, 60 * 1000);
      if (!emailRate.success) {
        return rateLimitResponse("Terlalu banyak permintaan untuk alamat email ini. Tunggu 1 menit.");
      }
    }

    // c. Limit per IP yang lebih ramah NAT (30 pendaftaran per 5 menit)
    // Karena bot sudah difilter oleh Honeypot & Time-check, kuota IP diperluas agar aman untuk banyak orang di balik NAT/WiFi kantor
    const ipRate = await checkRateLimit(`register_ip_${clientIp}`, 30, 5 * 60 * 1000);
    if (!ipRate.success) {
      logSecurityEvent({
        level: "WARN",
        action: "REGISTER_IP_RATE_LIMIT_EXCEEDED",
        ip: clientIp,
        details: { endpoint: "/api/register" },
      });
      return rateLimitResponse("Batas pendaftaran dari jaringan ini tercapai. Silakan coba lagi nanti.");
    }

    if (!name || !email || !username || !password || !role) {
      return NextResponse.json({ message: "Semua data akun wajib diisi." }, { status: 400 });
    }

    // Cegah Privilege Escalation: Hanya role PETANI, HUB, atau RESTAURANT yang boleh didaftarkan ke publik
    const ALLOWED_PUBLIC_ROLES = ["PETANI", "HUB", "RESTAURANT"];
    if (!ALLOWED_PUBLIC_ROLES.includes(role)) {
      logSecurityEvent({
        level: "SECURITY_ALERT",
        action: "PRIVILEGE_ESCALATION_ATTEMPT",
        ip: clientIp,
        details: { attemptedRole: role, username, email },
      });
      return NextResponse.json(
        { message: "Pilihan peran (role) pendaftaran tidak valid." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Format email tidak valid." }, { status: 400 });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          message:
            "Password harus minimal 8 karakter dan kombinasi huruf besar, kecil, angka, serta simbol khusus.",
        },
        { status: 400 }
      );
    }

    // Cek apakah username sudah dipakai
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ message: "Username sudah terdaftar." }, { status: 400 });
    }

    // Cek apakah email sudah dipakai
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json({ message: "Alamat email sudah digunakan." }, { status: 400 });
    }

    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan data User
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        role,
      },
    });

    // Jika data alamat diisi, buat entitas Address primer
    if (street && city) {
      const defaultLabel =
        role === "RESTAURANT"
          ? "Dapur Utama"
          : role === "HUB"
          ? "Gudang Hub"
          : "Lokasi Lahan Tani";

      await prisma.address.create({
        data: {
          label: defaultLabel,
          recipientName: name,
          phoneNumber: phoneNumber || "081234567890",
          street,
          city,
          province: province || "DKI Jakarta",
          postalCode: postalCode || null,
          isPrimary: true,
          userId: newUser.id,
        },
      });
    }

    return NextResponse.json({ message: "Registrasi akun berhasil!" }, { status: 201 });
  } catch (error) {
    console.error("Error register:", error);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
