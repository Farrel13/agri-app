import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Client Singleton untuk Serverless & Local Development.
 *
 * Catatan Deployment Serverless (Vercel):
 * - Singleton ini mencegah re-instansiasi berulang pada container yang sama (warm container).
 * - Untuk mencegah kehabisan koneksi PostgreSQL saat auto-scaling multi-instance,
 *   gunakan connection pooler (misal: Supabase port 6543 dengan ?pgbouncer=true atau Prisma Accelerate)
 *   pada environment variable DATABASE_URL di dashboard Vercel.
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Selalu simpan di globalThis agar digunakan kembali pada warm container di semua environment
globalForPrisma.prisma = prisma;
