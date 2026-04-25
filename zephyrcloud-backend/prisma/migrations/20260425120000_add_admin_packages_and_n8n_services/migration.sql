ALTER TABLE `Tenant`
  ADD COLUMN `package_id` BIGINT NULL;

CREATE TABLE `HostingPackage` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `kind` ENUM('WEB', 'N8N') NOT NULL DEFAULT 'WEB',
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `n8n_variant` ENUM('SIMPLE', 'POSTGRES', 'QUEUE') NULL,
  `legacy_plan` ENUM('FREE', 'PRO', 'DRIFT_START', 'DRIFT_CORE', 'DRIFT_PLUS', 'DRIFT_GLOBAL') NULL,
  `max_sites` INTEGER NULL,
  `max_services` INTEGER NULL,
  `max_cpu_total` DOUBLE NULL,
  `max_memory_mb_total` INTEGER NULL,
  `max_storage_gb_total` INTEGER NULL,
  `max_team_members_per_site` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `HostingPackage_slug_key`(`slug`),
  UNIQUE INDEX `HostingPackage_legacy_plan_key`(`legacy_plan`),
  INDEX `HostingPackage_kind_idx`(`kind`),
  INDEX `HostingPackage_is_active_idx`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ManagedService` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `package_id` BIGINT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'n8n',
  `status` ENUM('provisioning', 'running', 'stopped', 'error', 'deleted') NOT NULL DEFAULT 'provisioning',
  `n8n_variant` ENUM('SIMPLE', 'POSTGRES', 'QUEUE') NOT NULL,
  `cpu_limit` DOUBLE NOT NULL DEFAULT 0.5,
  `memory_mb` INTEGER NOT NULL DEFAULT 512,
  `storage_gb` INTEGER NOT NULL DEFAULT 5,
  `coolify_project_id` VARCHAR(191) NULL,
  `coolify_service_id` VARCHAR(191) NULL,
  `coolify_server_uuid` VARCHAR(191) NULL,
  `coolify_destination_uuid` VARCHAR(191) NULL,
  `default_domain_target` VARCHAR(191) NULL,
  `cloudflare_dns_record_id` VARCHAR(191) NULL,
  `coolify_default_hostname` VARCHAR(191) NULL,
  `last_status_sync_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `ManagedService_tenant_id_idx`(`tenant_id`),
  INDEX `ManagedService_package_id_idx`(`package_id`),
  INDEX `ManagedService_coolify_project_id_idx`(`coolify_project_id`),
  INDEX `ManagedService_coolify_service_id_idx`(`coolify_service_id`),
  INDEX `ManagedService_default_domain_target_idx`(`default_domain_target`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Tenant`
  ADD INDEX `Tenant_package_id_idx`(`package_id`),
  ADD CONSTRAINT `Tenant_package_id_fkey`
    FOREIGN KEY (`package_id`) REFERENCES `HostingPackage`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ManagedService`
  ADD CONSTRAINT `ManagedService_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ManagedService_package_id_fkey`
    FOREIGN KEY (`package_id`) REFERENCES `HostingPackage`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `HostingPackage` (
  `name`,
  `slug`,
  `description`,
  `kind`,
  `is_active`,
  `n8n_variant`,
  `legacy_plan`,
  `max_sites`,
  `max_services`,
  `max_cpu_total`,
  `max_memory_mb_total`,
  `max_storage_gb_total`,
  `max_team_members_per_site`,
  `created_at`,
  `updated_at`
) VALUES
  ('Free Web', 'free-web', 'Starter workspace for basic trials and internal demos.', 'WEB', true, NULL, 'FREE', 1, 0, 1, 512, 5, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Pro Web', 'pro-web', 'Single-team production workloads with light collaboration.', 'WEB', true, NULL, 'PRO', 3, 0, 2, 1024, 20, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Drift Start Web', 'drift-start-web', 'Growth stage tenant with a modest project portfolio.', 'WEB', true, NULL, 'DRIFT_START', 5, 0, 2, 2048, 50, 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Drift Core Web', 'drift-core-web', 'Mainline production plan for active customer teams.', 'WEB', true, NULL, 'DRIFT_CORE', 15, 0, 4, 4096, 150, 10, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Drift Plus Web', 'drift-plus-web', 'Higher-capacity plan for larger delivery teams.', 'WEB', true, NULL, 'DRIFT_PLUS', 40, 0, 8, 8192, 500, 25, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Drift Global Web', 'drift-global-web', 'Enterprise-scale plan with wide operational headroom.', 'WEB', true, NULL, 'DRIFT_GLOBAL', 100, 0, 16, 16384, 1500, 100, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `kind` = VALUES(`kind`),
  `is_active` = VALUES(`is_active`),
  `n8n_variant` = VALUES(`n8n_variant`),
  `max_sites` = VALUES(`max_sites`),
  `max_services` = VALUES(`max_services`),
  `max_cpu_total` = VALUES(`max_cpu_total`),
  `max_memory_mb_total` = VALUES(`max_memory_mb_total`),
  `max_storage_gb_total` = VALUES(`max_storage_gb_total`),
  `max_team_members_per_site` = VALUES(`max_team_members_per_site`),
  `updated_at` = CURRENT_TIMESTAMP(3);

UPDATE `Tenant` AS `tenant`
INNER JOIN `HostingPackage` AS `pkg`
  ON `pkg`.`legacy_plan` = `tenant`.`plan`
SET `tenant`.`package_id` = `pkg`.`id`
WHERE `tenant`.`package_id` IS NULL
  AND `pkg`.`kind` = 'WEB';
