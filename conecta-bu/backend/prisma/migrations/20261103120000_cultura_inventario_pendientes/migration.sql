-- AlterTable
ALTER TABLE "cultura_evidencias" ADD COLUMN     "representacionId" TEXT;

-- CreateTable
CREATE TABLE "cultura_inventario" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "descripcion" TEXT,
    "ubicacion" VARCHAR(120),
    "grupoId" TEXT,
    "cantidadTotal" INTEGER NOT NULL DEFAULT 1,
    "cantidadDanada" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cultura_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultura_prestamos" (
    "id" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "responsable" VARCHAR(150) NOT NULL,
    "responsableEmail" VARCHAR(120),
    "grupoId" TEXT,
    "motivo" VARCHAR(150),
    "fechaPrestamo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDevolucionEsperada" DATE NOT NULL,
    "fechaDevolucion" TIMESTAMP(3),
    "devueltosDanados" INTEGER,
    "registradoPor" VARCHAR(120),

    CONSTRAINT "cultura_prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultura_pendientes" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "detalle" TEXT,
    "categoria" VARCHAR(20) NOT NULL DEFAULT 'logistica',
    "fechaLimite" DATE NOT NULL,
    "responsable" VARCHAR(150),
    "eventoId" TEXT,
    "representacionId" TEXT,
    "hecha" BOOLEAN NOT NULL DEFAULT false,
    "fechaHecha" TIMESTAMP(3),
    "creadaPor" VARCHAR(120),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cultura_pendientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cultura_prestamos_articuloId_idx" ON "cultura_prestamos"("articuloId");

-- CreateIndex
CREATE INDEX "cultura_pendientes_fechaLimite_idx" ON "cultura_pendientes"("fechaLimite");

-- AddForeignKey
ALTER TABLE "cultura_evidencias" ADD CONSTRAINT "cultura_evidencias_representacionId_fkey" FOREIGN KEY ("representacionId") REFERENCES "cultura_representaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultura_inventario" ADD CONSTRAINT "cultura_inventario_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultura_prestamos" ADD CONSTRAINT "cultura_prestamos_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "cultura_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultura_prestamos" ADD CONSTRAINT "cultura_prestamos_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

