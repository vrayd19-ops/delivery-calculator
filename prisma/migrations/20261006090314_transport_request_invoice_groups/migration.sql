-- CreateEnum
CREATE TYPE "TransportRequestInvoiceKind" AS ENUM ('SUPPLIER', 'OUR');

-- CreateTable
CREATE TABLE "TransportRequestInvoice" (
    "id" TEXT NOT NULL,
    "transportRequestId" TEXT NOT NULL,
    "kind" "TransportRequestInvoiceKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "telegramMessageId" TEXT,
    "telegramError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRequestInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransportRequestInvoice_transportRequestId_idx" ON "TransportRequestInvoice"("transportRequestId");

-- CreateIndex
CREATE INDEX "TransportRequestInvoice_kind_idx" ON "TransportRequestInvoice"("kind");

-- CreateIndex
CREATE INDEX "TransportRequestInvoice_transportRequestId_kind_idx" ON "TransportRequestInvoice"("transportRequestId", "kind");

-- CreateIndex
CREATE INDEX "TransportRequestInvoice_createdAt_idx" ON "TransportRequestInvoice"("createdAt");

-- AddForeignKey
ALTER TABLE "TransportRequestInvoice" ADD CONSTRAINT "TransportRequestInvoice_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "TransportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
