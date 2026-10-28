# 10 Standar Keamanan OWASP & Implementasi Nyata di agri-app

Dokumen ini memetakan implementasi **OWASP Top 10** secara lengkap pada arsitektur aplikasi **agri-app (Next.js + Prisma)**.

---

### A01: Broken Access Control (Kontrol Akses Rusak)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  1. [`middleware.ts`](file:///C:/agri-app/middleware.ts): Memvalidasi session JWT dan role (`PETANI`, `HUB`, `RESTAURANT`) sebelum halaman dimuat.
  2. [`lib/auth-guard.ts`](file:///C:/agri-app/lib/auth-guard.ts): Helper `requireUser()` dan `requireRole()` untuk memverifikasi kepemilikan data di sisi server (Server Actions & API).

---

### A02: Cryptographic Failures (Kegagalan Kriptografi)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  1. Hashing password menggunakan `bcryptjs` (salt) di database PostgreSQL.
  2. Header `Strict-Transport-Security` (HSTS) aktif di [`next.config.ts`](file:///C:/agri-app/next.config.ts) memaksa komunikasi browser lewat TLS/HTTPS terenkripsi.

---

### A03: Injection (SQL / NoSQL / Command Injection)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  1. Semua query database dijalankan melalui **Prisma ORM** yang menerapkan *Parameterized Prepared Statements* secara otomatis, memutus celah `' OR 1=1 --`.
  2. Validasi tipe data numerik ketat (`Math.floor(Number(stock))`) di server action.

---

### A04: Insecure Design (Desain Sistem Tidak Aman)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  1. [`lib/rate-limit.ts`](file:///C:/agri-app/lib/rate-limit.ts): In-memory Rate Limiting per identitas IP & akun untuk mencegah spam request.
  2. Batasan payload `bodySizeLimit: "2mb"` di [`next.config.ts`](file:///C:/agri-app/next.config.ts).

---

### A05: Security Misconfiguration (Salah Konfigurasi Keamanan)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  1. Security Headers di [`next.config.ts`](file:///C:/agri-app/next.config.ts):
     - `Content-Security-Policy (CSP)` (Mencegah XSS)
     - `X-Frame-Options: DENY` (Mencegah Clickjacking)
     - `X-Content-Type-Options: nosniff` (Mencegah MIME Type Confusion)
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  2. `poweredByHeader: false` (Menghilangkan info fingerprint framework server).

---

### A06: Vulnerable and Outdated Components (Komponen Usang/Rentan)
* **Status**: ✅ **Terkendali**
* **Praktik**:
  - Gunakan `npm audit` secara berkala di terminal sebelum deployment.
  - Dependencies utama terkunci di [`package.json`](file:///C:/agri-app/package.json).

---

### A07: Identification and Authentication Failures (Kegagalan Autentikasi)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  1. [`app/api/auth/[...nextauth]/route.ts`](file:///C:/agri-app/app/api/auth/[...nextauth]/route.ts): Dilengkapi **Anti-Brute Force** (maksimal 5x gagal dalam 60 detik langsung dikunci sementara).
  2. Session expiration dibatasi maksimal 8 jam (`maxAge: 8 * 60 * 60`).

---

### A08: Software and Data Integrity Failures (Integritas Data & Upload Forensik)
* **Status**: ✅ **Terpasang**
* **Forensik Biner Berkas (Magic Byte & Polyglot Protection)**:
  - File: [`lib/file-validator.ts`](file:///C:/agri-app/lib/file-validator.ts) & [`app/petani/actions.ts`](file:///C:/agri-app/app/petani/actions.ts)
  - **Masalah**: Hacker mengupload skrip malware (PHP, JS, Shell) dengan hanya mengganti ekstensi file menjadi `.jpg` atau `.png`.
  - **Solusi**:
    1. **Magic Bytes Check**: Memeriksa header biner murni (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF...WEBP`). Jika byte header tidak cocok, berkas langsung ditolak!
    2. **Anti-Polyglot Scan**: Memindai biner berkas dari sisipan skrip berbahaya (`<?php`, `<script>`, `eval(`, `exec(`).
    3. **Randomized Filename**: Mengganti nama berkas dengan kriptografi acak (`crypto.randomBytes(16)`) agar tidak terkena serangan *Path Traversal*.

---

### A09: Security Logging and Monitoring Failures (Audit Log Keamanan)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  - File: [`lib/security-logger.ts`](file:///C:/agri-app/lib/security-logger.ts)
  - Mencatat event kegagalan autentikasi, brute-force, dan akses ilegal dengan format `[SECURITY_AUDIT]`.
  - Dilengkapi fitur **Redaction Otomatis** sehingga password, token, dan data sensitif tidak akan pernah bocor ke file log/konsol.

---

### A10: Server-Side Request Forgery (SSRF)
* **Status**: ✅ **Terpasang**
* **Implementasi**:
  - File: [`lib/ssrf-guard.ts`](file:///C:/agri-app/lib/ssrf-guard.ts)
  - Melindungi server dari permintaan ke alamat internal (Localhost `127.0.0.1`, IP privat `10.x`, `192.168.x`, dan Cloud Instance Metadata `169.254.169.254`).
