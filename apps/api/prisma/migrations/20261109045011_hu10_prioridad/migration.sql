-- CreateEnum
CREATE TYPE "element_priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "element_nodes" ADD COLUMN     "priority" "element_priority";

-- AlterTable
ALTER TABLE "elements" ADD COLUMN     "priority" "element_priority" NOT NULL DEFAULT 'MEDIUM';

-- Los Cursos que ya existen toman la prioridad por omisión, como los elementos
UPDATE "element_nodes" SET "priority" = 'MEDIUM' WHERE "kind" = 'COURSE';
