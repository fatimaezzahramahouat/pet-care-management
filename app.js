require('dotenv').config();
const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 5000;

// ----------------- CONFIG SUPABASE -----------------
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Changed to anon key for most operations
);

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

// POST add new service with image
app.post('/api/services', upload.single('image'), async (req, res) => {
    const { nom, type, ville, tarifs, services: description, horaires, statut = 'en_attente' } = req.body;
    let imageUrl = null;

    try {
        if (!nom || !type || !ville) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: 'Nom, type et ville sont requis' });
        }

        // Upload image to Supabase Storage if exists
        if (req.file) {
            const fileBuffer = fs.readFileSync(req.file.path);
            const fileName = `services/${Date.now()}_${req.file.originalname}`;
            
            const { data, error: uploadError } = await supabase.storage
                .from('services-images')
                .upload(fileName, fileBuffer, { 
                    contentType: req.file.mimetype,
                    upsert: true 
                });

            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('services-images')
                .getPublicUrl(fileName);
            
            imageUrl = urlData.publicUrl;
            fs.unlinkSync(req.file.path);
        }

        const { data, error } = await supabase
            .from('services_animaliers') // Fixed table name
            .insert([{
                nom: nom, // Fixed column name
                type: type,
                ville: ville, // Fixed column name
                tarifs: parseFloat(tarifs) || 0, // Fixed column name
                services: description || '', // Fixed column name
                horaires: horaires || '', // Fixed column name
                statut: statut, // Fixed column name
                image: imageUrl // Fixed column name
            }])
            .select();

        if (error) throw error;
        res.json({ success: true, service: data[0] });
    } catch (err) {
        console.error(err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT update service with image
app.put('/api/services/:id', upload.single('image'), async (req, res) => {
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
            const fileBuffer = fs.readFileSync(req.file.path);
            const fileName = `services/${Date.now()}_${req.file.originalname}`;
            
            const { error: uploadError } = await supabase.storage
                .from('services-images')
                .upload(fileName, fileBuffer, { 
                    contentType: req.file.mimetype,
                    upsert: true 
                });

            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('services-images')
                .getPublicUrl(fileName);
            
            updates.image = urlData.publicUrl; // Fixed column name
            fs.unlinkSync(req.file.path);
        }

        const { data, error } = await supabase
            .from('services_animaliers') // Fixed table name
            .update(updates)
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Service mis à jour avec succès' });
    } catch (err) {
        console.error(err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE service
app.delete('/api/services/:id', async (req, res) => {
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
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        // First create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name }
            }
        });

        if (authError) throw authError;

        // Then insert into users table
        const { data, error } = await supabase
            .from('users')
            .insert([{
                name,
                email,
                password: password, // Note: In production, hash this password!
                role: 'user'
            }])
            .select();

        if (error) throw error;

        res.json({ 
            success: true, 
            user: data[0],
            auth: authData 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Get user from users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError) throw userError;

        res.json({ 
            success: true, 
            user: userData,
            session: data.session 
        });
    } catch (err) {
        console.error(err);
        res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
    }
});

// FAVORITES ROUTES
app.get('/api/favorites/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select(`
                *,
                services_animaliers (*)
            `)
            .eq('user_id', userId);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/favorites', async (req, res) => {
    const { user_id, service_id } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('favorites')
            .insert([{ user_id, service_id }])
            .select();

        if (error) throw error;
        res.json({ success: true, favorite: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/favorites/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Favori supprimé' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
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
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log(`Table: services_animaliers`);
    console.log(`Uploads folder: uploads/`);
});