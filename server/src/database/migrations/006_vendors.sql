-- Migration: 006_vendors
-- Description: Creates the vendors table with vendor_code as Primary Key

CREATE TABLE IF NOT EXISTS vendors (
    vendor_code VARCHAR(50) NOT NULL PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendors_name (vendor_name),
    INDEX idx_vendors_status (status),
    INDEX idx_vendors_email (email)
);
