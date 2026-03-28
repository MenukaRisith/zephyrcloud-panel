-- CreateTable
CREATE TABLE `SiteMember` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `site_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `role` ENUM('viewer', 'editor') NOT NULL DEFAULT 'viewer',
    `invited_by_user_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteMember_site_id_user_id_key`(`site_id`, `user_id`),
    INDEX `SiteMember_site_id_idx`(`site_id`),
    INDEX `SiteMember_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteInvite` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `site_id` BIGINT NOT NULL,
    `tenant_id` BIGINT NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('viewer', 'editor') NOT NULL DEFAULT 'viewer',
    `status` ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
    `invited_by_user_id` BIGINT NOT NULL,
    `accepted_by_user_id` BIGINT NULL,
    `accepted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteInvite_site_id_email_key`(`site_id`, `email`),
    INDEX `SiteInvite_tenant_id_idx`(`tenant_id`),
    INDEX `SiteInvite_email_idx`(`email`),
    INDEX `SiteInvite_site_id_status_idx`(`site_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SiteMember` ADD CONSTRAINT `SiteMember_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteMember` ADD CONSTRAINT `SiteMember_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteInvite` ADD CONSTRAINT `SiteInvite_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteInvite` ADD CONSTRAINT `SiteInvite_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
