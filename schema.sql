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

-- Insert sample users (password is 'admin123' hashed with bcrypt)
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@petcare.com', '$2b$10$k5Q5v5wQ5d5q5G5f5h5j5u5i5o5p5a5s5s5w5o5r5d', 'admin'),
('John Doe', 'john@example.com', '$2b$10$k5Q5v5wQ5d5q5G5f5h5j5u5i5o5p5a5s5s5w5o5r5d', 'user'),
('Jane Smith', 'jane@example.com', '$2b$10$k5Q5v5wQ5d5q5G5f5h5j5u5i5o5p5a5s5s5w5o5r5d', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert sample services
INSERT INTO services_animaliers (nom, type, ville, tarifs, services, horaires, statut, image) VALUES
-- Vétérinaires à Paris
('Clinique Vétérinaire Saint-Germain', 'vet', 'Paris', 50.00, 'Consultations, vaccinations, urgences 24h/24, chirurgie, radiologie', 'Lun-Ven: 9h-19h, Sam: 9h-17h', 'actif', 'vet_paris1.jpg'),
('Hôpital Vétérinaire de Paris Est', 'vet', 'Paris', 55.00, 'Soins intensifs, scanner, échographie, dentisterie', '7j/7, 24h/24', 'actif', 'vet_paris2.jpg'),
('Cabinet Vétérinaire Montmartre', 'vet', 'Paris', 45.00, 'Médecine générale, vaccinations annuelles, conseils nutrition', 'Lun-Sam: 8h-18h', 'actif', 'vet_paris3.jpg'),

-- Toiletteurs à Paris
('Toilettage Canin Paris Centre', 'grooming', 'Paris', 35.00, 'Bain complet, coupe au ciseau, tonte, soins des griffes, nettoyage des oreilles', 'Mar-Sam: 10h-18h', 'actif', 'grooming_paris1.jpg'),
('Spa Canin Paris Ouest', 'grooming', 'Paris', 50.00, 'Toilettage premium, bain relaxant aux huiles essentielles, massage, brushing', 'Lun-Sam: 9h-19h', 'actif', 'grooming_paris2.jpg'),
('Chat Beauté Paris', 'grooming', 'Paris', 40.00, 'Toilettage spécial chat, coupe des griffes, brossage, soins des yeux', 'Mer-Dim: 9h-17h', 'actif', 'grooming_paris3.jpg'),

-- Pensions à Paris
('Pension Canine Paris Nord', 'boarding', 'Paris', 25.00, 'Garde de chiens, promenades quotidiennes, aire de jeux sécurisée, nourriture premium', '7j/7, Réception: 8h-20h', 'actif', 'boarding_paris1.jpg'),
('Chatelaine Paris Sud', 'boarding', 'Paris', 20.00, 'Garde de chats, appartements individuels, jeux interactifs, webcam disponible', 'Réception: 9h-19h', 'actif', 'boarding_paris2.jpg'),
('Ferme Pédagogique Paris Est', 'boarding', 'Paris', 30.00, 'Garde d''animaux de ferme, rongeurs, lapins, espaces naturels', 'Lun-Dim: 8h-18h', 'actif', 'boarding_paris3.jpg'),

-- Vétérinaires à Lyon
('Clinique Vétérinaire Lyon Centre', 'vet', 'Lyon', 48.00, 'Consultations, vaccinations, analyses sanguines, imagerie médicale', 'Lun-Ven: 8h-20h, Sam: 9h-16h', 'actif', 'vet_lyon1.jpg'),
('Urgences Vétérinaires Lyon Sud', 'vet', 'Lyon', 60.00, 'Urgences 24h/24, soins intensifs, chirurgie d''urgence', '7j/7, 24h/24', 'actif', 'vet_lyon2.jpg'),

-- Toiletteurs à Lyon
('Toilettage Lyon Confluence', 'grooming', 'Lyon', 32.00, 'Toilettage toutes races, coupe hygiénique, bain thérapeutique', 'Mar-Sam: 9h-17h30', 'actif', 'grooming_lyon1.jpg'),
('Institut Félin Lyon', 'grooming', 'Lyon', 45.00, 'Spécialisé chats, toilettage sans stress, espace adapté', 'Mer-Dim: 10h-18h', 'actif', 'grooming_lyon2.jpg'),

-- Pensions à Lyon
('Pension Les 4 Pattes Lyon', 'boarding', 'Lyon', 22.00, 'Garde chien et chat, promenades en forêt, espace climatisé', 'Réception: 7h30-21h', 'actif', 'boarding_lyon1.jpg'),
('Villa des Animaux Lyon', 'boarding', 'Lyon', 28.00, 'Garde en maison individuelle, jardin sécurisé, famille d''accueil', 'Sur rendez-vous', 'actif', 'boarding_lyon2.jpg'),

-- Vétérinaires à Marseille
('Clinique Vétérinaire Marseille Vieux-Port', 'vet', 'Marseille', 42.00, 'Médecine générale, chirurgie, hospitalisation, pharmacie', 'Lun-Sam: 8h30-19h', 'actif', 'vet_marseille1.jpg'),
('Cabinet Vétérinaire Marseille Nord', 'vet', 'Marseille', 38.00, 'Consultations, vaccinations, petite chirurgie, conseils comportement', 'Lun-Ven: 9h-18h', 'actif', 'vet_marseille2.jpg'),

-- Toiletteurs à Marseille
('Toilettage Canin Marseille Plage', 'grooming', 'Marseille', 30.00, 'Toilettage en bord de mer, bain de mer thérapeutique, coupe été', 'Avr-Oct: 8h-19h', 'actif', 'grooming_marseille1.jpg'),
('Salon Doggy Marseille', 'grooming', 'Marseille', 35.00, 'Toilettage créatif, colorations végétales, accessoires', 'Mar-Sam: 10h-18h', 'actif', 'grooming_marseille2.jpg'),

-- Pensions à Marseille
('Pension Calanques Animaux', 'boarding', 'Marseille', 24.00, 'Garde avec vue sur mer, promenades en calanques, natation', '7j/7', 'actif', 'boarding_marseille1.jpg'),
('Refuge Gardiennage Marseille', 'boarding', 'Marseille', 18.00, 'Garde économique, espace vert, association à but non lucratif', 'Lun-Dim: 8h-20h', 'actif', 'boarding_marseille2.jpg'),

-- Services d''éducation à Paris
('École Canine Paris', 'training', 'Paris', 40.00, 'Éducation canine, dressage, agility, comportementaliste', 'Lun-Sam: 9h-18h, cours particuliers sur RDV', 'actif', 'training_paris1.jpg'),
('Comportementaliste Félin Paris', 'training', 'Paris', 55.00, 'Thérapie comportementale chat, conseils environnementaux', 'Sur rendez-vous', 'actif', 'training_paris2.jpg'),

-- Services de promenade à Lyon
('Dog Walker Lyon', 'walking', 'Lyon', 15.00, 'Promenades individuelles ou en groupe, sorties en forêt, garde ponctuelle', 'Lun-Dim: 7h-21h', 'actif', 'walking_lyon1.jpg'),
('Promeneurs Pros Marseille', 'walking', 'Marseille', 12.00, 'Promenades adaptées à chaque chien, suivi GPS, photos envoyées', 'Lun-Sam: 8h-20h', 'actif', 'walking_marseille1.jpg'),

-- Autres services
('Taxi Animalier Paris', 'other', 'Paris', 25.00, 'Transport d''animaux, véhicule adapté, accompagnement vétérinaire', 'Sur réservation 24h/24', 'actif', 'other_paris1.jpg'),
('Photographe Animalier Lyon', 'other', 'Lyon', 80.00, 'Séances photo animaux, portraits, reportages', 'Sur rendez-vous, week-ends', 'actif', 'other_lyon1.jpg'),
('Crémation Animale Marseille', 'other', 'Marseille', 120.00, 'Services funéraires pour animaux, urne, souvenirs', 'Lun-Ven: 9h-17h, urgences 24h/24', 'actif', 'other_marseille1.jpg');

-- Insert sample favorites (assuming users with IDs 2 and 3 exist)
INSERT INTO favorites (user_id, service_id) VALUES
(2, 1),  -- John Doe likes Clinique Vétérinaire Saint-Germain
(2, 5),  -- John Doe likes Toilettage Canin Paris Centre
(2, 8),  -- John Doe likes Pension Canine Paris Nord
(3, 2),  -- Jane Smith likes Hôpital Vétérinaire de Paris Est
(3, 6),  -- Jane Smith likes Spa Canin Paris Ouest
(3, 9)   -- Jane Smith likes Ferme Pédagogique Paris Est
ON CONFLICT (user_id, service_id) DO NOTHING;

-- Insert sample scraped data (for n8n automation)
INSERT INTO scraped_data (source, raw_data, processed) VALUES
('google_maps', '{"nom": "Clinique Vétérinaire Scrapée", "type": "vet", "ville": "Lille", "adresse": "123 Rue Scrapée", "note": 4.5, "avis_count": 42}', false),
('google_maps', '{"nom": "Toilettage Scrapé", "type": "grooming", "ville": "Nice", "adresse": "456 Avenue Scrapée", "note": 4.2, "avis_count": 28}', false);