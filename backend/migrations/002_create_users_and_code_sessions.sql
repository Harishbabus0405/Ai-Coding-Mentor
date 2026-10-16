-- AI Coding Mentor — Phase 6: Authentication, Users & Code Sessions Migration
-- Target: MySQL 8.0+

CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `code_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL DEFAULT 'Untitled Session',
    `language` VARCHAR(32) NOT NULL,
    `source_code` MEDIUMTEXT NOT NULL,
    `execution_status` VARCHAR(32) NULL,
    `stdout` MEDIUMTEXT NULL,
    `stderr` MEDIUMTEXT NULL,
    `compile_output` MEDIUMTEXT NULL,
    `execution_time` FLOAT NULL,
    `memory_used` INT NULL,
    `analysis_summary` MEDIUMTEXT NULL,
    `analysis_results` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_code_sessions_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional addition of user_id to interview_sessions if not yet added
-- ALTER TABLE `interview_sessions` ADD COLUMN `user_id` VARCHAR(36) NULL AFTER `id`;
-- ALTER TABLE `interview_sessions` ADD CONSTRAINT `fk_interview_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
