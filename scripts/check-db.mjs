import "dotenv/config";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: DATABASE_URL is not set in .env");
  process.exit(1);
}

const client = new Client({ connectionString: url });

async function main() {
  console.log("Checking database configuration…\n");

  // Mask password in printed URL
  const masked = url.replace(/:([^:@/]+)@/, ":****@");
  console.log("DATABASE_URL:", masked);

  await client.connect();
  const info = await client.query(
    "SELECT current_database() AS db, current_user AS usr, inet_server_addr() AS host, inet_server_port() AS port, version() AS ver",
  );
  console.log("\nCONNECTED ✔");
  console.log("  database:", info.rows[0].db);
  console.log("  user:    ", info.rows[0].usr);
  console.log("  host:    ", info.rows[0].host ?? "localhost");
  console.log("  port:    ", info.rows[0].port ?? process.env.DB_PORT);
  console.log("  version: ", String(info.rows[0].ver).split("\n")[0]);

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  const names = tables.rows.map((r) => r.table_name);
  console.log("\nTables (" + names.length + "):");
  if (names.length === 0) {
    console.log("  (none — migrations not applied)");
  } else {
    for (const n of names) console.log("  -", n);
  }

  const hasMig = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS has_mig
  `);

  if (hasMig.rows[0].has_mig) {
    const migs = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at
    `);
    console.log("\nPrisma migrations:");
    for (const row of migs.rows) {
      const status = row.rolled_back_at
        ? "ROLLED BACK"
        : row.finished_at
          ? "OK"
          : "PENDING";
      console.log("  -", row.migration_name, "[" + status + "]");
    }
  } else {
    console.log("\nPrisma migrations: none recorded");
  }

  const expected = [
    "User",
    "Committee",
    "CommitteeMember",
    "Task",
    "Event",
    "EventRsvp",
    "Meeting",
    "MinutePoint",
    "Attendance",
    "TimelineGoal",
    "CommitteeFeedback",
  ];

  console.log("\nRow counts:");
  let missing = 0;
  for (const t of expected) {
    if (!names.includes(t)) {
      console.log("  -", t + ": MISSING");
      missing++;
      continue;
    }
    const q = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    console.log("  -", t + ":", q.rows[0].n);
  }

  console.log("\n── Summary ──");
  if (missing > 0) {
    console.log("Schema incomplete — run: npm run db:setup  (or ./deploy.sh → 10)");
    process.exitCode = 2;
  } else {
    const users = await client.query(`SELECT COUNT(*)::int AS n FROM "User"`);
    const committees = await client.query(
      `SELECT COUNT(*)::int AS n FROM "Committee"`,
    );
    if (users.rows[0].n === 0 || committees.rows[0].n === 0) {
      console.log("Schema OK, but seed data missing — run: npm run db:seed");
      process.exitCode = 3;
    } else {
      console.log("Database is configured and seeded ✔");
    }
  }
}

main()
  .catch((e) => {
    console.error("\nCONNECTION FAILED ✖");
    console.error(" ", e.message);
    console.error("\nCheck:");
    console.error("  1. PostgreSQL is running on localhost:5432");
    console.error("  2. Database 'stewarddb' exists");
    console.error("  3. User/password in .env match Postgres");
    process.exit(1);
  })
  .finally(() => client.end().catch(() => undefined));
