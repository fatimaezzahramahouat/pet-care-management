-- Enable UUID extension (optional but good for future)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Services Table
CREATE TABLE IF NOT EXISTS services_animaliers (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'vet', 'grooming', etc.
    ville VARCHAR(100) NOT NULL,
    tarifs DECIMAL(10,2) DEFAULT 0,
    services TEXT,
    horaires VARCHAR(255),
    statut VARCHAR(50) DEFAULT 'en_attente', -- 'actif', 'inactif', 'en_attente'
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Favorites Table (Many-to-Many User <-> Service)
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services_animaliers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, service_id) -- Prevent duplicate favorites
);

-- 4. Scraped Data Table (Optional - for n8n to dump raw data if needed)
CREATE TABLE IF NOT EXISTS scraped_data (
    id SERIAL PRIMARY KEY,
    source VARCHAR(100), -- 'google_maps', etc.
    raw_data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
