# 🚀 Deploy to Railway - Quick Start

This project is ready to deploy! Railway.app is the fastest option.

## ⚡ 5-Minute Setup:

### Step 1: Connect GitHub
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway & select your repository
5. Choose the branch (main/master)

### Step 2: Configure (Auto-detected)
- Railway will automatically detect your Dockerfile
- Set these environment variables in Railway dashboard:
  ```
  PORT=3000
  GEMINI_API_KEY=your_key_here
  SUPABASE_URL=your_url
  SUPABASE_KEY=your_key
  ```

### Step 3: Deploy
- Click "Deploy" 
- Wait 2-3 minutes
- Railway gives you a live URL instantly!

---

## 🔧 Before You Deploy:

1. **Push to GitHub**:
   ```powershell
   git add .
   git commit -m "Add deployment config"
   git push origin main
   ```

2. **Test locally first** (optional):
   ```powershell
   npm run build
   npm start
   # Visit http://localhost:3000
   ```

---

## 🌐 After Deployment:

Railway automatically:
- ✅ Installs dependencies
- ✅ Runs `npm run build`
- ✅ Starts with `npm start`
- ✅ Handles SSL certificates
- ✅ Auto-redeploys on push
- ✅ Gives you a public URL

---

## 📊 Pricing:
- **Free tier**: $5/month credits (enough for most projects)
- **Paid**: Pay as you go, usually $10-20/month

---

## ❓ Troubleshooting:

**Port error?**
- Railway sets PORT automatically, already configured

**Build fails?**
- Check Railway logs in dashboard
- Ensure all env vars are set

**Need more help?**
- Check [HOSTING_GUIDE.md](HOSTING_GUIDE.md) for other options

---

## 🚀 You're Ready!

Your project is deployment-ready. Just push to GitHub and connect Railway!
