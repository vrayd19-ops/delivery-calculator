-- AlterTable
ALTER TABLE "Calculation" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Calculation_userId_idx" ON "Calculation"("userId");

-- CreateIndex
CREATE INDEX "Calculation_createdAt_idx" ON "Calculation"("createdAt");

-- CreateIndex
CREATE INDEX "CalculationAdditionalService_calculationId_idx" ON "CalculationAdditionalService"("calculationId");

-- CreateIndex
CREATE INDEX "CalculationAdditionalService_additionalServiceId_idx" ON "CalculationAdditionalService"("additionalServiceId");

-- CreateIndex
CREATE INDEX "CalculationPoint_calculationId_idx" ON "CalculationPoint"("calculationId");

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
