import { prisma } from "./prisma";

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
 */
export function logSecurityEvent({
  level,
  action,
  userId = null,
  ip = null,
  details = {},
}: SecurityLogParams) {
  const timestamp = new Date().toISOString();

  // Sanitasi detail agar tidak pernah membocorkan password atau kredensial rahasia
  let sanitizedDetails = details;
  if (typeof details === "object" && details !== null) {
    const clone = { ...details } as Record<string, unknown>;
    const sensitiveKeys = ["password", "token", "secret", "creditCard", "authorization"];
    for (const key of Object.keys(clone)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        clone[key] = "[REDACTED]";
      }
    }
    sanitizedDetails = clone;
  }

  const logPayload = {
    timestamp,
    level,
    action,
    userId,
    ip,
    details: sanitizedDetails,
  };

  const formattedLog = `[SECURITY_AUDIT] ${JSON.stringify(logPayload)}`;

  if (level === "SECURITY_ALERT" || level === "ERROR") {
    console.error(formattedLog);
  } else if (level === "WARN") {
    console.warn(formattedLog);
  } else {
    console.info(formattedLog);
  }
}
