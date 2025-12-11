@echo off
REM Quick deployment helper

echo.
echo ========================================
echo   Love App - Deployment Helper
echo ========================================
echo.
echo This will prepare your project for Railway.app deployment
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please install Git from https://git-scm.com
    pause
    exit /b 1
)

REM Check if repo is initialized
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git add .
    git commit -m "Initial commit - ready for deployment"
    echo.
    echo ✓ Git repository initialized
) else (
    echo.
    echo Current Git status:
    git status
)

echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo.
echo 1. Create a GitHub account if you don't have one
echo    https://github.com/signup
echo.
echo 2. Create a new repository on GitHub
echo    https://github.com/new
echo.
echo 3. Push your code to GitHub:
echo    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 4. Go to https://railway.app
echo    - Sign in with GitHub
echo    - Create new project from GitHub repo
echo    - Add environment variables (see .env.example)
echo    - Click Deploy!
echo.
echo ========================================
echo   Local Testing (Optional):
echo ========================================
echo.
echo To test locally before deploying:
echo   npm run build
echo   npm start
echo   Visit: http://localhost:3000
echo.
pause
