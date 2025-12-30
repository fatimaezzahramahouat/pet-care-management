const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || "your_secret_key_here";

const app = express();
const port = process.env.PORT || 5000;


import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// CONFIGURATION INITIALE
// ==========================================

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public")); // Servir les fichiers statiques (css, js)
app.use('/uploads', express.static('uploads')); // IMPORTANT: Servir les images uploadées

// Configuration de Multer pour les images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Nom unique pour éviter les doublons
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Seules les images sont autorisées (jpg, png, gif, webp)'));
    }
});

// ==========================================
// BASE DE DONNÉES (MySQL)
// ==========================================
// ==========================================
// BASE DE DONNÉES (PostgreSQL/Supabase)
// ==========================================
// NOTE: Vous devez définir DATABASE_URL dans votre fichier .env ou variables d'environnement Vercel.
// Format: postgres://user:password@host:port/database

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test de connexion et Initialisation des Tables
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Erreur de connexion à PostgreSQL:', err.stack);
    }
    console.log('Connecté à PostgreSQL avec succès');
});

// Création des tables (Schema)
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS services_animaliers (
                id SERIAL PRIMARY KEY,
                nom VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                ville VARCHAR(100) NOT NULL,
                tarifs DECIMAL(10,2) DEFAULT 0,
                services TEXT,
                horaires VARCHAR(255),
                statut VARCHAR(50) DEFAULT 'en_attente',
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                service_id INTEGER REFERENCES services_animaliers(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, service_id)
            );
        `);

        console.log("Tables initialisées avec succès.");
    } catch (err) {
        console.error("Erreur d'initialisation DB:", err);
    }
};

initDb();

// ==========================================
// ROUTES API
// ==========================================

// 0. AUTHENTIFICATION
// -------------------

// Inscription
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    try {
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );

        res.status(201).json({
            success: true,
            message: 'Inscription réussie ! Vous pouvez maintenant vous connecter.',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('Erreur Register:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'inscription' });
    }
});

// Connexion
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Erreur Login:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
    }
});

// Vérifier le Token (pour le Dashboard)
app.get('/api/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Accès refusé' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });
        res.json(user);
    });
});

// 1. GET - Recherche Avancée
app.get('/api/services/search', async (req, res) => {
    const { type, ville, animal, q } = req.query;

    try {
        let sql = 'SELECT * FROM services_animaliers WHERE 1=1';
        const values = [];
        let p = 1;

        if (type && type !== 'all') {
            sql += ` AND type = $${p++}`;
            values.push(type);
        }
        if (ville) {
            sql += ` AND ville ILIKE $${p++}`;
            values.push(`%${ville}%`);
        }

        sql += ' ORDER BY id DESC';

        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur Search:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 2. GET - Tous les services
app.get('/api/services', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services_animaliers ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur Services:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 3. GET - Un service par ID
app.get('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM services_animaliers WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erreur Service ID:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 4. POST - Ajouter un service
app.post('/api/services', upload.single('image'), async (req, res) => {
    const { nom, type, ville, tarifs, services, horaires, statut = 'en_attente' } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!nom || !type || !ville) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(400).json({ error: 'Nom, type et ville sont requis' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO services_animaliers (nom, type, ville, tarifs, services, horaires, statut, image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [nom, type, ville, parseFloat(tarifs) || 0, services || '', horaires || '', statut, image]
        );

        res.json({
            success: true,
            message: 'Service ajouté avec succès',
            id: result.rows[0].id
        });
    } catch (error) {
        console.error('Erreur Ajout Service:', error);
        if (req.file) fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: 'Erreur lors de l\'ajout' });
    }
});

// 5. PUT - Mettre à jour un service
app.put('/api/services/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { nom, type, ville, tarifs, services, horaires, statut } = req.body;

    try {
        // Obtenir l'ancienne image
        const oldService = await pool.query('SELECT image FROM services_animaliers WHERE id = $1', [id]);

        let imagePath = oldService.rows[0]?.image;

        if (req.file) {
            if (imagePath && imagePath.startsWith('/uploads/')) {
                const oldLocalPath = path.join(__dirname, imagePath);
                if (fs.existsSync(oldLocalPath)) fs.unlinkSync(oldLocalPath);
            }
            imagePath = `/uploads/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE services_animaliers 
             SET nom = $1, type = $2, ville = $3, tarifs = $4, services = $5, horaires = $6, statut = $7, image = $8
             WHERE id = $9`,
            [nom, type, ville, parseFloat(tarifs) || 0, services || '', horaires || '', statut || 'en_attente', imagePath, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }

        res.json({ success: true, message: 'Service mis à jour avec succès' });

    } catch (error) {
        console.error('Erreur Update:', error);
        if (req.file) fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// 6. DELETE - Supprimer un service
app.delete('/api/services/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const oldService = await pool.query('SELECT image FROM services_animaliers WHERE id = $1', [id]);
        const imagePath = oldService.rows[0]?.image;

        if (imagePath && imagePath.startsWith('/uploads/')) {
            const oldLocalPath = path.join(__dirname, imagePath);
            if (fs.existsSync(oldLocalPath)) fs.unlinkSync(oldLocalPath);
        }

        const result = await pool.query('DELETE FROM services_animaliers WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }

        res.json({ success: true, message: 'Service supprimé avec succès' });

    } catch (error) {
        console.error('Erreur Delete:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==========================================
// ROUTES FAVORIS & AUTOMATISATION
// ==========================================

// Ajouter aux favoris
app.post('/api/favorites', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Non authentifié' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const { service_id } = req.body;

        await pool.query(
            'INSERT INTO favorites (user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [decoded.id, service_id]
        );

        res.json({ success: true, message: 'Ajouté aux favoris' });
    } catch (err) {
        console.error('Erreur Favorite:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Récupérer les favoris d'un utilisateur
app.get('/api/favorites', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Non authentifié' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);

        const result = await pool.query(
            `SELECT s.* FROM services_animaliers s
             JOIN favorites f ON s.id = f.service_id
             WHERE f.user_id = $1
             ORDER BY f.created_at DESC`,
            [decoded.id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur Get Favorites:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Webhook pour n8n (Automation)
// Sécuriser avec une clé header dans un vrai projet
app.post('/api/webhooks/services', async (req, res) => {
    const services = req.body; // Supposons un array de services

    if (!Array.isArray(services)) {
        return res.status(400).json({ error: 'Format invalide, array attendu' });
    }

    try {
        let count = 0;
        for (const s of services) {
            // Insérer ou mettre à jour si existe (basé sur nom ou autre)
            // Pour l'instant on insert simple pour l'exemple
            await pool.query(
                `INSERT INTO services_animaliers (nom, type, ville, tarifs, services, horaires)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [s.nom, s.type, s.ville, s.tarifs || 0, s.services, s.horaires]
            );
            count++;
        }
        res.json({ success: true, message: `${count} services importés via automation.` });
    } catch (err) {
        console.error('Erreur Webhook:', err);
        res.status(500).json({ error: 'Erreur serveur lors de l\'import' });
    }
});

// Tester la connexion DB
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT 1 + 1 AS solution');
        res.json({ status: 'success', message: 'Connexion PostgreSQL réussie', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Echec connexion DB', error: err.message });
    }
});

// Servir la page principale
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Gestion des erreurs Multer (ex: fichier trop gros)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'L\'image est trop volumineuse (max 5MB)' });
        }
        return res.status(400).json({ error: 'Erreur lors de l\'upload de l\'image' });
    }
    next(err);
});

// Route 404
app.use((req, res) => {
    res.status(404).send('Page non trouvée');
});

// ==========================================
// DÉMARRAGE DU SERVEUR
// ==========================================
app.listen(port, () => {
    console.log(`===========================================`);
    console.log(`🚀 Serveur démarré sur le port ${port}`);
    console.log(`📂 Dossier images: /uploads`);
    console.log(`🔗 Accès: http://localhost:${port}`);
    console.log(`===========================================`);
});