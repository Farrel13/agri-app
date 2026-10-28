/**
 * File Security & Magic Byte Inspector (Forensik Biner Berkas)
 * 
 * Melindungi dari:
 * 1. File Upload Polyglot (Skrip PHP/JS/HTML yang disamarkan dengan ekstensi .jpg/.png)
 * 2. MIME Spoofing (Client memalsukan Content-Type header)
 * 3. File Bomb / DoS Payload
 */

// Tanda biner asli (Magic Numbers) dari file gambar standar
const MAGIC_NUMBERS = {
  // JPEG / JPG: FF D8 FF
  JPEG: [0xff, 0xd8, 0xff],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // WEBP: RIFF .... WEBP
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46],
  WEBP_VP8: [0x57, 0x45, 0x42, 0x50],
};

// Pola biner mencurigakan (embedded malicious scripts / web shells / XSS)
const DANGEROUS_PATTERNS = [
  "<?php",
  "<?=",
  "<script",
  "javascript:",
  "eval(",
  "base64_decode(",
  "system(",
  "passthru(",
  "exec(",
  "shell_exec(",
];

export interface FileValidationResult {
  isValid: boolean;
  detectedType: "jpeg" | "png" | "webp" | "unknown";
  sanitizedExt: string;
  error?: string;
}

/**
 * Memeriksa header biner asli (Magic Bytes) dan memindai payload tersembunyi
 */
export function validateImageBuffer(buffer: Buffer, maxSizeBytes = 3 * 1024 * 1024): FileValidationResult {
  // 1. Cek ukuran file
  if (buffer.length > maxSizeBytes) {
    return {
      isValid: false,
      detectedType: "unknown",
      sanitizedExt: "",
      error: `Ukuran berkas melebihi batas maksimal (${maxSizeBytes / (1024 * 1024)}MB).`,
    };
  }

  if (buffer.length < 12) {
    return {
      isValid: false,
      detectedType: "unknown",
      sanitizedExt: "",
      error: "Berkas terlalu kecil atau korup.",
    };
  }

  // 2. Forensik Biner: Magic Byte Check
  let detectedType: "jpeg" | "png" | "webp" | "unknown" = "unknown";
  let sanitizedExt = "";

  // Check JPEG
  if (
    buffer[0] === MAGIC_NUMBERS.JPEG[0] &&
    buffer[1] === MAGIC_NUMBERS.JPEG[1] &&
    buffer[2] === MAGIC_NUMBERS.JPEG[2]
  ) {
    detectedType = "jpeg";
    sanitizedExt = ".jpg";
  }
  // Check PNG
  else if (
    MAGIC_NUMBERS.PNG.every((byte, idx) => buffer[idx] === byte)
  ) {
    detectedType = "png";
    sanitizedExt = ".png";
  }
  // Check WEBP (Header RIFF di awal dan 'WEBP' di byte 8..11)
  else if (
    MAGIC_NUMBERS.WEBP_RIFF.every((byte, idx) => buffer[idx] === byte) &&
    MAGIC_NUMBERS.WEBP_VP8.every((byte, idx) => buffer[idx + 8] === byte)
  ) {
    detectedType = "webp";
    sanitizedExt = ".webp";
  }

  if (detectedType === "unknown") {
    return {
      isValid: false,
      detectedType: "unknown",
      sanitizedExt: "",
      error: "Format berkas ditolak. Hanya file biner JPEG, PNG, atau WEBP asli yang diperbolehkan.",
    };
  }

  // 3. Forensik Biner: Scan Polyglot Payload / Shell script yang disisipkan di metadata gambar
  // Periksa 4KB awal dan seluruh teks ASCII
  const asciiContent = buffer.toString("latin1").toLowerCase();
  for (const pattern of DANGEROUS_PATTERNS) {
    if (asciiContent.includes(pattern)) {
      return {
        isValid: false,
        detectedType,
        sanitizedExt,
        error: "Anomali terdeteksi: Berkas gambar mengandung kode biner/skrip tidak aman (Polyglot).",
      };
    }
  }

  return {
    isValid: true,
    detectedType,
    sanitizedExt,
  };
}
