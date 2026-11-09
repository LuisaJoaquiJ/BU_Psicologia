-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "modulo" VARCHAR(30) NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "ruta" VARCHAR(200),
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_leida_fechaCreacion_idx" ON "notificaciones"("usuarioId", "leida", "fechaCreacion");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

