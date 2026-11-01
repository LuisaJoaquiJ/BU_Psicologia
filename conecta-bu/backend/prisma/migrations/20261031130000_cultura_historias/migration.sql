-- Historias de Cultura: redes, pausas, apoyo, perfil academico, roles y evidencias clasificadas.

ALTER TABLE "cultura_eventos" ADD COLUMN "representacion" VARCHAR(300);
ALTER TABLE "cultura_eventos" ADD COLUMN "grupoId" TEXT;

ALTER TABLE "cultura_perfiles" ADD COLUMN "documento" VARCHAR(20);
ALTER TABLE "cultura_perfiles" ADD COLUMN "programa" VARCHAR(150);
ALTER TABLE "cultura_perfiles" ADD COLUMN "caracterizacion" VARCHAR(40);

ALTER TABLE "cultura_evidencias" ADD COLUMN "tipo" VARCHAR(20) NOT NULL DEFAULT 'fotografia';
ALTER TABLE "cultura_evidencias" ADD COLUMN "pausaId" TEXT;

CREATE TABLE "cultura_representaciones" (
    "id" TEXT NOT NULL,
    "red" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "modalidad" VARCHAR(120),
    "fecha" DATE NOT NULL,
    "grupoId" TEXT,
    "posicion" VARCHAR(120),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_representaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cultura_representacion_participantes" (
    "id" TEXT NOT NULL,
    "representacionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "cultura_representacion_participantes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cultura_pausas" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "lugar" VARCHAR(150) NOT NULL,
    "tecnica" VARCHAR(150) NOT NULL,
    "impactoEstimado" INTEGER NOT NULL,
    "registradaPor" VARCHAR(120),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_pausas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cultura_solicitudes_apoyo" (
    "id" TEXT NOT NULL,
    "lugarDestino" VARCHAR(150) NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "grupoId" TEXT,
    "detalle" TEXT,
    "personalAsignado" VARCHAR(300),
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Recibida',
    "solicitadaPor" VARCHAR(120),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_solicitudes_apoyo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cultura_roles" (
    "email" VARCHAR(120) NOT NULL,
    "rol" VARCHAR(20) NOT NULL,
    CONSTRAINT "cultura_roles_pkey" PRIMARY KEY ("email")
);

CREATE UNIQUE INDEX "cultura_representacion_participantes_representacionId_usuarioId_key" ON "cultura_representacion_participantes"("representacionId", "usuarioId");
CREATE INDEX "cultura_representacion_participantes_usuarioId_idx" ON "cultura_representacion_participantes"("usuarioId");
CREATE INDEX "cultura_representaciones_fecha_idx" ON "cultura_representaciones"("fecha");
CREATE INDEX "cultura_pausas_fecha_idx" ON "cultura_pausas"("fecha");
CREATE INDEX "cultura_solicitudes_apoyo_fecha_idx" ON "cultura_solicitudes_apoyo"("fecha");

ALTER TABLE "cultura_eventos" ADD CONSTRAINT "cultura_eventos_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cultura_representaciones" ADD CONSTRAINT "cultura_representaciones_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cultura_representacion_participantes" ADD CONSTRAINT "cultura_representacion_participantes_representacionId_fkey" FOREIGN KEY ("representacionId") REFERENCES "cultura_representaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cultura_representacion_participantes" ADD CONSTRAINT "cultura_representacion_participantes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_solicitudes_apoyo" ADD CONSTRAINT "cultura_solicitudes_apoyo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cultura_evidencias" ADD CONSTRAINT "cultura_evidencias_pausaId_fkey" FOREIGN KEY ("pausaId") REFERENCES "cultura_pausas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
