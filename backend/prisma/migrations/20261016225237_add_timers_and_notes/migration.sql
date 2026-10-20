-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "notes" TEXT;
