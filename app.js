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
const port = process.env.PORT || 5000;

// ----------------- CONFIG SUPABASE -----------------
// Helper for retry
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
            // Increase timeout for slow connections
            fetch: (url, options) => {
                return fetch(url, { 
                    ...options, 
                    // @ts-ignore
                    duplex: 'half' // Required for Node 18+ and large payloads
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
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

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
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use('/uploads', express.static('uploads'));

// ----------------- ROUTES -----------------

// GET all services
app.get('/api/services', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('services_animaliers') // Fixed table name
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Supabase Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET services by search/filter
app.get('/api/services/search', async (req, res) => {
    const { type, ville } = req.query;

    try {
        let query = supabase.from('services_animaliers').select('*');

        if (type && type !== 'all') query = query.eq('type', type);
        if (ville) query = query.ilike('ville', `%${ville}%`); // Fixed column name

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// SCRAPING ENDPOINT (PROTECTED)
app.post('/api/scrape', authenticateToken, async (req, res) => {
    const { nom, email, telephone, ville, country, maxLeads } = req.body;
    const webhookUrl = process.env.SCRAPING_WEBHOOK_URL;

    if (!webhookUrl) {
        return res.status(500).json({ success: false, error: 'SCRAPING_WEBHOOK_URL non configuré sur le serveur' });
    }

    try {
        console.log('--- ENVOI REQUÊTE SCRAPING ---');
        console.log('Données:', { nom, email, ville, country, maxLeads });

        // Appel au webhook n8n
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

// GET service by ID
app.get('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('services_animaliers') // Fixed table name
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

// POST add new service with image (PROTECTED)
app.post('/api/services', authenticateToken, upload.single('image'), async (req, res) => {
    const { nom, type, ville, tarifs, services: description, horaires, statut = 'en_attente' } = req.body;
    let imageUrl = null;

    try {
        if (!nom || !type || !ville) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: 'Nom, type et ville sont requis' });
        }

        // Upload image to Supabase Storage if exists
        if (req.file) {
            console.log('--- DEBUT UPLOAD SUPABASE ---');
            console.log('Fichier reçu:', req.file.originalname);
            
            // Normaliser le nom du fichier (supprimer les caractères spéciaux)
            const fileExt = path.extname(req.file.originalname);
            const fileNameRoot = path.basename(req.file.originalname, fileExt)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
            const fileName = `services/${Date.now()}_${fileNameRoot}${fileExt}`;
            
            console.log('Nom normalisé pour Supabase:', fileName);
            console.log('Supabase URL:', process.env.SUPABASE_URL);
            
            const fileBuffer = fs.readFileSync(req.file.path);
            
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
                    // Si on a un objet d'erreur, on l'affiche en entier
                    console.dir(uploadError, { depth: null });
                    throw uploadError;
                }
                
                console.log('✅ UPLOAD RÉUSSI:', data);
                
                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('service-image')
                    .getPublicUrl(fileName);
                
                imageUrl = urlData.publicUrl;
                console.log('Public URL:', imageUrl);
            } catch (err) {
                console.error('🔥 CRASH PENDANT UPLOAD:', err);
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(500).json({ success: false, error: 'Erreur Supabase Storage: ' + err.message });
            } finally {
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
        console.error('🔥 ERREUR CRITIQUE POST /api/services:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT update service with image (PROTECTED)
app.put('/api/services/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { nom, type, ville, tarifs, services: description, horaires, statut } = req.body;

    try {
        let updates = {
            nom: nom, // Fixed column name
            type,
            ville: ville, // Fixed column name
            tarifs: parseFloat(tarifs) || 0, // Fixed column name
            services: description || '', // Fixed column name
            horaires: horaires || '', // Fixed column name
            statut: statut || 'en_attente' // Fixed column name
        };

        // Upload new image if exists
        if (req.file) {
            console.log('--- DEBUT UPLOAD (EDIT) SUPABASE ---');
            console.log('Fichier reçu:', req.file.originalname);

            // Normaliser le nom du fichier (supprimer les caractères spéciaux)
            const fileExt = path.extname(req.file.originalname);
            const fileNameRoot = path.basename(req.file.originalname, fileExt)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
            const fileName = `services/${Date.now()}_${fileNameRoot}${fileExt}`;
            
            console.log('Nom normalisé pour Supabase:', fileName);
            
            const fileBuffer = fs.readFileSync(req.file.path);
            
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

                if (uploadError) {
                    console.error('❌ ERREUR STORAGE EDIT RETRIES:', uploadError);
                    throw uploadError;
                }
                
                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('service-image')
                    .getPublicUrl(fileName);
                
                updates.image = urlData.publicUrl;
                console.log('✅ NOUVELLE IMAGE UPLOADÉE:', updates.image);
            } catch (err) {
                console.error('🔥 CRASH STORAGE EDIT:', err);
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(500).json({ success: false, error: 'Erreur Supabase Storage (Edit): ' + err.message });
            } finally {
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
        console.error('🔥 ERREUR CRITIQUE PUT /api/services/:id:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE service (PROTECTED)
app.delete('/api/services/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('services_animaliers') // Fixed table name
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Service supprimé avec succès' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// USER AUTHENTICATION ROUTES
//register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // First create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password, // Supabase auth still needs plain password for signUp
            options: {
                data: { name }
            }
        });

        if (authError) throw authError;

        // Insert into users table
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

        // Generate JWT token
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




//login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1️⃣ Get user from users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        // 2️⃣ Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        // 3️⃣ Optional: sign in with Supabase (if needed for session)
        // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        // if (error) throw error;

        // 4️⃣ Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // 5️⃣ Respond to client
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
//dashbord
app.get('/api/dashboard', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Expect "Bearer <token>"

    if (!token) return res.status(401).json({ success: false, error: 'Token manquant' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ success: true, message: 'Accès autorisé', user: decoded });
    } catch (err) {
        res.status(401).json({ success: false, error: 'Token invalide' });
    }
});

// ===============================
// SIMPLER AUTH ENDPOINTS (for frontend compatibility)
// ===============================

// POST /api/register - Simple registration endpoint
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Cet email est déjà enregistré' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into users table
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

// POST /api/login - Simple login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Get user from database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        // Generate JWT token
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

// GET /api/me - Verify token and get user info
app.get('/api/me', (req, res) => {
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


// FAVORITES ROUTES
// FAVORITES ROUTES - CORRIGÉES

// GET - Récupérer les favoris d'un utilisateur (PROTECTED)
app.get('/api/favorites/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.id;

    // Optional: Only allow users to see their own favorites
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
        
        // Formater la réponse comme attendu par le frontend
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

// POST - Ajouter un favori (PROTECTED)
app.post('/api/favorites', authenticateToken, async (req, res) => {
    const { user_id, service_id } = req.body;
    const authenticatedUserId = req.user.id;

    // Security check: user can only add favorites for themselves
    if (user_id != authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }
    
    try {
        // Vérifier si le favori existe déjà
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

        // Insérer le nouveau favori
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
            // Si c'est une erreur de doublon
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

// DELETE - Supprimer un favori (PROTECTED)
app.delete('/api/favorites', authenticateToken, async (req, res) => {
    const { user_id, service_id } = req.body;
    const authenticatedUserId = req.user.id;

    // Security check: user can only remove their own favorites
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
    

// TEST API
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API fonctionne correctement', 
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.SUPABASE_URL ? 'Configured' : 'Missing'
    });
});

// TEST upload image
app.post('/api/upload-test', upload.single('testImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucune image uploadée' });

    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = `test/${Date.now()}_${req.file.originalname}`;
        
        const { data, error: uploadError } = await supabase.storage
            .from('services-images')
            .upload(fileName, fileBuffer, { contentType: req.file.mimetype });
        
        if (uploadError) throw uploadError;
        
        fs.unlinkSync(req.file.path);

        const { data: urlData } = supabase.storage
            .from('services-images')
            .getPublicUrl(fileName);
        
        res.json({ success: true, url: urlData.publicUrl });
    } catch (err) {
        console.error(err);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/test-supabase', async (req, res) => {
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

// MAIN PAGE
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// MIDDLEWARE ERRORS
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, error: 'Image max 5MB' });
        return res.status(400).json({ success: false, error: 'Erreur lors de l\'upload de l\'image' });
    }
    console.error('Erreur générale:', err);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
});

// 404
app.use((req, res) => {
    res.status(404).send('Page non trouvée');
});

// START SERVER
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
        console.log(`Table: services_animaliers`);
        console.log(`Uploads folder: uploads/`);
    });
}

module.exports = app;
