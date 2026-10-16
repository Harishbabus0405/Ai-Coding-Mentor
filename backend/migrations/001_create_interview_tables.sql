-- AI Coding Mentor — Phase 5: AI Interview Coach Migration
-- Target: MySQL 8.0+

CREATE TABLE IF NOT EXISTS `interview_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `source_code` MEDIUMTEXT NOT NULL,
    `language` VARCHAR(32) NOT NULL,
    `topic` VARCHAR(64) NOT NULL DEFAULT 'mixed',
    `difficulty` VARCHAR(32) NOT NULL DEFAULT 'intermediate',
    `num_questions` INT NOT NULL DEFAULT 3,
    `current_question_index` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    `final_score` FLOAT NULL,
    `overall_feedback` MEDIUMTEXT NULL,
    `strengths` JSON NULL,
    `areas_for_revision` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `interview_questions` (
    `id` VARCHAR(64) NOT NULL,
    `session_id` VARCHAR(36) NOT NULL,
    `question_index` INT NOT NULL,
    `question_text` MEDIUMTEXT NOT NULL,
    `topic` VARCHAR(64) NOT NULL,
    `difficulty` VARCHAR(32) NOT NULL,
    `question_type` VARCHAR(64) NOT NULL,
    `expected_concepts` JSON NOT NULL,
    `evaluation_criteria` MEDIUMTEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_questions_session` FOREIGN KEY (`session_id`) 
        REFERENCES `interview_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `interview_answers` (
    `id` VARCHAR(36) NOT NULL,
    `session_id` VARCHAR(36) NOT NULL,
    `question_id` VARCHAR(64) NOT NULL,
    `user_answer` MEDIUMTEXT NOT NULL,
    `score` FLOAT NOT NULL,
    `correct_concepts` JSON NOT NULL,
    `missing_concepts` JSON NOT NULL,
    `incorrect_statements` JSON NOT NULL,
    `feedback` MEDIUMTEXT NOT NULL,
    `suggested_improvements` MEDIUMTEXT NOT NULL,
    `reference_answer` MEDIUMTEXT NOT NULL,
    `is_sufficient` BOOLEAN NOT NULL DEFAULT TRUE,
    `retry_count` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_answers_session` FOREIGN KEY (`session_id`) 
        REFERENCES `interview_sessions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_answers_question` FOREIGN KEY (`question_id`) 
        REFERENCES `interview_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `interview_follow_ups` (
    `id` VARCHAR(36) NOT NULL,
    `session_id` VARCHAR(36) NOT NULL,
    `question_id` VARCHAR(64) NOT NULL,
    `follow_up_text` MEDIUMTEXT NOT NULL,
    `follow_up_type` VARCHAR(32) NOT NULL,
    `user_answer` MEDIUMTEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_follow_ups_session` FOREIGN KEY (`session_id`) 
        REFERENCES `interview_sessions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_follow_ups_question` FOREIGN KEY (`question_id`) 
        REFERENCES `interview_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
