ALTER TABLE `Tenant`
  ADD COLUMN `max_storage_gb_total` INTEGER NULL;

CREATE TABLE `SitePersistentStorage` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `site_id` BIGINT NOT NULL,
  `volume_name` VARCHAR(191) NOT NULL,
  `mount_path` VARCHAR(191) NOT NULL,
  `size_gb` INTEGER NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `SitePersistentStorage_volume_name_key`(`volume_name`),
  UNIQUE INDEX `SitePersistentStorage_site_id_mount_path_key`(`site_id`, `mount_path`),
  INDEX `SitePersistentStorage_tenant_id_idx`(`tenant_id`),
  INDEX `SitePersistentStorage_site_id_idx`(`site_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SitePersistentStorage`
  ADD CONSTRAINT `SitePersistentStorage_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `Tenant`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SitePersistentStorage_site_id_fkey`
    FOREIGN KEY (`site_id`) REFERENCES `Site`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
