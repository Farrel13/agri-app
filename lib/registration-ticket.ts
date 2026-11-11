import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "agri_app_secure_registration_salt_2026";

export interface TicketValidationResult {
  valid: boolean;
  ticketId?: string;
  reason?: "INVALID_FORMAT" | "INVALID_SIGNATURE" | "TOO_FAST" | "EXPIRED";
  message?: string;
  elapsedMs?: number;
}

/**
 * Membuat Ephemeral Registration Ticket bertanda tangan HMAC.
 * Tiket ini memuat timestamp saat form dibuka oleh client dan nonce acak.
 */
export function generateRegistrationTicket(): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${timestamp}:${nonce}`;
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${timestamp}.${nonce}.${signature}`;
}

/**
 * Memvalidasi tiket registrasi:
 * 1. Menjaga integritas data via tanda tangan HMAC (mencegah pemalsuan timestamp)
 * 2. Waktu pengisian wajar: menolak request bot jika submit < minDurationMs (default 3 detik)
 * 3. Batas kadaluarsa tiket: menolak tiket jika form dibiarkan > maxDurationMs (default 2 jam)
 */
export function verifyRegistrationTicket(
  ticket: string | undefined | null,
  minDurationMs = 3000,
  maxDurationMs = 2 * 60 * 60 * 1000
): TicketValidationResult {
  if (!ticket || typeof ticket !== "string") {
    return {
      valid: false,
      reason: "INVALID_FORMAT",
      message: "Tiket pendaftaran tidak ditemukan. Silakan muat ulang halaman formulir.",
    };
  }

  const parts = ticket.split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      reason: "INVALID_FORMAT",
      message: "Format tiket pendaftaran tidak valid.",
    };
  }

  const [tsStr, nonce, signature] = parts;
  const timestamp = parseInt(tsStr, 10);

  if (isNaN(timestamp)) {
    return {
      valid: false,
      reason: "INVALID_FORMAT",
      message: "Timestamp tiket tidak valid.",
    };
  }

  // Verifikasi Tanda Tangan HMAC dengan timing-safe comparison
  const expectedPayload = `${timestamp}:${nonce}`;
  const expectedSignature = crypto.createHmac("sha256", SECRET).update(expectedPayload).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return {
      valid: false,
      reason: "INVALID_SIGNATURE",
      message: "Tanda tangan keamanan tiket tidak sah.",
    };
  }

  const now = Date.now();
  const elapsedMs = now - timestamp;

  // 1. Minimum Time Check: Manusia membutuhkan waktu minimal untuk mengisi data form
  if (elapsedMs < minDurationMs) {
    return {
      valid: false,
      reason: "TOO_FAST",
      elapsedMs,
      message: "Formulir dikirimkan terlalu cepat. Mohon periksa kembali data pendaftaran Anda.",
    };
  }

  // 2. Maximum Expiry Check: Tiket kadaluarsa jika form dibuka terlalu lama
  if (elapsedMs > maxDurationMs) {
    return {
      valid: false,
      reason: "EXPIRED",
      elapsedMs,
      message: "Sesi formulir pendaftaran telah kadaluarsa. Silakan muat ulang halaman.",
    };
  }

  return {
    valid: true,
    ticketId: nonce,
    elapsedMs,
  };
}
