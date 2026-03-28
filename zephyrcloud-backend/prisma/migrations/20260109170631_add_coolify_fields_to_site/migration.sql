-- AlterTable
ALTER TABLE `site` ADD COLUMN `coolify_destination_uuid` VARCHAR(191) NULL,
    ADD COLUMN `coolify_resource_type` VARCHAR(191) NULL,
    ADD COLUMN `coolify_server_uuid` VARCHAR(191) NULL;
