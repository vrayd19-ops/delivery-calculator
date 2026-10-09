-- CreateTable
CREATE TABLE "TransportRequestCounter" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRequestCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "managerEmail" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "loadingDate" TIMESTAMP(3) NOT NULL,
    "desiredPickupTime" TEXT,
    "preferredVehicleTypeId" TEXT,
    "preferredVehicleName" TEXT,
    "totalWeight" DECIMAL(10,2) NOT NULL,
    "cargoLength" DECIMAL(10,2) NOT NULL,
    "needsStakes" BOOLEAN NOT NULL DEFAULT false,
    "logisticsFitCheck" BOOLEAN NOT NULL DEFAULT false,
    "loadingAddress" TEXT,
    "loadingMapUrl" TEXT,
    "loadingContactName" TEXT NOT NULL,
    "loadingContactPhone" TEXT NOT NULL,
    "loadingUntil" TEXT NOT NULL,
    "unloadingAddress" TEXT,
    "unloadingMapUrl" TEXT,
    "unloadingContactName" TEXT NOT NULL,
    "unloadingContactPhone" TEXT NOT NULL,
    "unloadingUntil" TEXT NOT NULL,
    "invoiceFileName" TEXT NOT NULL,
    "invoiceFileType" TEXT NOT NULL,
    "invoiceFileSize" INTEGER NOT NULL,
    "comment" TEXT,
    "telegramTextSent" BOOLEAN NOT NULL DEFAULT false,
    "telegramFileSent" BOOLEAN NOT NULL DEFAULT false,
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "telegramMessageId" TEXT,
    "telegramError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportRequestCounter_year_key" ON "TransportRequestCounter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRequest_requestNumber_key" ON "TransportRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "TransportRequest_createdByUserId_idx" ON "TransportRequest"("createdByUserId");

-- CreateIndex
CREATE INDEX "TransportRequest_preferredVehicleTypeId_idx" ON "TransportRequest"("preferredVehicleTypeId");

-- CreateIndex
CREATE INDEX "TransportRequest_createdAt_idx" ON "TransportRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "TransportRequest" ADD CONSTRAINT "TransportRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRequest" ADD CONSTRAINT "TransportRequest_preferredVehicleTypeId_fkey" FOREIGN KEY ("preferredVehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
