require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Import your API from api/index.js
const apiApp = require('./api/index.js');

// Mount API under /api path for local development
app.use('/api', apiApp);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// For any other route, serve index.html (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server only locally
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`✅ Local server running on port ${PORT}`);
        console.log(`🌍 Frontend: http://localhost:${PORT}`);
        console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
        console.log(`📡 API Test: http://localhost:${PORT}/api/test`);
        console.log(`🔧 Services: http://localhost:${PORT}/api/services`);
    });
}