-- AlterTable
ALTER TABLE `SiteDeployKey`
    ADD COLUMN `github_repo_full_name` VARCHAR(191) NULL,
    ADD COLUMN `github_deploy_key_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `UserGithubConnection` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'github_oauth',
    `github_user_id` VARCHAR(191) NOT NULL,
    `github_login` VARCHAR(191) NOT NULL,
    `github_name` VARCHAR(191) NULL,
    `github_avatar_url` VARCHAR(191) NULL,
    `access_token_encrypted` TEXT NOT NULL,
    `token_scope` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserGithubConnection_user_id_key`(`user_id`),
    INDEX `UserGithubConnection_tenant_id_idx`(`tenant_id`),
    INDEX `UserGithubConnection_github_login_idx`(`github_login`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserGithubConnection` ADD CONSTRAINT `UserGithubConnection_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserGithubConnection` ADD CONSTRAINT `UserGithubConnection_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
