import { logSystemEvent, logWafEvent, logServerEvent } from "./system-logger";
import type { LogSeverity } from "@prisma/client";

type LogLevel = "INFO" | "WARN" | "SECURITY_ALERT" | "ERROR";

interface SecurityLogParams {
  level: LogLevel;
  action: string;
  userId?: string | null;
  ip?: string | null;
  details?: Record<string, unknown> | string;
}

/**
 * Modul Logging Terstruktur untuk Audit Keamanan (OWASP A09)
 * - Mencegah kebocoran data sensitif (password, secret token, credential)
 * - Mencatat event anomali, serangan brute-force, dan aksi manipulasi role
 * - Terintegrasi dengan basis data PostgreSQL untuk visualisasi di Admin Dashboard
 */
export function logSecurityEvent({
  level,
  action,
  userId = null,
  ip = null,
  details = {},
}: SecurityLogParams) {
  // Mapping level ke LogSeverity Prisma
  let severity: LogSeverity = "INFO";
  if (level === "WARN") severity = "WARN";
  else if (level === "SECURITY_ALERT") severity = "ALERT";
  else if (level === "ERROR") severity = "CRITICAL";

  // Identifikasi tipe log (WAF / AUTH / SECURITY)
  let type: "WAF" | "SECURITY" | "AUTH" = "SECURITY";
  if (
    action.includes("WAF") ||
    action.includes("RATE_LIMIT") ||
    action.includes("INJECTION") ||
    action.includes("TRAVERSAL") ||
    action.includes("MAGIC_BYTES") ||
    action.includes("SSRF")
  ) {
    type = "WAF";
  } else if (action.startsWith("AUTH_")) {
    type = "AUTH";
  }

  const meta =
    typeof details === "string"
      ? { note: details }
      : (details as Record<string, unknown>);

  // Catat ke sistem log asinkron
  logSystemEvent({
    type,
    severity,
    action,
    message: `Kejadian Keamanan: ${action}`,
    ipAddress: ip,
    userId,
    metadata: meta,
  }).catch(() => {});
}

export { logSystemEvent, logWafEvent, logServerEvent };
