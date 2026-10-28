import { NextResponse } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const ipMap = new Map<string, RateLimitStore>();

// Bersihkan data lama berkala setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipMap.entries()) {
    if (now > val.resetTime) {
      ipMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * In-memory sliding-window limiter sederhana untuk Next.js Route Handlers
 * @param identifier IP atau User ID
 * @param maxRequests Maksimum request yang diperbolehkan
 * @param windowMs Jendela waktu dalam milidetik
 */
export function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): { success: boolean; limit: number; remaining: number } {
  const now = Date.now();
  const record = ipMap.get(identifier);

  if (!record || now > record.resetTime) {
    ipMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, limit: maxRequests, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { success: false, limit: maxRequests, remaining: 0 };
  }

  record.count += 1;
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
  };
}

export function rateLimitResponse() {
  return NextResponse.json(
    {
      error: "Terlalu banyak permintaan (Too Many Requests). Silakan coba lagi beberapa saat lagi.",
    },
    { status: 429 }
  );
}
