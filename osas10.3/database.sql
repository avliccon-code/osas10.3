-- ============================================================
-- Dingalan Community College - Office of Student Affairs & Services (OSAS)
-- MySQL Database Export for Localhost / phpMyAdmin
-- Compatible with XAMPP / WAMP / LAMP / MySQL 5.7+ & MySQL 8.0+ / MariaDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS `osas_dcc_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `osas_dcc_db`;

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) DEFAULT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `role` ENUM('ADMIN', 'STUDENT') NOT NULL DEFAULT 'STUDENT',
  `avatar_url` TEXT DEFAULT NULL,
  `year_level` VARCHAR(50) DEFAULT NULL,
  `course` VARCHAR(100) DEFAULT NULL,
  `one_time_password` VARCHAR(20) DEFAULT NULL,
  `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `announcements`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `announcements` (
  `id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `category` ENUM('SCHOOL', 'SCHOLARSHIP', 'DORMITORY') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiration_date` DATE NOT NULL,
  `image_url` TEXT DEFAULT NULL,
  `external_link` TEXT DEFAULT NULL,
  `posted_by` VARCHAR(100) NOT NULL,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `scholarship_id` VARCHAR(50) DEFAULT NULL,
  `dorm_room_id` VARCHAR(50) DEFAULT NULL,
  `heart_reacts` JSON DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `scholarships`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `scholarships` (
  `id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `requirements` TEXT NOT NULL,
  `deadline` DATE NOT NULL,
  `amount` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('ACTIVE', 'CLOSED', 'DRAFT') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `scholarship_applications`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `scholarship_applications` (
  `id` VARCHAR(50) NOT NULL,
  `scholarship_id` VARCHAR(50) NOT NULL,
  `scholarship_title` VARCHAR(255) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `student_email` VARCHAR(150) NOT NULL,
  `course` VARCHAR(100) NOT NULL,
  `year_level` VARCHAR(50) NOT NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `admin_notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_scholarship_id` (`scholarship_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `appointments`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `appointments` (
  `id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `student_email` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `preferred_date` DATE NOT NULL,
  `preferred_time` VARCHAR(50) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'RESCHEDULED', 'REJECTED', 'DONE_ADMIN', 'DONE_STUDENT', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
  `admin_preferred_date` DATE DEFAULT NULL,
  `admin_preferred_time` VARCHAR(50) DEFAULT NULL,
  `admin_notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `admin_marked_done` TINYINT(1) NOT NULL DEFAULT 0,
  `student_marked_done` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `safety_reports`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `safety_reports` (
  `id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0,
  `description` TEXT NOT NULL,
  `involved_persons` TEXT NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `evidence_url` TEXT DEFAULT NULL,
  `reported_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('REPORTED', 'RESOLVED', 'ESCALATED') NOT NULL DEFAULT 'REPORTED',
  `is_urgent` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `dorm_rooms`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `dorm_rooms` (
  `id` VARCHAR(50) NOT NULL,
  `room_number` VARCHAR(50) NOT NULL,
  `floor` VARCHAR(50) NOT NULL,
  `capacity` INT NOT NULL DEFAULT 4,
  `gender` ENUM('MALE', 'FEMALE', 'COED') NOT NULL DEFAULT 'COED',
  `occupied_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('AVAILABLE', 'FULL', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `dorm_residents`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `dorm_residents` (
  `id` VARCHAR(50) NOT NULL,
  `room_id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `assigned_date` DATE NOT NULL,
  `contact_number` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_room_id` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `dorm_applicants`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `dorm_applicants` (
  `id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `student_email` VARCHAR(150) NOT NULL,
  `address` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `attachment_url` TEXT DEFAULT NULL,
  `attachment_name` VARCHAR(255) DEFAULT NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `assigned_room_number` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `disciplinary_records`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `disciplinary_records` (
  `id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `offense_type` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `sanction` TEXT NOT NULL,
  `date_logged` DATE NOT NULL,
  `issued_by` VARCHAR(150) NOT NULL,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `admin_marked_done` TINYINT(1) NOT NULL DEFAULT 0,
  `student_marked_done` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('SANCTIONED', 'COMPLETED') NOT NULL DEFAULT 'SANCTIONED',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `student_feedbacks`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `student_feedbacks` (
  `id` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `activity_logs`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` VARCHAR(50) NOT NULL,
  `action` VARCHAR(150) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `performed_by` VARCHAR(150) NOT NULL,
  `details` TEXT NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `system_notifications`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `system_notifications` (
  `id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('SAFETY', 'APPOINTMENT', 'SCHOLARSHIP', 'DORM', 'ANNOUNCEMENT', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `link_module` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `archive_items`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `archive_items` (
  `id` VARCHAR(50) NOT NULL,
  `original_id` VARCHAR(50) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `archived_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CLEAN INITIAL STATE (NO SAMPLE OR TEST RECORDS)
-- ============================================================

-- Commit transaction
COMMIT;

