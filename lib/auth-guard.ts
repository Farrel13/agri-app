import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@prisma/client";

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Validasi sesi pengguna & role di Server Actions atau API Route
 */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    throw new AuthError("Akses ditolak: Silakan login terlebih dahulu.", 401);
  }
  return session.user;
}

/**
 * Validasi bahwa user yang login memiliki role yang diizinkan
 */
export async function requireRole(allowedRoles: Role[]) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role as Role)) {
    throw new AuthError("Akses ditolak: Anda tidak memiliki hak akses untuk tindakan ini.", 403);
  }
  return user;
}
