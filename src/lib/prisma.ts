import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import prismaPackage from "@/generated/prisma/package.json";

/**
 * Prisma embeds a content hash in the generated package name. When
 * `prisma generate` runs, that hash changes — use it to drop a stale
 * global client that would otherwise keep serving an outdated datamodel
 * across HMR / long-lived `next dev` processes.
 */
const GENERATED_CLIENT_ID = prismaPackage.name;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientId?: string;
  prismaPool?: Pool;
};

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  globalForPrisma.prismaPool = pool;
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function getPrisma(): PrismaClient {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (
    isDevelopment &&
    globalForPrisma.prisma &&
    globalForPrisma.prismaClientId !== GENERATED_CLIENT_ID
  ) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    void globalForPrisma.prismaPool?.end().catch(() => undefined);
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaPool = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaClientId = GENERATED_CLIENT_ID;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrisma();
