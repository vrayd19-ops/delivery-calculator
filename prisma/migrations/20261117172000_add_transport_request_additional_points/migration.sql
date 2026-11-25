ALTER TABLE "TransportRequest"
ADD COLUMN IF NOT EXISTS "additionalLoadingPoints" JSONB;

ALTER TABLE "TransportRequest"
ADD COLUMN IF NOT EXISTS "additionalUnloadingPoints" JSONB;
