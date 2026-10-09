-- Salidas institucionales y reportes SST (reemplaza el formulario "0 SALUD INTEGRAL").

-- CreateEnum
CREATE TYPE "TipoReporteSST" AS ENUM ('SalidaEstudiantesLocal', 'SalidaEstudiantesRegional', 'SalidaEstudiantesNacional', 'SalidaEstudiantesInternacional', 'RepresentacionNacional', 'RepresentacionInternacional', 'TrasladoPosgrados', 'CondicionInsegura');

-- CreateEnum
CREATE TYPE "EstadoReporteSST" AS ENUM ('Recibido', 'Verificado', 'RequiereAjustes', 'Cerrado');

-- CreateEnum
CREATE TYPE "MedioTransporteSST" AS ENUM ('Publico', 'Particular', 'Institucional', 'Aereo', 'Caminando');

-- CreateTable
CREATE TABLE "sst_reportes" (
    "id" TEXT NOT NULL,
    "consecutivo" SERIAL NOT NULL,
    "tipo" "TipoReporteSST" NOT NULL,
    "estado" "EstadoReporteSST" NOT NULL DEFAULT 'Recibido',
    "reportadoPorId" TEXT NOT NULL,
    "correo" VARCHAR(120) NOT NULL,
    "nombreReporta" VARCHAR(200) NOT NULL,
    "celular" VARCHAR(30) NOT NULL,
    "area" VARCHAR(120) NOT NULL,
    "responsableNombre" VARCHAR(200),
    "responsableTipoDoc" VARCHAR(5),
    "responsableDocumento" VARCHAR(30),
    "acompanantes" JSONB,
    "numeroEstudiantes" INTEGER,
    "evento" VARCHAR(200),
    "motivo" TEXT,
    "pais" VARCHAR(80),
    "ciudadOrigen" VARCHAR(120),
    "destino" VARCHAR(200),
    "lugarDestino" VARCHAR(200),
    "fechaSalida" DATE,
    "fechaRegreso" DATE,
    "horaSalida" VARCHAR(5),
    "horaRegreso" VARCHAR(5),
    "medioTransporte" "MedioTransporteSST",
    "transporteEmpresa" VARCHAR(200),
    "conductor" VARCHAR(200),
    "placa" VARCHAR(15),
    "lugarEvento" VARCHAR(200),
    "fechaEvento" DATE,
    "horaEvento" VARCHAR(5),
    "afectado" VARCHAR(200),
    "cargo" VARCHAR(120),
    "descripcion" TEXT,
    "clasificacion" VARCHAR(30),
    "potencial" VARCHAR(10),
    "medidaControl" TEXT,
    "diasAnticipacion" INTEGER,
    "fueraDeTiempo" BOOLEAN NOT NULL DEFAULT false,
    "consentimientoDatos" BOOLEAN NOT NULL DEFAULT false,
    "gestionExterna" BOOLEAN NOT NULL DEFAULT false,
    "observacionRevision" TEXT,
    "revisadoPor" VARCHAR(120),
    "fechaRevision" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sst_reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sst_adjuntos" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "ruta" VARCHAR(400) NOT NULL,
    "tipoMime" VARCHAR(100) NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sst_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sst_reportes_consecutivo_key" ON "sst_reportes"("consecutivo");

-- CreateIndex
CREATE INDEX "sst_reportes_estado_idx" ON "sst_reportes"("estado");

-- CreateIndex
CREATE INDEX "sst_reportes_fechaSalida_idx" ON "sst_reportes"("fechaSalida");

-- CreateIndex
CREATE INDEX "sst_reportes_reportadoPorId_idx" ON "sst_reportes"("reportadoPorId");

-- CreateIndex
CREATE INDEX "sst_adjuntos_reporteId_idx" ON "sst_adjuntos"("reporteId");

-- AddForeignKey
ALTER TABLE "sst_reportes" ADD CONSTRAINT "sst_reportes_reportadoPorId_fkey" FOREIGN KEY ("reportadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sst_adjuntos" ADD CONSTRAINT "sst_adjuntos_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "sst_reportes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
