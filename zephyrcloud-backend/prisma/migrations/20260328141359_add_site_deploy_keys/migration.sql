-- CreateTable
CREATE TABLE `SiteDeployKey` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `created_by_user_id` BIGINT NOT NULL,
    `site_id` BIGINT NULL,
    `coolify_key_uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `public_key` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteDeployKey_site_id_key`(`site_id`),
    UNIQUE INDEX `SiteDeployKey_coolify_key_uuid_key`(`coolify_key_uuid`),
    INDEX `SiteDeployKey_tenant_id_idx`(`tenant_id`),
    INDEX `SiteDeployKey_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SiteDeployKey` ADD CONSTRAINT `SiteDeployKey_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteDeployKey` ADD CONSTRAINT `SiteDeployKey_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteDeployKey` ADD CONSTRAINT `SiteDeployKey_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
