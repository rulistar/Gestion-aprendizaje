-- HU-18: todo se mide en minutos. Las columnas conservan su nombre ("hours"), pero ahora guardan
-- minutos. Primero se ensanchan (un día tiene 1440 minutos) y luego se convierte lo que ya existe.

-- AlterTable
ALTER TABLE "elements"
  ALTER COLUMN "hours_per_day" SET DATA TYPE DECIMAL(6,2),
  ALTER COLUMN "manual_total_hours" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "actual_hours" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "element_nodes"
  ALTER COLUMN "hours_per_day" SET DATA TYPE DECIMAL(6,2),
  ALTER COLUMN "manual_total_hours" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "actual_hours" SET DATA TYPE DECIMAL(10,2);

-- Horas a minutos (lo vacío sigue vacío)
UPDATE "elements"
SET "hours_per_day" = "hours_per_day" * 60,
    "manual_total_hours" = "manual_total_hours" * 60,
    "actual_hours" = "actual_hours" * 60;

UPDATE "element_nodes"
SET "hours_per_day" = "hours_per_day" * 60,
    "manual_total_hours" = "manual_total_hours" * 60,
    "actual_hours" = "actual_hours" * 60;
