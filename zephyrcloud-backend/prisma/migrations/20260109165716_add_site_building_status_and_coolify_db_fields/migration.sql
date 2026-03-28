-- AlterTable
ALTER TABLE `site` ADD COLUMN `coolify_app_id` VARCHAR(191) NULL,
    ADD COLUMN `coolify_service_id` VARCHAR(191) NULL,
    ADD COLUMN `last_status_sync_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('provisioning', 'building', 'running', 'stopped', 'error', 'deleted') NOT NULL DEFAULT 'provisioning';

-- AlterTable
ALTER TABLE `sitedatabase` ADD COLUMN `coolify_database_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tenant` ADD COLUMN `plan` ENUM('FREE', 'PRO', 'DRIFT_START', 'DRIFT_CORE', 'DRIFT_PLUS', 'DRIFT_GLOBAL') NOT NULL DEFAULT 'FREE';

-- CreateIndex
CREATE INDEX `Deployment_status_idx` ON `Deployment`(`status`);

-- CreateIndex
CREATE INDEX `Site_coolify_project_id_idx` ON `Site`(`coolify_project_id`);

-- CreateIndex
CREATE INDEX `Site_coolify_resource_id_idx` ON `Site`(`coolify_resource_id`);

-- CreateIndex
CREATE INDEX `SiteDatabase_coolify_database_id_idx` ON `SiteDatabase`(`coolify_database_id`);
