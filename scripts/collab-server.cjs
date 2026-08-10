#!/usr/bin/env node
/**
 * Production / Docker document collaboration server (Hocuspocus + Yjs).
 * Local: npm run dev:collab
 * Docker: started by docker-entrypoint.js alongside Next.js
 */
"use strict";

const { createHmac, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Server } = require("@hocuspocus/server");
const Y = require("yjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

/** Load repo .env when started via deploy.sh / npm (Next loads it; plain Node does not). */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));

// Collab server CJS lives next to entrypoint under /app/scripts;
// Prisma client is at /app/src/generated (one level up from scripts/).
const { PrismaClient } = require(
  path.join(__dirname, "..", "src", "generated", "prisma", "client"),
);

const COLLAB_SECRET =
  process.env.COLLAB_TOKEN_SECRET ||
  process.env.SESSION_SECRET ||
  "steward-collab-dev-secret";

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

function verifyCollabToken(token) {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", COLLAB_SECRET).update(data).digest();
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
    "[collab] Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME",
  );
}

const connectionString = buildDatabaseUrl();
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const port = Number(process.env.COLLAB_PORT || 1234);

const server = Server.configure({
  port,
  address: "0.0.0.0",
  async onAuthenticate({ token, documentName }) {
    const payload = verifyCollabToken(token || "");
    if (!payload) {
      throw new Error("Invalid collab token");
    }
    if (payload.documentId !== documentName) {
      throw new Error("Document mismatch");
    }
    return {
      user: {
        id: payload.userId,
        name: payload.userName,
        canWrite: payload.canWrite,
      },
    };
  },
  async onLoadDocument({ documentName, document }) {
    const row = await prisma.libraryDocument.findUnique({
      where: { id: documentName },
      select: { crdtState: true, body: true, contentJson: true },
    });
    if (row?.crdtState && row.crdtState.length > 0) {
      Y.applyUpdate(document, new Uint8Array(row.crdtState));
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
  },
  async onStoreDocument({ documentName, document }) {
    const update = Y.encodeStateAsUpdate(document);
    await prisma.libraryDocument.update({
      where: { id: documentName },
      data: { crdtState: Buffer.from(update) },
    });
  },
});

server
  .listen()
  .then(() => {
    console.log(`[collab] Hocuspocus listening on ws://0.0.0.0:${port}`);
  })
  .catch((err) => {
    console.error("[collab] failed to start:", err);
    process.exit(1);
  });

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
