# Hosting Deployment Guide

## Quick Summary of Setup Files Created:
- **Dockerfile** - Container setup for any Docker-based host
- **server.js** - Express server to serve the built React app
- **package.json** - Updated with `start` and `serve` commands

---

## 1. RAILWAY.APP (⭐ Recommended - Easiest)

### Steps:
1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Sign in with GitHub
4. Click "New Project" → "Deploy from GitHub"
5. Select your repository
6. Set environment variable: `PORT=3000` (Railway auto-detects Dockerfile)
7. Done! It will auto-deploy

**Cost**: Free tier available, ~$5/month paid

---

## 2. RENDER.COM

### Steps:
1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" → "Web Service"
4. Connect GitHub repository
5. Settings:
   - **Name**: your-app-name
   - **Environment**: Docker
   - **Region**: Pick closest
   - **Plan**: Free tier available
6. Deploy!

**Cost**: Free tier, upgraded plans start at $7/month

---

## 3. FLY.IO

### Steps:
1. Install Fly CLI: `brew install flyctl` (or `choco install flyctl` on Windows)
2. Run: `flyctl auth login`
3. Run: `flyctl launch` in your project directory
4. Answer prompts (region, etc.)
5. Deploy: `flyctl deploy`

**Cost**: Generous free tier (~3 shared-cpu-1x VMs)

---

## 4. DIGITALOCEAN APP PLATFORM

### Steps:
1. Go to [digitalocean.com](https://digitalocean.com)
2. Create account
3. Apps → Create App
4. Connect GitHub
5. Choose your repo and branch
6. Configure build command: `npm run build`
7. Configure start command: `npm start`
8. Add environment: `PORT=8080`
9. Deploy!

**Cost**: $5-12/month basic plans

---

## 5. DOCKER LOCALLY (Test Before Deploying)

Build and test locally:
```bash
docker build -t love-app .
docker run -p 3000:3000 love-app
```

Visit: `http://localhost:3000`

---

## 6. GITHUB PAGES (Static Only - No Backend)

If you don't need Supabase/API:
1. Update vite.config.ts: `base: "/repo-name/"`
2. Run: `npm run build`
3. Push dist folder to GitHub Pages

---

## Environment Variables

Create a `.env` file:
```
VITE_GEMINI_API_KEY=your_key_here
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_KEY=your_key
```

All platforms allow you to set these in their dashboard.

---

## Recommended Path:

1. **Quick test**: Use Railway.app (easiest)
2. **Production**: Use Fly.io or Render.com (better free tier)
3. **Custom**: Use DigitalOcean or AWS

All are ready to go with the files provided!
