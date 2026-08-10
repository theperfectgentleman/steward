#!/usr/bin/env node
/**
 * Runtime entrypoint for Dokploy/Docker.
 * Builds DATABASE_URL from DB_* (so passwords with ! @ # work), migrates,
 * starts the document collab server (Hocuspocus), then the Next.js app.
 */
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** Dokploy writes .env beside the Dockerfile before build when createEnvFile=true. */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.trim()) {
    console.log(`${filePath} exists but is empty (0 bytes of config)`);
    return false;
  }
  let loaded = 0;
  for (const line of content.split("\n")) {
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
    if (process.env[key] === undefined) {
      process.env[key] = val;
      loaded++;
    }
  }
  console.log(`Loaded ${loaded} variable(s) from ${filePath}`);
  return loaded > 0;
}

console.log("Steward entrypoint starting...");
for (const envPath of ["/app/.env", path.join(process.cwd(), ".env")]) {
  if (loadEnvFile(envPath)) break;
}
const dbKeys = Object.keys(process.env).filter(
  (k) => k === "DATABASE_URL" || k.startsWith("DB_"),
);
console.log(
  "DB keys after env load:",
  dbKeys.length ? dbKeys.join(", ") : "(none)",
);

function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

function buildDatabaseUrl() {
  const hasParts =
    present("DB_HOST") &&
    present("DB_USER") &&
    present("DB_PASSWORD") &&
    present("DB_NAME");

  if (hasParts) {
    const user = encodeURIComponent(process.env.DB_USER);
    const pass = encodeURIComponent(process.env.DB_PASSWORD);
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || "5432";
    const name = process.env.DB_NAME;
    const sslmode = process.env.DB_SSLMODE || "disable";
    const url = `postgresql://${user}:${pass}@${host}:${port}/${name}?sslmode=${sslmode}`;
    console.log("DATABASE_URL built from DB_HOST/DB_USER/DB_PASSWORD/DB_NAME");
    return url;
  }

  if (present("DATABASE_URL")) {
    console.log("Using DATABASE_URL from environment");
    return process.env.DATABASE_URL;
  }

  const keys = Object.keys(process.env)
    .filter((k) => k === "DATABASE_URL" || k.startsWith("DB_"))
    .sort();
  console.error("ERROR: Set DATABASE_URL, or set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME");
  console.error(
    "DB-related keys visible in container:",
    keys.length ? keys.join(", ") : "(none)",
  );
  const hasEnvFile = fs.existsSync("/app/.env");
  const envFileSize = hasEnvFile ? fs.statSync("/app/.env").size : 0;
  console.error(
    "Hint: /app/.env",
    hasEnvFile ? `exists (${envFileSize} bytes)` : "missing",
    "— in Dokploy enable 'Create Environment File', save your vars above it, then redeploy.",
  );
  process.exit(1);
}

process.env.DATABASE_URL = buildDatabaseUrl();

// Collab defaults for in-container process (client URL must be public — see COLLAB_WS_URL)
if (!present("COLLAB_PORT")) {
  process.env.COLLAB_PORT = "1234";
}
if (
  !present("COLLAB_WS_URL") &&
  !present("NEXT_PUBLIC_COLLAB_WS_URL")
) {
  console.warn(
    "WARN: COLLAB_WS_URL not set — browsers will try ws://localhost:1234. " +
      "On a production host set COLLAB_WS_URL to your public wss://… URL (and expose port 1234).",
  );
}
if (!present("COLLAB_TOKEN_SECRET") && !present("SESSION_SECRET")) {
  console.warn(
    "WARN: COLLAB_TOKEN_SECRET (or SESSION_SECRET) not set — using insecure dev default. " +
      "Set a strong secret shared only with this app.",
  );
}

console.log("Running database migrations...");
const prismaCli = "/app/node_modules/prisma/build/index.js";
const migrate = spawnSync(
  fs.existsSync(prismaCli) ? process.execPath : "prisma",
  fs.existsSync(prismaCli) ? [prismaCli, "migrate", "deploy"] : ["migrate", "deploy"],
  {
    stdio: "inherit",
    env: process.env,
    shell: false,
  },
);
if (migrate.status !== 0) {
  console.error(
    "ERROR: prisma migrate deploy failed (exit",
    migrate.status ?? 1,
    ") — check DATABASE_URL / DB_HOST and that Postgres accepts connections from Docker.",
  );
  process.exit(migrate.status ?? 1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("ERROR: No start command provided");
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function stopChildren(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child && !child.killed) {
      try {
        child.kill(signal);
      } catch {
        /* ignore */
      }
    }
  }
}

process.on("SIGTERM", () => stopChildren("SIGTERM"));
process.on("SIGINT", () => stopChildren("SIGINT"));

const disableCollab =
  process.env.DISABLE_COLLAB === "1" ||
  process.env.DISABLE_COLLAB === "true";

const collabScript = path.join(__dirname, "collab-server.cjs");
if (!disableCollab && fs.existsSync(collabScript)) {
  console.log(
    `Starting document collab server on port ${process.env.COLLAB_PORT}…`,
  );
  const collab = spawn(process.execPath, [collabScript], {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  children.push(collab);
  collab.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[collab] exited unexpectedly (code=${code}, signal=${signal}) — keeping app up; live co-edit unavailable.`,
    );
  });
} else if (disableCollab) {
  console.log("DISABLE_COLLAB set — skipping document collab server.");
} else {
  console.warn("WARN: collab-server.cjs missing — live co-edit unavailable.");
}

console.log("Starting Steward app…");
const app = spawn(args[0], args.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: false,
});
children.push(app);

app.on("exit", (code, signal) => {
  stopChildren("SIGTERM");
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
