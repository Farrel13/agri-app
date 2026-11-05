import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-Memory store untuk fallback jika Redis belum terkonfigurasi (misal di local dev)
const memoryStore = new Map<string, RateLimitStore>();

// Bersihkan memory store berkala setiap 5 menit
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of memoryStore.entries()) {
      if (now > val.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (typeof (cleanupTimer as unknown as { unref?: () => void }).unref === "function") {
    (cleanupTimer as unknown as { unref: () => void }).unref();
  }
}

// Deteksi kredensial Upstash Redis 
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// Cache instance Ratelimit per parameter maxRequests & windowMs
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${maxRequests}_${windowMs}`;
  if (!upstashLimiters.has(key)) {
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    upstashLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
        analytics: true,
        prefix: "@agri_ratelimit",
      })
    );
  }
  return upstashLimiters.get(key)!;
}

function checkMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; limit: number; remaining: number; reset?: number } {
  const now = Date.now();
  const record = memoryStore.get(identifier);

  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    memoryStore.set(identifier, {
      count: 1,
      resetTime,
    });
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: resetTime,
    };
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  record.count += 1;
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    reset: record.resetTime,
  };
}

/**
 * Cek limit request menggunakan Upstash Redis 
 * dengan fallback otomatis ke In-Memory jika Redis belum disetup / terjadi kegagalan koneksi.
 * 
 * @param identifier IP, user ID, atau kunci identifikasi unik
 * @param maxRequests Batas jumlah request yang diizinkan 
 * @param windowMs Jendela waktu dalam milidetik 
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): Promise<{ success: boolean; limit: number; remaining: number; reset?: number }> {
  const limiter = getUpstashLimiter(maxRequests, windowMs);
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (err) {
      console.warn("[RateLimit] Upstash Redis request error, falling back to memory:", err);
      return checkMemoryRateLimit(identifier, maxRequests, windowMs);
    }
  }

  return checkMemoryRateLimit(identifier, maxRequests, windowMs);
}

/**
 * Helper untuk mengambil IP client dari request headers
 */
export function getClientIp(request?: Request | Headers | null): string {
  if (!request) return "127.0.0.1";

  const headers = request instanceof Request ? request.headers : request;
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "127.0.0.1";
}

/**
 * Helper untuk mengembalikan respons standar HTTP 429 Too Many Requests
 */
export function rateLimitResponse(message?: string) {
  return NextResponse.json(
    {
      error:
        message ||
        "Terlalu banyak permintaan (Too Many Requests). Silakan coba lagi beberapa saat lagi.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": "60",
      },
    }
  );
}

/**
 * Helper untuk membatasi request di Server Actions
 */
export async function checkServerActionRateLimit(
  actionName: string,
  identifier: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): Promise<{ allowed: boolean; message?: string }> {
  const key = `action_${actionName}_${identifier}`;
  const check = await checkRateLimit(key, maxRequests, windowMs);
  if (!check.success) {
    return {
      allowed: false,
      message: "Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba kembali.",
    };
  }
  return { allowed: true };
}
