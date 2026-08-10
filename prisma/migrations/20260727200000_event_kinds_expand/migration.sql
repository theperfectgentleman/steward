-- Expand ScheduleKind beyond MEETING | EVENT for committee work types.
-- Migrate legacy EVENT rows to OTHER.

CREATE TYPE "ScheduleKind_new" AS ENUM (
  'MEETING',
  'WORKING_VISIT',
  'WORKSHOP',
  'PROGRAM',
  'OTHER'
);

ALTER TABLE "Event" ALTER COLUMN "kind" DROP DEFAULT;

ALTER TABLE "Event"
  ALTER COLUMN "kind" TYPE "ScheduleKind_new"
  USING (
    CASE
      WHEN kind::text = 'MEETING' THEN 'MEETING'::"ScheduleKind_new"
      WHEN kind::text = 'EVENT' THEN 'OTHER'::"ScheduleKind_new"
      ELSE 'OTHER'::"ScheduleKind_new"
    END
  );

DROP TYPE "ScheduleKind";

ALTER TYPE "ScheduleKind_new" RENAME TO "ScheduleKind";

ALTER TABLE "Event" ALTER COLUMN "kind" SET DEFAULT 'OTHER'::"ScheduleKind";
