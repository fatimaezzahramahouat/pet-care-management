require('dotenv').config();
const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ----------------- CONFIG SUPABASE -----------------
async function retryStorageUpload(fn, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            console.warn(`⚠️ Tentative d'upload ${i + 1}/${retries} échouée:`, err.message);
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        global: {
            fetch: (url, options) => {
                return fetch(url, { 
                    ...options, 
                    duplex: 'half'
                });
            }
        }
    }
);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ ATTENTION: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans le fichier .env');
}

// ----------------- JWT CONFIG -----------------
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// ----------------- AUTHENTICATION MIDDLEWARE -----------------
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, error: 'Accès refusé. Veuillez vous connecter.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
        req.user = user;
        next();
    });
};

// ----------------- UPLOAD IMAGES -----------------
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) return cb(null, true);
        cb(new Error('Seules les images sont autorisées'));
    }
});

// ----------------- MIDDLEWARE -----------------
app.use(cors({
    origin: function (origin, callback) {
        // Allow all origins for now - you can restrict this later
        callback(null, true);
    },
    credentials: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Remove static file serving from api/index.js - Vercel will handle this separately
// app.use(express.static(path.join(__dirname, 'public'))); // REMOVE THIS LINE

// ============================================
// IMPORTANT: ALL ROUTES WITHOUT /api PREFIX
// ============================================

// Health check endpoint (for testing)
app.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API is working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API test endpoint working',
        time: new Date().toISOString()
    });
});

// GET all services - CHANGED FROM /api/services to /services
app.get('/services', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('services_animaliers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Supabase Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET services by search/filter - CHANGED FROM /api/services/search to /services/search
app.get('/services/search', async (req, res) => {
    const { type, ville } = req.query;

    try {
        let query = supabase.from('services_animaliers').select('*');

        if (type && type !== 'all') query = query.eq('type', type);
        if (ville) query = query.ilike('ville', `%${ville}%`);

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// SCRAPING ENDPOINT (PROTECTED) - CHANGED FROM /api/scrape to /scrape
app.post('/scrape', authenticateToken, async (req, res) => {
    const { nom, email, telephone, ville, country, maxLeads } = req.body;
    const webhookUrl = process.env.SCRAPING_WEBHOOK_URL;

    if (!webhookUrl) {
        return res.status(500).json({ success: false, error: 'SCRAPING_WEBHOOK_URL non configuré sur le serveur' });
    }

    try {
        console.log('--- ENVOI REQUÊTE SCRAPING ---');
        console.log('Données:', { nom, email, ville, country, maxLeads });

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nom,
                email,
                telephone,
                ville,
                country,
                maxLeads,
                userId: req.user.id,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`n8n Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        res.json({ success: true, data: data });
    } catch (err) {
        console.error('Scraping error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET service by ID - CHANGED FROM /api/services/:id to /services/:id
app.get('/services/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('services_animaliers')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(404).json({ error: 'Service non trouvé' });
    }
});

// POST add new service with image (PROTECTED) - CHANGED FROM /api/services to /services
app.post('/services', authenticateToken, upload.single('image'), async (req, res) => {
    const { nom, type, ville, tarifs, services: description, horaires, statut = 'en_attente' } = req.body;
    let imageUrl = null;

    try {
        if (!nom || !type || !ville) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: 'Nom, type et ville sont requis' });
        }

        if (req.file) {
            console.log('--- DEBUT UPLOAD SUPABASE ---');
            
            const fileExt = path.extname(req.file.originalname);
            const fileNameRoot = path.basename(req.file.originalname, fileExt)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
            const fileName = `services/${Date.now()}_${fileNameRoot}${fileExt}`;
            
            const fileBuffer = req.file.buffer;
            
            try {
                const { data, error: uploadError } = await retryStorageUpload(async () => {
                    return await supabase.storage
                        .from('service-image')
                        .upload(fileName, fileBuffer, { 
                            contentType: req.file.mimetype,
                            cacheControl: '3600',
                            upsert: true 
                        });
                });

                if (uploadError) {
                    console.error('❌ ERREUR UPLOAD SUPABASE APRÈS RETRIES:', uploadError);
                    throw uploadError;
                }
                
                const { data: urlData } = supabase.storage
                    .from('service-image')
                    .getPublicUrl(fileName);
                
                imageUrl = urlData.publicUrl;
            } catch (err) {
                console.error('🔥 CRASH PENDANT UPLOAD:', err);
                return res.status(500).json({ success: false, error: 'Erreur Supabase Storage: ' + err.message });
            }
        }

        const { data, error } = await supabase
            .from('services_animaliers')
            .insert([{
                nom: nom,
                type: type,
                ville: ville,
                tarifs: parseFloat(tarifs) || 0,
                services: description || '',
                horaires: horaires || '',
                statut: statut,
                image: imageUrl
            }])
            .select();

        if (error) {
            console.error('❌ ERREUR DB INSERT:', error);
            throw error;
        }
        res.json({ success: true, service: data[0] });
    } catch (err) {
        console.error('🔥 ERREUR CRITIQUE POST /services:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT update service with image (PROTECTED) - CHANGED FROM /api/services/:id to /services/:id
app.put('/services/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { nom, type, ville, tarifs, services: description, horaires, statut } = req.body;

    try {
        let updates = {
            nom: nom,
            type,
            ville: ville,
            tarifs: parseFloat(tarifs) || 0,
            services: description || '',
            horaires: horaires || '',
            statut: statut || 'en_attente'
        };

        if (req.file) {
            console.log('--- DEBUT UPLOAD (EDIT) SUPABASE ---');
            
            const fileExt = path.extname(req.file.originalname);
            const fileNameRoot = path.basename(req.file.originalname, fileExt)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
            const fileName = `services/${Date.now()}_${fileNameRoot}${fileExt}`;
            
            const fileBuffer = req.file.buffer;
            
            try {
                const { error: uploadError } = await retryStorageUpload(async () => {
                    return await supabase.storage
                        .from('service-image')
                        .upload(fileName, fileBuffer, { 
                            contentType: req.file.mimetype,
                            cacheControl: '3600',
                            upsert: true 
                        });
                });

                if (uploadError) throw uploadError;
                
                const { data: urlData } = supabase.storage
                    .from('service-image')
                    .getPublicUrl(fileName);
                
                updates.image = urlData.publicUrl;
            } catch (err) {
                console.error('🔥 CRASH STORAGE EDIT:', err);
                return res.status(500).json({ success: false, error: 'Erreur Supabase Storage (Edit): ' + err.message });
            }
        }

        const { data, error } = await supabase
            .from('services_animaliers')
            .update(updates)
            .eq('id', id);
        
        if (error) {
            console.error('❌ ERREUR DB UPDATE:', error);
            throw error;
        }
        res.json({ success: true, message: 'Service mis à jour avec succès' });
    } catch (err) {
        console.error('🔥 ERREUR CRITIQUE PUT /services/:id:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE service (PROTECTED) - CHANGED FROM /api/services/:id to /services/:id
app.delete('/services/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('services_animaliers')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Service supprimé avec succès' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// AUTH ROUTES (CHANGED FROM /api/auth/* to /auth/*)
// ===============================

// POST /auth/register - CHANGED FROM /api/auth/register to /auth/register
app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } }
        });

        if (authError) throw authError;

        const { data, error } = await supabase
            .from('users')
            .insert([{
                name,
                email,
                password: hashedPassword,
                role: 'user'
            }])
            .select();

        if (error) throw error;

        const user = data[0];

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /auth/login - CHANGED FROM /api/auth/login to /auth/login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erreur serveur, veuillez réessayer' });
    }
});

// ===============================
// SIMPLER AUTH ENDPOINTS (CHANGED FROM /api/* to /*)
// ===============================

// POST /register - CHANGED FROM /api/register to /register
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Cet email est déjà enregistré' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{
                name,
                email,
                password: hashedPassword,
                role: 'user'
            }])
            .select();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès ! Veuillez vous connecter.',
            user: {
                id: data[0].id,
                name: data[0].name,
                email: data[0].email
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, error: err.message || 'Erreur lors de l\'inscription' });
    }
});

// POST /login - CHANGED FROM /api/login to /login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
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

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Erreur serveur, veuillez réessayer' });
    }
});

// GET /me - CHANGED FROM /api/me to /me
app.get('/me', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ success: true, user: decoded });
    } catch (err) {
        res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
    }
});

// ===============================
// FAVORITES ROUTES (CHANGED FROM /api/favorites/* to /favorites/*)
// ===============================

// GET /favorites/:userId - CHANGED FROM /api/favorites/:userId to /favorites/:userId
app.get('/favorites/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.id;

    if (userId != authenticatedUserId && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }
    
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select(`
                *,
                services_animaliers (*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        res.json({ 
            success: true, 
            favorites: data || [],
            count: data ? data.length : 0
        });
    } catch (err) {
        console.error('Favorites GET error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message || 'Erreur lors de la récupération des favoris',
            favorites: []
        });
    }
});

// POST /favorites - CHANGED FROM /api/favorites to /favorites
app.post('/favorites', authenticateToken, async (req, res) => {
    const { user_id, service_id } = req.body;
    const authenticatedUserId = req.user.id;

    if (user_id != authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }
    
    try {
        const { data: existing, error: checkError } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', user_id)
            .eq('service_id', service_id);

        if (checkError) {
            console.error('Check error:', checkError);
        }

        if (existing && existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Ce service est déjà dans vos favoris',
                favorite: existing[0]
            });
        }

        const { data, error } = await supabase
            .from('favorites')
            .insert([{ 
                user_id, 
                service_id,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            console.error('Insert error:', error);
            if (error.code === '23505') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Ce service est déjà dans vos favoris'
                });
            }
            throw error;
        }

        res.json({ 
            success: true, 
            favorite: data[0],
            message: 'Service ajouté aux favoris'
        });
    } catch (err) {
        console.error('Favorites POST error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message || 'Erreur lors de l\'ajout aux favoris' 
        });
    }
});

// DELETE /favorites - CHANGED FROM /api/favorites to /favorites
app.delete('/favorites', authenticateToken, async (req, res) => {
    const { user_id, service_id } = req.body;
    const authenticatedUserId = req.user.id;

    if (user_id != authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }
    
    if (!user_id || !service_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'user_id et service_id sont requis' 
        });
    }
    
    try {
        const { error, count } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user_id)
            .eq('service_id', service_id);

        if (error) throw error;

        res.json({ 
            success: true, 
            message: 'Favori supprimé avec succès',
            deleted_count: count
        });
    } catch (err) {
        console.error('Favorites DELETE error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message || 'Erreur lors de la suppression du favori' 
        });
    }
});

// ===============================
// TEST ENDPOINTS (CHANGED FROM /api/* to /*)
// ===============================

// GET /test - CHANGED FROM /api/test to /test
app.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API fonctionne correctement', 
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.SUPABASE_URL ? 'Configured' : 'Missing'
    });
});

// POST /upload-test - CHANGED FROM /api/upload-test to /upload-test
app.post('/upload-test', upload.single('testImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucune image uploadée' });

    try {
        const fileBuffer = req.file.buffer;
        const fileName = `test/${Date.now()}_${req.file.originalname}`;
        
        const { data, error: uploadError } = await supabase.storage
            .from('service-image')
            .upload(fileName, fileBuffer, { contentType: req.file.mimetype });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
            .from('service-image')
            .getPublicUrl(fileName);
        
        res.json({ success: true, url: urlData.publicUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /test-supabase - CHANGED FROM /api/test-supabase to /test-supabase
app.get('/test-supabase', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('services_animaliers')
            .select('id, nom')
            .limit(1);

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'Supabase DB connected successfully ✅',
            data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ===============================
// ERROR HANDLING
// ===============================

// MIDDLEWARE ERRORS
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, error: 'Image max 5MB' });
        return res.status(400).json({ success: false, error: 'Erreur lors de l\'upload de l\'image' });
    }
    console.error('Erreur générale:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Erreur interne du serveur',
        details: err.message,
        path: req.path
    });
});

// 404 handler for API
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint non trouvé',
        path: req.originalUrl
    });
});

// ============================================
// EXPORT THE APP FOR VERCEL
// ============================================

module.exports = app;