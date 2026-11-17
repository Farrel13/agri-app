import { prisma } from "./prisma";
import { Prisma, type LogType, type LogSeverity } from "@prisma/client";

export interface SystemLogInput {
  type: LogType;
  severity?: LogSeverity;
  action: string;
  message: string;
  endpoint?: string | null;
  method?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Sanitasi data metadata agar tidak membocorkan informasi sensitif
 * (password, token, credential, cookie, session)
 */
export function sanitizeMetadata(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeMetadata);

  const clone: Record<string, unknown> = {};
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "creditcard",
    "authorization",
    "cookie",
    "session",
    "key",
  ];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      clone[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      clone[key] = sanitizeMetadata(value);
    } else {
      clone[key] = value;
    }
  }
  return clone;
}

/**
 * Menyimpan log sistem & keamanan secara asinkron ke PostgreSQL via Prisma
 * Tanpa memblokir alur utama eksekusi user jika terjadi kegagalan basis data
 */
export async function logSystemEvent({
  type,
  severity = "INFO",
  action,
  message,
  endpoint = null,
  method = null,
  ipAddress = null,
  userAgent = null,
  userId = null,
  metadata = null,
}: SystemLogInput) {
  const sanitizedMeta = metadata
    ? (sanitizeMetadata(metadata) as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  // Format log terstruktur ke console
  const logPrefix = `[${type}][${severity}][${action}]`;
  const consoleMsg = `${logPrefix} ${message} ${
    endpoint ? `(${method || "REQ"} ${endpoint})` : ""
  } - IP: ${ipAddress || "-"}`;

  if (severity === "CRITICAL" || severity === "ALERT") {
    console.error(consoleMsg);
  } else if (severity === "WARN") {
    console.warn(consoleMsg);
  } else {
    console.info(consoleMsg);
  }

  // Simpan secara persisten ke database
  try {
    return await prisma.systemLog.create({
      data: {
        type,
        severity,
        action,
        message,
        endpoint,
        method,
        ipAddress,
        userAgent: userAgent ? userAgent.substring(0, 255) : null,
        userId,
        metadata: sanitizedMeta,
      },
    });
  } catch (err) {
    console.error("[SystemLogger] Gagal menyimpan log ke database:", err);
    return null;
  }
}

/**
 * Shorthand untuk mencatat aktivitas WAF (Web Application Firewall)
 */
export function logWafEvent(params: Omit<SystemLogInput, "type">) {
  return logSystemEvent({
    ...params,
    type: "WAF",
  });
}

/**
 * Shorthand untuk mencatat aktivitas Server & Operasional Sistem
 */
export function logServerEvent(params: Omit<SystemLogInput, "type">) {
  return logSystemEvent({
    ...params,
    type: "SERVER",
  });
}

/**
 * Mengambil ringkasan metrik kesehatan server & sistem
 */
export async function getServerSystemMetrics() {
  const memUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  // Hitung latensi koneksi basis data
  let dbLatencyMs = -1;
  let dbStatus = "CONNECTED";
  try {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round(performance.now() - t0);
  } catch (e) {
    dbStatus = "DISCONNECTED";
    console.error("DB Ping Error:", e);
  }

  // Hitung statistik log
  const [totalWafLogs, totalServerLogs, criticalAlerts, recentWafThreats] =
    await Promise.all([
      prisma.systemLog.count({ where: { type: "WAF" } }),
      prisma.systemLog.count({ where: { type: { in: ["SERVER", "SECURITY", "AUTH"] } } }),
      prisma.systemLog.count({ where: { severity: { in: ["ALERT", "CRITICAL"] } } }),
      prisma.systemLog.count({
        where: {
          type: "WAF",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  // Cek status limiter (Redis / In-Memory)
  const isRedisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  );

  return {
    server: {
      uptimeSeconds,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      platform: process.platform,
      memory: {
        heapUsedMB: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      },
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      provider: "PostgreSQL (Neon)",
    },
    rateLimiter: {
      backend: isRedisConfigured ? "Upstash Redis (Serverless)" : "In-Memory Store (Fallback)",
      status: "ACTIVE",
    },
    stats: {
      totalWafLogs,
      totalServerLogs,
      criticalAlerts,
      recentWafThreats24h: recentWafThreats,
    },
  };
}
