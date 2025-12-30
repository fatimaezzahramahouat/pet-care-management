<<<<<<< HEAD
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
=======
"# pet-care-management" 
>>>>>>> 81cb50cf192793eef6ddf3c48ea632b648e9c262
