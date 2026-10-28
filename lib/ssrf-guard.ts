import { URL } from "url";

// Daftar IP address internal / private yang dilarang diakses oleh server (Anti-SSRF)
const BLOCKED_IP_PREFIXES = [
  "127.",        // Loopback localhost
  "10.",         // Class A Private network
  "172.16.",     // Class B Private network
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",    // Class C Private network
  "169.254.",    // Link-local / Cloud Instance Metadata (AWS, GCP, Azure metadata endpoint)
  "0.0.0.0",
  "::1",          // IPv6 localhost
  "fc00:",        // IPv6 Private
  "fe80:",        // IPv6 Link-local
];

/**
 * Memvalidasi apakah URL tujuan aman untuk di-fetch oleh server (OWASP A10: Anti-SSRF)
 */
export function isSafeUrl(rawUrl: string, allowedProtocols = ["https:"]): { isSafe: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);

    // 1. Wajibkan protokol aman (default hanya HTTPS)
    if (!allowedProtocols.includes(parsed.protocol)) {
      return { isSafe: false, reason: `Protokol ${parsed.protocol} dilarang. Hanya ${allowedProtocols.join(", ")} yang diizinkan.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Blokir nama host localhost dan metadata AWS/Cloud
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return { isSafe: false, reason: "Akses ke host internal/lokal dilarang." };
    }

    // 3. Blokir IP range privat dan metadata cloud
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname === prefix || hostname.startsWith(prefix)) {
        return { isSafe: false, reason: "Akses ke alamat IP privat/internal server dilarang (Anti-SSRF)." };
      }
    }

    return { isSafe: true };
  } catch {
    return { isSafe: false, reason: "Format URL tidak valid." };
  }
}
