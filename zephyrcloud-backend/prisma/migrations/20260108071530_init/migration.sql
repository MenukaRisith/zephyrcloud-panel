-- CreateTable
CREATE TABLE `Tenant` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `suspended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RefreshToken_user_id_idx`(`user_id`),
    INDEX `RefreshToken_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerification_user_id_key`(`user_id`),
    INDEX `EmailVerification_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordReset` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PasswordReset_user_id_idx`(`user_id`),
    INDEX `PasswordReset_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Site` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('wordpress', 'node', 'php', 'static') NOT NULL,
    `status` ENUM('provisioning', 'running', 'stopped', 'error', 'deleted') NOT NULL DEFAULT 'provisioning',
    `coolify_project_id` VARCHAR(191) NULL,
    `coolify_resource_id` VARCHAR(191) NULL,
    `cpu_limit` DOUBLE NOT NULL DEFAULT 0.5,
    `memory_mb` INTEGER NOT NULL DEFAULT 512,
    `repo_url` VARCHAR(191) NULL,
    `repo_branch` VARCHAR(191) NULL,
    `auto_deploy` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Site_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Domain` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `site_id` BIGINT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `status` ENUM('pending_ns', 'verifying', 'active', 'error') NOT NULL DEFAULT 'pending_ns',
    `coolify_domain_id` VARCHAR(191) NULL,
    `ssl_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Domain_domain_key`(`domain`),
    INDEX `Domain_tenant_id_idx`(`tenant_id`),
    INDEX `Domain_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deployment` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `site_id` BIGINT NOT NULL,
    `status` ENUM('queued', 'building', 'success', 'failed') NOT NULL,
    `commit_hash` VARCHAR(191) NULL,
    `triggered_by` ENUM('user', 'webhook', 'system') NOT NULL,
    `logs` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Deployment_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteDatabase` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `site_id` BIGINT NOT NULL,
    `engine` VARCHAR(191) NOT NULL DEFAULT 'mysql',
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 3306,
    `db_name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteDatabase_site_id_key`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerification` ADD CONSTRAINT `EmailVerification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `PasswordReset_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Domain` ADD CONSTRAINT `Domain_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Domain` ADD CONSTRAINT `Domain_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteDatabase` ADD CONSTRAINT `SiteDatabase_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
