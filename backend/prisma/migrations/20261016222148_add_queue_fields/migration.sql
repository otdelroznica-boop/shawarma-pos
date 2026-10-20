-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "closed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "deliveredQty" INTEGER NOT NULL DEFAULT 0;
