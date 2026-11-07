-- CreateEnum
CREATE TYPE "element_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'CANCELLED', 'DONE');

-- CreateTable
CREATE TABLE "elements" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "platform_id" UUID,
    "sponsor_id" UUID,
    "category_id" UUID,
    "level_id" UUID,
    "duration_weeks" DECIMAL(6,2),
    "days_per_week" INTEGER NOT NULL DEFAULT 5,
    "hours_per_day" DECIMAL(4,2),
    "manual_total_hours" DECIMAL(8,2),
    "estimated_start" DATE,
    "estimated_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "status" "element_status" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,

    CONSTRAINT "elements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "elements_workspace_id_created_at_idx" ON "elements"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "elements_type_id_idx" ON "elements"("type_id");

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "element_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

