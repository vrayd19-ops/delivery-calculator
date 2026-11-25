ALTER TABLE "TransportRequestInvoice"
ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

ALTER TABLE "TransportRequestInvoice"
ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);

ALTER TABLE "TransportRequestInvoice"
ADD COLUMN IF NOT EXISTS "invoiceAmount" DECIMAL(18,2);