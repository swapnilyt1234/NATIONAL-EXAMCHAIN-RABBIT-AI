#!/bin/bash

echo "=========================================="
echo "🔍 National ExamChain - Pre-Deployment Verification"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - MISSING"
        ((CHECKS_FAILED++))
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - FILE NOT FOUND: $1"
        ((CHECKS_FAILED++))
    fi
}

check_env() {
    if [ -z "${!1}" ]; then
        echo -e "${YELLOW}⚠${NC} $2 not set in .env.local"
    else
        echo -e "${GREEN}✓${NC} $2 configured"
        ((CHECKS_PASSED++))
    fi
}

echo "1️⃣  SYSTEM REQUIREMENTS"
echo "─────────────────────────────────────────"
check_command "node" "Node.js installed"
check_command "npm" "NPM installed"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    if [[ "$NODE_VERSION" > "v18" ]]; then
        echo -e "  Version: ${GREEN}$NODE_VERSION${NC} ✓"
    else
        echo -e "  Version: ${YELLOW}$NODE_VERSION${NC} (recommend >= v18)"
    fi
fi
echo ""

echo "2️⃣  PROJECT FILES"
echo "─────────────────────────────────────────"
check_file "package.json" "package.json"
check_file "tsconfig.json" "TypeScript config"
check_file "next.config.mjs" "Next.js config"
check_file "prisma/schema.prisma" "Prisma schema"
check_file ".env.example" ".env.example template"
check_file "README.md" "README documentation"
check_file "DEPLOYMENT.md" "Deployment guide"
echo ""

echo "3️⃣  DEPENDENCIES INSTALLED"
echo "─────────────────────────────────────────"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} node_modules not found - run: npm install"
    ((CHECKS_FAILED++))
fi

if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓${NC} package-lock.json present"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} package-lock.json not found"
fi
echo ""

echo "4️⃣  SMART CONTRACTS"
echo "─────────────────────────────────────────"
check_file "contracts/EduAccessControl.sol" "EduAccessControl contract"
check_file "hardhat.config.ts" "Hardhat config"
echo ""

echo "5️⃣  DATABASE"
echo "─────────────────────────────────────────"
check_file "prisma/schema.prisma" "Prisma schema"
if [ -f "prisma/dev.db" ]; then
    echo -e "${GREEN}✓${NC} Database file exists (prisma/dev.db)"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Database not initialized - run: npm run db:push"
fi
echo ""

echo "6️⃣  ENVIRONMENT VARIABLES"
echo "─────────────────────────────────────────"
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} .env.local file exists"
    ((CHECKS_PASSED++))
    
    # Source the .env.local file
    set -a
    source .env.local 2>/dev/null || true
    set +a
    
    # Check critical vars
    [ -z "$NEXT_PUBLIC_EDU_CONTRACT_ADDRESS" ] && echo -e "${YELLOW}⚠${NC} NEXT_PUBLIC_EDU_CONTRACT_ADDRESS not set" || echo -e "${GREEN}✓${NC} Contract address configured"
    [ -z "$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" ] && echo -e "${YELLOW}⚠${NC} WalletConnect ID not set" || echo -e "${GREEN}✓${NC} WalletConnect configured"
    [ -z "$NEXT_PUBLIC_PINATA_JWT" ] && echo -e "${YELLOW}⚠${NC} Pinata JWT not set" || echo -e "${GREEN}✓${NC} Pinata JWT configured"
    [ -z "$DATABASE_URL" ] && echo -e "${YELLOW}⚠${NC} DATABASE_URL not set" || echo -e "${GREEN}✓${NC} Database URL configured"
else
    echo -e "${YELLOW}⚠${NC} .env.local not found - copy from .env.example"
    echo "   Run: cp .env.example .env.local"
fi
echo ""

echo "7️⃣  BUILD VERIFICATION"
echo "─────────────────────────────────────────"

# Check if .next exists (previous build)
if [ -d ".next" ]; then
    echo -e "${GREEN}✓${NC} Previous build found (.next)"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} No previous build - run: npm run build"
fi
echo ""

echo "8️⃣  CRITICAL COMPONENTS"
echo "─────────────────────────────────────────"
check_file "components/teacher-upload.tsx" "Admin upload component"
check_file "components/student-vault.tsx" "Centre vault component"
check_file "app/api/audit/uploads/route.ts" "Uploads API endpoint"
check_file "app/api/audit/accesses/route.ts" "Accesses API endpoint"
check_file "app/api/audit/papers/route.ts" "Papers API endpoint"
echo ""

echo "=========================================="
echo "📊 VERIFICATION SUMMARY"
echo "=========================================="
echo -e "✓ Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "✗ Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. npm install              (if needed)"
    echo "2. npm run db:generate      (generate Prisma)"
    echo "3. npm run db:push          (create database)"
    echo "4. npm run compile          (compile contracts)"
    echo "5. npm run deploy:amoy      (deploy to Amoy)"
    echo "6. npm run dev              (start dev server)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
    echo ""
    echo "Fix the issues above before deploying."
    echo "See README.md and DEPLOYMENT.md for guidance."
    echo ""
    exit 1
fi
