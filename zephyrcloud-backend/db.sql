/* ============================================================
   ZEPHYRCLOUD – Auth-ready schema (MySQL 8.0+ / MariaDB)
   ============================================================ */

-- 1) DATABASE
CREATE DATABASE IF NOT EXISTS zephyrcloud
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE zephyrcloud;

-- 2) TENANTS (a customer/company account)
CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL UNIQUE,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  suspended_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3) USERS (login accounts)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  tenant_id BIGINT UNSIGNED NULL,

  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,

  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  last_login_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_users_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE SET NULL,

  UNIQUE KEY uniq_users_email (email),
  INDEX idx_users_tenant (tenant_id)
) ENGINE=InnoDB;

-- 4) REFRESH TOKENS (recommended for real SaaS sessions)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,

  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_refresh_tokens_user (user_id),
  UNIQUE KEY uniq_refresh_token_hash (token_hash),
  INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE=InnoDB;
