"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

describe("verify-collab-runtime-deps (Docker runner regression)", () => {
  it("detects Next standalone-style postgres-array stub before npm repair", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "steward-collab-deps-"));
    const nm = path.join(tmp, "node_modules", "postgres-array");
    fs.mkdirSync(nm, { recursive: true });
    fs.writeFileSync(
      path.join(nm, "package.json"),
      JSON.stringify({ name: "postgres-array", main: "index.js", version: "3.0.4" }),
    );
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "stub-root" }));

    const npmInstall = spawnSync(
      "npm",
      [
        "install",
        "@prisma/adapter-pg@7.8.0",
        "pg@8.22.0",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ],
      { cwd: tmp, encoding: "utf8" },
    );
    assert.equal(npmInstall.status, 0, npmInstall.stderr || npmInstall.stdout);

    const brokenLoad = spawnSync(
      process.execPath,
      ["-e", "require('@prisma/adapter-pg')"],
      { cwd: tmp, encoding: "utf8" },
    );
    assert.notEqual(brokenLoad.status, 0);
    assert.match(brokenLoad.stderr, /postgres-array/);

    fs.rmSync(path.join(tmp, "node_modules", "postgres-array"), {
      recursive: true,
      force: true,
    });
    const repair = spawnSync(
      "npm",
      ["install", "postgres-array@3.0.4", "--ignore-scripts", "--no-audit", "--no-fund"],
      { cwd: tmp, encoding: "utf8" },
    );
    assert.equal(repair.status, 0, repair.stderr || repair.stdout);
    assert.ok(fs.existsSync(path.join(tmp, "node_modules", "postgres-array", "index.js")));

    const fixedLoad = spawnSync(
      process.execPath,
      ["-e", "require('@prisma/adapter-pg')"],
      { cwd: tmp, encoding: "utf8" },
    );
    assert.equal(fixedLoad.status, 0, fixedLoad.stderr);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("passes on a full dev install in the repo root", () => {
    const script = path.join(__dirname, "verify-collab-runtime-deps.cjs");
    const run = spawnSync(process.execPath, [script], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });
});
