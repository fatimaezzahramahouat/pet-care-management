const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 5000;

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
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "ma_pet_services",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// ==========================================
// ROUTES API
// ==========================================

// 1. GET - Recherche Avancée (Modifiée pour tes filtres)
app.get('/api/services/search', (req, res) => {
    // Récupération des paramètres depuis l'URL (ex: ?type=vet&ville=Paris&animal=dog)
    const { type, ville, animal, q } = req.query;
    
    let query = 'SELECT * FROM services_animaliers WHERE 1=1';
    const params = [];
    
    // Filtre par Type (Vétérinaire, Pension...)
    if (type && type !== 'all' && type !== '') {
        query += ' AND type = ?';
        params.push(type);
    }
    
    // Filtre par Ville (Recherche flexible)
    if (ville && ville.trim() !== '') {
        query += ' AND ville LIKE ?';
        params.push(`%${ville}%`);
    }

    // Filtre par Animal (Recherche dans la description)
    if (animal && animal !== 'all') {
        // Mapping Anglais (HTML) -> Français (Base de données)
        const animalMap = {
            'dog': 'chien',
            'cat': 'chat',
            'bird': 'oiseau',
            'rabbit': 'lapin',
            'rodent': 'rongeur',
            'reptile': 'reptile'
        };
        
        // Si on trouve la traduction on l'utilise, sinon on utilise le mot original
        const searchTerm = animalMap[animal] || animal;
        
        // On cherche si le mot (ex: "chien") est dans le nom ou la description des services
        query += ' AND (services LIKE ? OR nom LIKE ?)';
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Recherche globale par mot clé (barre de recherche optionnelle)
    if (q) {
        query += ' AND (nom LIKE ? OR services LIKE ? OR ville LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    
    query += ' ORDER BY id DESC'; // Les plus récents en premier
    
    pool.query(query, params, (error, results) => {
        if (error) {
            console.error('Erreur MySQL (Search):', error);
            return res.status(500).json({ error: 'Erreur serveur lors de la recherche' });
        }
        res.json(results);
    });
});

// 2. GET - Tous les services (Route par défaut)
app.get('/api/services', (req, res) => {
    pool.query('SELECT * FROM services_animaliers ORDER BY id DESC', (error, results) => {
        if (error) {
            console.error('Erreur MySQL:', error);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json(results);
    });
});

// 3. GET - Un service par ID
app.get('/api/services/:id', (req, res) => {
    const { id } = req.params;
    
    pool.query('SELECT * FROM services_animaliers WHERE id = ?', [id], (error, results) => {
        if (error) {
            console.error('Erreur MySQL:', error);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        
        res.json(results[0]);
    });
});

// 4. POST - Ajouter un service (Avec Image)
app.post('/api/services', upload.single('image'), (req, res) => {
    const { nom, type, ville, tarifs, services, horaires, statut = 'en_attente' } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!nom || !type || !ville) {
        // Supprimer l'image uploadée si validation échoue
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ error: 'Nom, type et ville sont requis' });
    }
    
    const query = `
        INSERT INTO services_animaliers 
        (nom, type, ville, tarifs, services, horaires, statut, image) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
        nom, 
        type, 
        ville, 
        parseFloat(tarifs) || 0, 
        services || '', 
        horaires || '', 
        statut,
        image
    ];
    
    pool.query(query, params, (error, results) => {
        if (error) {
            console.error('Erreur MySQL:', error);
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(500).json({ error: 'Erreur lors de l\'ajout du service' });
        }
        
        res.json({
            success: true,
            message: 'Service ajouté avec succès',
            id: results.insertId
        });
    });
});

// 5. PUT - Mettre à jour un service
app.put('/api/services/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { nom, type, ville, tarifs, services, horaires, statut } = req.body;
    
    // Récupérer l'image actuelle
    pool.query('SELECT image FROM services_animaliers WHERE id = ?', [id], (error, results) => {
        if (error) {
            console.error('Erreur MySQL:', error);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        let imagePath = results[0]?.image;
        
        // Si nouvelle image uploadée
        if (req.file) {
            // Supprimer ancienne image si elle existe
            if (imagePath && imagePath.startsWith('/uploads/')) {
                const oldImagePath = path.join(__dirname, imagePath);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            imagePath = `/uploads/${req.file.filename}`;
        }
        
        const query = `
            UPDATE services_animaliers 
            SET nom = ?, type = ?, ville = ?, tarifs = ?, services = ?, horaires = ?, statut = ?, image = ?
            WHERE id = ?
        `;
        
        const params = [
            nom, 
            type, 
            ville, 
            parseFloat(tarifs) || 0, 
            services || '', 
            horaires || '', 
            statut || 'en_attente',
            imagePath,
            id
        ];
        
        pool.query(query, params, (error, results) => {
            if (error) {
                console.error('Erreur MySQL:', error);
                if (req.file) fs.unlink(req.file.path, () => {});
                return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
            }
            
            if (results.affectedRows === 0) {
                if (req.file) fs.unlink(req.file.path, () => {});
                return res.status(404).json({ error: 'Service non trouvé' });
            }
            
            res.json({ 
                success: true, 
                message: 'Service mis à jour avec succès' 
            });
        });
    });
});

// 6. DELETE - Supprimer un service
app.delete('/api/services/:id', (req, res) => {
    const { id } = req.params;
    
    // Récupérer l'image avant suppression
    pool.query('SELECT image FROM services_animaliers WHERE id = ?', [id], (error, results) => {
        if (error) {
            console.error('Erreur MySQL:', error);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        // Supprimer l'image associée
        if (results[0]?.image && results[0].image.startsWith('/uploads/')) {
            const imagePath = path.join(__dirname, results[0].image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        // Supprimer le service de la BDD
        pool.query('DELETE FROM services_animaliers WHERE id = ?', [id], (error, deleteResults) => {
            if (error) {
                console.error('Erreur MySQL:', error);
                return res.status(500).json({ error: 'Erreur lors de la suppression' });
            }
            
            if (deleteResults.affectedRows === 0) {
                return res.status(404).json({ error: 'Service non trouvé' });
            }
            
            res.json({ 
                success: true, 
                message: 'Service supprimé avec succès' 
            });
        });
    });
});

// ==========================================
// ROUTES UTILITAIRES & FRONTEND
// ==========================================

// Tester la connexion DB
app.get('/api/test-db', (req, res) => {
    pool.query('SELECT 1 + 1 AS solution', (error, results) => {
        if (error) return res.status(500).json({ status: 'error', message: 'Connexion MySQL échouée' });
        res.json({ status: 'success', message: 'Connexion MySQL réussie', data: results[0] });
    });
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