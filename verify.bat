@echo off
REM National ExamChain - Pre-Deployment Verification (Windows)

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo 🔍 National ExamChain - Pre-Deployment Verification
echo ==========================================
echo.

set CHECKS_PASSED=0
set CHECKS_FAILED=0

REM ========== 1. SYSTEM REQUIREMENTS ==========
echo 1️⃣  SYSTEM REQUIREMENTS
echo ─────────────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✓ Node.js installed
    set /a CHECKS_PASSED+=1
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   Version: !NODE_VERSION!
) else (
    echo ✗ Node.js NOT FOUND - Install from https://nodejs.org/
    set /a CHECKS_FAILED+=1
)

where npm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✓ NPM installed
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ NPM NOT FOUND
    set /a CHECKS_FAILED+=1
)
echo.

REM ========== 2. PROJECT FILES ==========
echo 2️⃣  PROJECT FILES
echo ─────────────────────────────────────────
if exist "package.json" (
    echo ✓ package.json
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ package.json not found
    set /a CHECKS_FAILED+=1
)

if exist "tsconfig.json" (
    echo ✓ TypeScript config
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ tsconfig.json not found
    set /a CHECKS_FAILED+=1
)

if exist "next.config.mjs" (
    echo ✓ Next.js config
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ next.config.mjs not found
    set /a CHECKS_FAILED+=1
)

if exist "prisma\schema.prisma" (
    echo ✓ Prisma schema
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ prisma/schema.prisma not found
    set /a CHECKS_FAILED+=1
)

if exist "README.md" (
    echo ✓ README documentation
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ README.md not found
    set /a CHECKS_FAILED+=1
)

if exist "DEPLOYMENT.md" (
    echo ✓ Deployment guide
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ DEPLOYMENT.md not found
    set /a CHECKS_FAILED+=1
)
echo.

REM ========== 3. DEPENDENCIES ==========
echo 3️⃣  DEPENDENCIES INSTALLED
echo ─────────────────────────────────────────
if exist "node_modules" (
    echo ✓ node_modules directory exists
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ node_modules not found
    echo   Run: npm install
    set /a CHECKS_FAILED+=1
)

if exist "package-lock.json" (
    echo ✓ package-lock.json present
    set /a CHECKS_PASSED+=1
) else (
    echo ⚠ package-lock.json not found
)
echo.

REM ========== 4. SMART CONTRACTS ==========
echo 4️⃣  SMART CONTRACTS
echo ─────────────────────────────────────────
if exist "contracts\EduAccessControl.sol" (
    echo ✓ EduAccessControl contract
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ EduAccessControl.sol not found
    set /a CHECKS_FAILED+=1
)

if exist "hardhat.config.ts" (
    echo ✓ Hardhat config
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ hardhat.config.ts not found
    set /a CHECKS_FAILED+=1
)
echo.

REM ========== 5. DATABASE ==========
echo 5️⃣  DATABASE
echo ─────────────────────────────────────────
if exist "prisma\schema.prisma" (
    echo ✓ Prisma schema exists
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ Prisma schema not found
    set /a CHECKS_FAILED+=1
)

if exist "prisma\dev.db" (
    echo ✓ Database file exists (prisma/dev.db)
    set /a CHECKS_PASSED+=1
) else (
    echo ⚠ Database not initialized
    echo   Run: npm run db:push
)
echo.

REM ========== 6. ENVIRONMENT VARIABLES ==========
echo 6️⃣  ENVIRONMENT VARIABLES
echo ─────────────────────────────────────────
if exist ".env.local" (
    echo ✓ .env.local file exists
    set /a CHECKS_PASSED+=1
    
    for /f "tokens=1,* delims==" %%a in (.env.local) do (
        if "%%a"=="NEXT_PUBLIC_EDU_CONTRACT_ADDRESS" (
            echo ✓ Contract address configured
            set /a CHECKS_PASSED+=1
        )
        if "%%a"=="NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" (
            echo ✓ WalletConnect configured
        )
        if "%%a"=="NEXT_PUBLIC_PINATA_JWT" (
            echo ✓ Pinata JWT configured
        )
        if "%%a"=="DATABASE_URL" (
            echo ✓ Database URL configured
        )
    )
) else (
    echo ⚠ .env.local not found
    echo   Run: copy .env.example .env.local
)
echo.

REM ========== 7. BUILD ==========
echo 7️⃣  BUILD VERIFICATION
echo ─────────────────────────────────────────
if exist ".next" (
    echo ✓ Previous build found (.next)
    set /a CHECKS_PASSED+=1
) else (
    echo ⚠ No previous build
    echo   Run: npm run build
)
echo.

REM ========== 8. CRITICAL COMPONENTS ==========
echo 8️⃣  CRITICAL COMPONENTS
echo ─────────────────────────────────────────
if exist "components\teacher-upload.tsx" (
    echo ✓ Admin upload component
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ teacher-upload.tsx not found
    set /a CHECKS_FAILED+=1
)

if exist "components\student-vault.tsx" (
    echo ✓ Centre vault component
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ student-vault.tsx not found
    set /a CHECKS_FAILED+=1
)

if exist "app\api\audit\uploads\route.ts" (
    echo ✓ Uploads API endpoint
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ uploads route not found
    set /a CHECKS_FAILED+=1
)

if exist "app\api\audit\accesses\route.ts" (
    echo ✓ Accesses API endpoint
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ accesses route not found
    set /a CHECKS_FAILED+=1
)

if exist "app\api\audit\papers\route.ts" (
    echo ✓ Papers API endpoint
    set /a CHECKS_PASSED+=1
) else (
    echo ✗ papers route not found
    set /a CHECKS_FAILED+=1
)
echo.

REM ========== SUMMARY ==========
echo ==========================================
echo 📊 VERIFICATION SUMMARY
echo ==========================================
echo ✓ Passed: %CHECKS_PASSED%
echo ✗ Failed: %CHECKS_FAILED%
echo.

if %CHECKS_FAILED% equ 0 (
    echo ✅ ALL CHECKS PASSED!
    echo.
    echo Next steps:
    echo 1. npm install              (if needed)
    echo 2. npm run db:generate      (generate Prisma)
    echo 3. npm run db:push          (create database)
    echo 4. npm run compile          (compile contracts)
    echo 5. npm run deploy:amoy      (deploy to Amoy)
    echo 6. npm run dev              (start dev server)
    echo.
    exit /b 0
) else (
    echo ❌ SOME CHECKS FAILED
    echo.
    echo Fix the issues above before deploying.
    echo See README.md and DEPLOYMENT.md for guidance.
    echo.
    exit /b 1
)
