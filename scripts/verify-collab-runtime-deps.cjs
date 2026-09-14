#!/usr/bin/env node
/**
 * Smoke check for Docker runner / collab-server runtime deps.
 * Next.js standalone file tracing can copy package.json-only stubs (e.g. postgres-array)
 * without main entry files; @prisma/adapter-pg then fails at require() time.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function assertPackageMain(name) {
  const pkgDir = path.join(root, "node_modules", name);
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`missing package: ${name}`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const mainRel = pkg.main || "index.js";
  const mainPath = path.join(pkgDir, mainRel);
  if (!fs.existsSync(mainPath)) {
    throw new Error(
      `${name} is incomplete (main "${mainRel}" missing). ` +
        "If this is the Docker runner image, remove Next standalone stubs before npm install.",
    );
  }
}

const REQUIRED = [
  "postgres-array",
  "pg",
  "@prisma/adapter-pg",
  "@hocuspocus/server",
  "yjs",
];

for (const name of REQUIRED) {
  assertPackageMain(name);
}

require("@prisma/adapter-pg");
require("pg");
require("postgres-array");

console.log("[verify-collab-runtime-deps] OK");
