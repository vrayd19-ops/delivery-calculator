-- Reconcile TransportRequest with the current production schema.
--
-- These changes already exist in production and are recorded here
-- so that Prisma migration history matches the real database schema.

ALTER TABLE "TransportRequest"
ALTER COLUMN "loadingDate"
SET DATA TYPE DATE
USING "loadingDate"::date;

CREATE INDEX IF NOT EXISTS "TransportRequest_managerEmail_idx"
ON "TransportRequest"("managerEmail");

CREATE INDEX IF NOT EXISTS "TransportRequest_customer_idx"
ON "TransportRequest"("customer");
