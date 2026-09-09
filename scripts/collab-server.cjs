#!/usr/bin/env node
/**
 * Production / Docker document collaboration server (Hocuspocus + Yjs).
 * Local: npm run dev:collab
 * Docker: started by docker-entrypoint.js alongside Next.js
 *
 * HMAC helpers are exported for tests. Listen() only runs when this file is main.
 * Keep token algorithm in sync with src/lib/collab-token.ts.
 */
"use strict";

const { createHmac, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const COLLAB_DEV_SECRET = "steward-collab-dev-secret";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return { key, val };
}

/** Load a dotenv file; never override keys already set (shell / earlier files). */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  let loaded = 0;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.val;
      loaded++;
    }
  }
  return loaded;
}

/**
 * Match Next.js env lookup order so `npm run dev:all` signs/verifies with the
 * same COLLAB_TOKEN_SECRET / SESSION_SECRET as the App Router.
 * https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
 */
function loadNextLikeEnv(rootDir) {
  const nodeEnv = process.env.NODE_ENV || "development";
  const files = [
    path.join(rootDir, `.env.${nodeEnv}.local`),
    ...(nodeEnv === "test" ? [] : [path.join(rootDir, ".env.local")]),
    path.join(rootDir, `.env.${nodeEnv}`),
    path.join(rootDir, ".env"),
  ];
  for (const file of files) {
    loadEnvFile(file);
  }
}

function getCollabSecret() {
  return (
    process.env.COLLAB_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    COLLAB_DEV_SECRET
  );
}

function collabSecretSource() {
  if (process.env.COLLAB_TOKEN_SECRET) return "COLLAB_TOKEN_SECRET";
  if (process.env.SESSION_SECRET) return "SESSION_SECRET";
  return "dev-default";
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function signCollabToken(payload, ttlSec = 3600, secret = getCollabSecret()) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac("sha256", secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function verifyCollabToken(token, secret = getCollabSecret()) {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", secret).update(data).digest();
  const actual = fromB64url(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(data).toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.documentId || !payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

function rewriteUnreachableListenHost(wsUrl) {
  return String(wsUrl || "")
    .replace(/\/\/0\.0\.0\.0\b/, "//127.0.0.1")
    .replace(/\/\/\[::\](?=\s|:|$|\/)/, "//[::1]");
}

function asUint8(bytes) {
  if (!bytes) return null;
  if (bytes instanceof Uint8Array) return bytes;
  if (Buffer.isBuffer(bytes)) return new Uint8Array(bytes);
  if (Array.isArray(bytes)) return Uint8Array.from(bytes);
  if (typeof bytes === "object" && Array.isArray(bytes.data)) {
    return Uint8Array.from(bytes.data);
  }
  try {
    return new Uint8Array(bytes);
  } catch {
    return null;
  }
}

function buildDatabaseUrl() {
  if (
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD &&
    process.env.DB_NAME
  ) {
    const user = encodeURIComponent(process.env.DB_USER);
    const pass = encodeURIComponent(process.env.DB_PASSWORD);
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || "5432";
    const name = process.env.DB_NAME;
    const sslmode = process.env.DB_SSLMODE || "disable";
    return `postgresql://${user}:${pass}@${host}:${port}/${name}?sslmode=${sslmode}`;
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  throw new Error(
    "[collab] Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (check .env and .env.local)",
  );
}

function loadPrismaClient() {
  const candidates = [
    path.join(__dirname, "..", "src", "generated", "prisma", "client"),
    path.join(__dirname, "..", "src", "generated", "prisma"),
  ];
  let lastErr;
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (mod && mod.PrismaClient) return mod.PrismaClient;
    } catch (err) {
      lastErr = err;
    }
  }
  const hint = lastErr && lastErr.message ? lastErr.message : "unknown error";
  throw new Error(
    `[collab] Prisma client not found. Run: npx prisma generate\n${hint}`,
  );
}

async function startCollabServer() {
  const { Server } = require("@hocuspocus/server");
  const Y = require("yjs");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { Pool } = require("pg");
  const PrismaClient = loadPrismaClient();

  const connectionString = buildDatabaseUrl();
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const port = Number(process.env.COLLAB_PORT || 1234);

  const server = Server.configure({
    name: "steward-collab",
    port,
    address: "0.0.0.0",
    async onAuthenticate({ token, documentName, connection }) {
      const payload = verifyCollabToken(token || "");
      if (!payload) {
        console.warn(
          `[collab] auth rejected for ${documentName} (invalid or expired token; secret=${collabSecretSource()})`,
        );
        throw new Error("Invalid collab token");
      }
      if (payload.documentId !== documentName) {
        console.warn(
          `[collab] auth rejected for ${documentName} (token document mismatch)`,
        );
        throw new Error("Document mismatch");
      }
      connection.readOnly = !payload.canWrite;
      return {
        user: {
          id: payload.userId,
          name: payload.userName,
          canWrite: payload.canWrite,
        },
      };
    },
    async onLoadDocument({ documentName, document }) {
      try {
        const row = await prisma.libraryDocument.findUnique({
          where: { id: documentName },
          select: { crdtState: true, body: true, contentJson: true },
        });
        const update = asUint8(row?.crdtState);
        if (update && update.length > 0) {
          Y.applyUpdate(document, update);
          return document;
        }

        const html =
          (row?.contentJson && typeof row.contentJson === "object"
            ? row.contentJson.html
            : null) ||
          row?.body ||
          "<p></p>";
        const fragment = document.getXmlFragment("default");
        if (fragment.length === 0 && html) {
          document.getMap("meta").set("seedHtml", html);
        }
        return document;
      } catch (err) {
        console.error(
          `[collab] onLoadDocument failed for ${documentName} — continuing in-memory:`,
          err,
        );
        return document;
      }
    },
    async onStoreDocument({ documentName, document }) {
      try {
        const update = Y.encodeStateAsUpdate(document);
        await prisma.libraryDocument.update({
          where: { id: documentName },
          data: { crdtState: Buffer.from(update) },
        });
      } catch (err) {
        console.error(
          `[collab] onStoreDocument failed for ${documentName}:`,
          err,
        );
      }
    },
  });

  await server.listen();
  console.log(`[collab] Hocuspocus listening on ws://0.0.0.0:${port}`);
  console.log(
    `[collab] token secret source: ${collabSecretSource()} (must match Next collab-token API)`,
  );
  console.log(
    `[collab] HTTP GET http://127.0.0.1:${port}/ → OK (health). Browsers use COLLAB_WS_URL.`,
  );

  async function shutdown() {
    try {
      await server.destroy();
    } catch {
      /* ignore */
    }
    try {
      await prisma.$disconnect();
      await pool.end();
    } catch {
      /* ignore */
    }
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return server;
}

if (require.main === module) {
  loadNextLikeEnv(path.join(__dirname, ".."));
  startCollabServer().catch((err) => {
    console.error("[collab] failed to start:", err);
    process.exit(1);
  });
}

module.exports = {
  COLLAB_DEV_SECRET,
  loadEnvFile,
  loadNextLikeEnv,
  getCollabSecret,
  collabSecretSource,
  signCollabToken,
  verifyCollabToken,
  rewriteUnreachableListenHost,
  asUint8,
  buildDatabaseUrl,
  startCollabServer,
};
