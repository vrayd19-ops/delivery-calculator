-- DropForeignKey
ALTER TABLE "Calculation" DROP CONSTRAINT "Calculation_vehicleTypeId_fkey";

-- DropForeignKey
ALTER TABLE "CalculationAdditionalService" DROP CONSTRAINT "CalculationAdditionalService_additionalServiceId_fkey";

-- DropForeignKey
ALTER TABLE "CalculationAdditionalService" DROP CONSTRAINT "CalculationAdditionalService_calculationId_fkey";

-- DropForeignKey
ALTER TABLE "CalculationPoint" DROP CONSTRAINT "CalculationPoint_calculationId_fkey";

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "ttkGeoJson" JSONB;

-- AlterTable
ALTER TABLE "Calculation" ADD COLUMN     "cargoLengthM" DECIMAL(8,2),
ADD COLUMN     "extraPointPriceKopeksSnapshot" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "extraPointsKopeks" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalBefore22Kopeks" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "surcharge22Kopeks" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "ttkSurchargeKopeks" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "ttkSurchargeKopeksSnapshot" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VehicleType" ADD COLUMN     "extraPointPriceKopeks" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "ttkSurchargeKopeks" BIGINT NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationPoint" ADD CONSTRAINT "CalculationPoint_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationAdditionalService" ADD CONSTRAINT "CalculationAdditionalService_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationAdditionalService" ADD CONSTRAINT "CalculationAdditionalService_additionalServiceId_fkey" FOREIGN KEY ("additionalServiceId") REFERENCES "AdditionalService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
