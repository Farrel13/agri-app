import { URL } from "url";
import net from "net";
import { logWafEvent } from "./system-logger";

/**
 * Memeriksa apakah alamat IP merupakan IP privat, loopback, link-local, multicast, atau reserved
 */
function isPrivateIpAddress(ip: string): boolean {
  let cleanIp = ip.toLowerCase();
  if (cleanIp.startsWith("[") && cleanIp.endsWith("]")) {
    cleanIp = cleanIp.slice(1, -1);
  }

  const version = net.isIP(cleanIp);
  if (version === 4) {
    const parts = cleanIp.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true; // Malformed IPv4

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private network Class A)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback localhost)
    if (parts[0] === 127) return true;
    // 100.64.0.0/10 (Shared Address Space / CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud Metadata AWS, GCP, Azure 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private network Class B: 172.16.x.x - 172.31.x.x)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private network Class C)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // TEST-NET documentation
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
    if (parts[0] >= 224) return true;

    return false;
  }

  if (version === 6) {
    // IPv6 Loopback, unspecified, unique local (fc00::/7), link-local (fe80::/10), IPv4-mapped
    if (cleanIp === "::1" || cleanIp === "::") return true;
    if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
    if (
      cleanIp.startsWith("fe8") ||
      cleanIp.startsWith("fe9") ||
      cleanIp.startsWith("fea") ||
      cleanIp.startsWith("feb")
    ) {
      return true;
    }
    if (cleanIp.includes("::ffff:")) {
      const ipv4Part = cleanIp.split("::ffff:")[1];
      if (ipv4Part) {
        if (net.isIPv4(ipv4Part)) {
          return isPrivateIpAddress(ipv4Part);
        }
        // Hexadecimal format e.g. ::ffff:7f00:1
        return true;
      }
      return true;
    }
    return false;
  }

  return false;
}

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
    let cleanHost = hostname;
    if (cleanHost.startsWith("[") && cleanHost.endsWith("]")) {
      cleanHost = cleanHost.slice(1, -1);
    }

    // 2. Blokir nama host localhost dan metadata AWS/Cloud
    if (
      cleanHost === "localhost" ||
      cleanHost.endsWith(".localhost") ||
      cleanHost.endsWith(".internal") ||
      cleanHost.endsWith(".local") ||
      cleanHost.endsWith(".onion")
    ) {
      logWafEvent({
        severity: "ALERT",
        action: "SSRF_HOST_BLOCKED",
        message: `Percobaan SSRF ke host terlarang: ${cleanHost}`,
        metadata: { url: rawUrl, host: cleanHost },
      }).catch(() => {});
      return { isSafe: false, reason: "Akses ke host internal/lokal dilarang." };
    }

    // 3. Blokir alamat IP privat, loopback, link-local, dan cloud metadata
    if (isPrivateIpAddress(cleanHost)) {
      logWafEvent({
        severity: "CRITICAL",
        action: "SSRF_PRIVATE_IP_BLOCKED",
        message: `Percobaan SSRF ke IP privat / metadata terlarang: ${cleanHost}`,
        metadata: { url: rawUrl, ip: cleanHost },
      }).catch(() => {});
      return { isSafe: false, reason: "Akses ke alamat IP privat/internal server dilarang (Anti-SSRF)." };
    }

    return { isSafe: true };
  } catch {
    return { isSafe: false, reason: "Format URL tidak valid." };
  }
}
