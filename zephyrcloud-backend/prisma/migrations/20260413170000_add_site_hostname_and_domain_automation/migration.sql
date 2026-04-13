ALTER TABLE `site`
    ADD COLUMN `default_domain_target` VARCHAR(191) NULL,
    ADD COLUMN `cloudflare_dns_record_id` VARCHAR(191) NULL,
    ADD COLUMN `coolify_default_hostname` VARCHAR(191) NULL;

CREATE INDEX `Site_default_domain_target_idx` ON `site`(`default_domain_target`);

ALTER TABLE `domain`
    ADD COLUMN `target_hostname` VARCHAR(191) NULL,
    ADD COLUMN `routing_mode` ENUM('subdomain_cname', 'apex_flattening', 'apex_alias') NULL,
    ADD COLUMN `verification_started_at` DATETIME(3) NULL,
    ADD COLUMN `verification_checked_at` DATETIME(3) NULL,
    ADD COLUMN `verified_at` DATETIME(3) NULL,
    ADD COLUMN `coolify_attached_at` DATETIME(3) NULL,
    ADD COLUMN `ssl_ready_at` DATETIME(3) NULL,
    ADD COLUMN `diagnostic_message` TEXT NULL,
    ADD COLUMN `retry_count` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `domain`
    MODIFY `status` ENUM(
        'pending_ns',
        'verifying',
        'active',
        'error',
        'pending_dns',
        'verified_dns',
        'attaching',
        'ssl_issuing',
        'verification_failed_timeout'
    ) NOT NULL DEFAULT 'pending_dns';

UPDATE `domain`
SET `status` = 'pending_dns'
WHERE `status` IN ('pending_ns', 'verifying');

ALTER TABLE `domain`
    MODIFY `status` ENUM(
        'pending_dns',
        'verified_dns',
        'attaching',
        'ssl_issuing',
        'active',
        'verification_failed_timeout',
        'error'
    ) NOT NULL DEFAULT 'pending_dns';
