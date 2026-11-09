-- AlterTable
ALTER TABLE "cultura_convocatorias" ADD COLUMN     "grupoId" TEXT;

-- AddForeignKey
ALTER TABLE "cultura_convocatorias" ADD CONSTRAINT "cultura_convocatorias_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

