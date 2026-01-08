# Pet Care Management System

A full-stack web application for managing pet care services, featuring authentication, search, favorites, and automation integration.

## 🚀 Features
- **User Authentication**: Secure Register/Login (JWT).
- **Service Management**: Browse, Search (Status, City, Type), Add, Edit, Delete Services.
- **Favorites**: Users can save their favorite services.
- **Dashboard**: User personalized dashboard.
- **Automation Ready**: API endpoints compatible with n8n for automated data ingestion.
- **Modern Stack**: Node.js, Express, PostgreSQL (Supabase), Vanilla JS Frontend.

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (Bootstrap 5)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Supabase)
- **Deployment**: Vercel

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js installed
- PostgreSQL database (e.g., Supabase)

### 2. Installation
```bash
git clone <repository_url>
cd marocpetcare
npm install
```

### 3. Database Setup
1. Create a project on [Supabase](https://supabase.com).
2. Get your `DATABASE_URL` (Connection String > Node.js).
3. Run the SQL commands in `schema.sql` in the Supabase SQL Editor.

### 4. Configuration
Create a `.env` file based on `.env.example`:
```env
DATABASE_URL=postgres://user:pass@host:port/db
JWT_SECRET=your_secret
```

### 5. Run Locally
```bash
npm start
# Server running at http://localhost:5000
```

## 🌐 API Endpoints

### Auth
- `POST /api/register`
- `POST /api/login`
- `GET /api/me`

### Services
- `GET /api/services`
- `GET /api/services/:id`
- `POST /api/services` (Authentified)
- `PUT /api/services/:id`
- `DELETE /api/services/:id`

### Favorites
- `GET /api/favorites`
- `POST /api/favorites`

### Automation
- `POST /api/webhooks/services` (Receives data from n8n)

## 📦 Deployment (Vercel)
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel`.
3. Set Environment Variables in Vercel Dashboard.


my-project/
│
├── public/                 # Front-end static files
│   ├── assets/             # Images, icons, fonts
│   └── index.html          # Main HTML file
│
├── src/                    # Front-end source (if using JS/CSS modules)
│   ├── js/                 # JavaScript files
│   └── css/                # CSS files (Tailwind output etc.)
│
├── uploads/                # Uploaded files (if using Multer)
│
├── routes/                 # Express route handlers
│   └── api.js              # Example: all API endpoints here
│
├── controllers/            # Logic for handling requests
│   └── userController.js
│
├── middleware/             # Express middleware (auth, logging etc.)
│   └── auth.js
│
├── models/                 # Database models (if using Supabase/SQL)
│   └── userModel.js
│
├── utils/                  # Utility functions
│   └── jwt.js
│
├── .env                    # Environment variables (do NOT commit)
├── package.json             # Project dependencies and scripts
├── package-lock.json
├── app.js / index.js        # Main Express server entry point
└── vercel.json              # Vercel deployment config (optional)
