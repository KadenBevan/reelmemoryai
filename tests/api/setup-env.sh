#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking environment setup...${NC}"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.local file not found${NC}"
    exit 1
fi

# Check required variables in .env.local
echo -e "\n${YELLOW}Checking required variables in .env.local:${NC}"
missing_vars=0

check_env_var() {
    local var_name=$1
    if grep -q "^${var_name}=" .env.local; then
        echo -e "${GREEN}✓ $var_name is set${NC}"
        return 0
    else
        echo -e "${RED}❌ $var_name is not set in .env.local${NC}"
        return 1
    fi
}

check_env_var "OPENAI_API_KEY" || missing_vars=$((missing_vars + 1))
check_env_var "PINECONE_API_KEY" || missing_vars=$((missing_vars + 1))
check_env_var "GOOGLE_AI_API_KEY" || missing_vars=$((missing_vars + 1))

if [ $missing_vars -gt 0 ]; then
    echo -e "\n${RED}Missing $missing_vars required variables in .env.local${NC}"
    exit 1
fi

echo -e "\n${GREEN}All required variables are set in .env.local!${NC}" 