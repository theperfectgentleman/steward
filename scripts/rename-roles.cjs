const fs = require("fs");
const path = require("path");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== "generated" && ent.name !== "node_modules") walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const pairs = [
  ['"SUPER_ADMIN"', '"ORG_ADMIN"'],
  ["'SUPER_ADMIN'", "'ORG_ADMIN'"],
  ['"SYSTEM_ADMIN"', '"ORG_TECH"'],
  ["'SYSTEM_ADMIN'", "'ORG_TECH'"],
  ['"CHURCH_EXECUTIVE"', '"ORG_PARTICIPANT"'],
  ["'CHURCH_EXECUTIVE'", "'ORG_PARTICIPANT'"],
  ['"COMMITTEE_PARTICIPANT"', '"ORG_PARTICIPANT"'],
  ["'COMMITTEE_PARTICIPANT'", "'ORG_PARTICIPANT'"],
  ['"PRESBYTERY"', '"SUPERVISORY"'],
  ["'PRESBYTERY'", "'SUPERVISORY'"],
  ["presbyteryMembership", "supervisoryMembership"],
  ["prisma.presbyteryGroup", "prisma.supervisoryGroup"],
  ["prisma.presbyteryMember", "prisma.supervisoryMember"],
];

let updated = 0;
const skip = new Set([
  path.normalize("src/lib/auth.ts"),
  path.normalize("src/lib/session.ts"),
  path.normalize("src/lib/types.ts"),
  path.normalize("src/lib/organizations.ts"),
]);
for (const file of walk("src")) {
  if (skip.has(path.normalize(file))) continue;
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  for (const [from, to] of pairs) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    updated += 1;
    console.log(file);
  }
}
console.log("updated", updated, "files");
