#!/usr/bin/env node
/**
 * Runtime entrypoint for Dokploy/Docker.
 * Builds DATABASE_URL from DB_* (so passwords with ! @ # work), then migrates and starts the app.
 */
const { spawnSync } = require("node:child_process");

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
  process.exit(1);
}

process.env.DATABASE_URL = buildDatabaseUrl();

console.log("Running database migrations...");
const migrate = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("ERROR: No start command provided");
  process.exit(1);
}

console.log("Starting Steward...");
const app = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: false,
});
process.exit(app.status ?? 1);
