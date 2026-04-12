CREATE TABLE `UserDatabase` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `tenant_id` BIGINT NOT NULL,
    `engine` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL,
    `db_name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `public_url` TEXT NOT NULL,
    `ssl_mode` VARCHAR(191) NULL,
    `coolify_project_id` VARCHAR(191) NULL,
    `coolify_database_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserDatabase_user_id_key`(`user_id`),
    INDEX `UserDatabase_tenant_id_idx`(`tenant_id`),
    INDEX `UserDatabase_coolify_project_id_idx`(`coolify_project_id`),
    INDEX `UserDatabase_coolify_database_id_idx`(`coolify_database_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserDatabase`
    ADD CONSTRAINT `UserDatabase_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserDatabase`
    ADD CONSTRAINT `UserDatabase_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
