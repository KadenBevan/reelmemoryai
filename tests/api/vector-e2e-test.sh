#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
TEST_USER_NS="f131667u184732093"
TEST_VIDEO_URL="https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17905817880029000&signature=Abx-9mHVahM6mzagz7VRMihGg5UeifmKKTkzvy7mIIMkhMknB4kt4ydVb4JjgFloqEzm41U8POj3Mbnol60ryGixJQ4Jv9MGfSDgpVpgj9rxP5Z5CbyGiZEydCqs9n5O4WKd4Yq0w8ZGX1CbzgfrUhaIWYedYsb3xZqOj-FGd1_hYNR4ZS8Ipqyx9d0Q_qX18RqlP4Otu_OV-FEkOYECAqRsw7EEGU4"

# Function to pretty print JSON with basic formatting
print_json() {
    echo "$1" | sed 's/,/,\n/g' | sed 's/{/{\n/g' | sed 's/}/\n}/g'
}

# Function to check JSON field using grep
check_json_field() {
    local json="$1"
    local field="$2"
    if echo "$json" | grep -q "\"ready\":true"; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to extract field value from JSON
get_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4
}

# Print test header
echo -e "${GREEN}Starting Vector Processing Flow Test${NC}\n"
echo -e "${YELLOW}Test Configuration:${NC}"
echo -e "Base URL: ${BASE_URL}"
echo -e "User NS: ${TEST_USER_NS}\n"

# Test 1: Verify Pinecone Index
echo -e "${GREEN}Test 1: Verifying Pinecone Index${NC}"
INDEX_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/pinecone-tests/check-status")
print_json "$INDEX_RESPONSE"

# Check if index exists and is ready
IS_READY=$(check_json_field "$INDEX_RESPONSE" "ready")
if [ "$IS_READY" = "true" ] && ! echo "$INDEX_RESPONSE" | grep -q "\"error\":"; then
    echo -e "${GREEN}✓ Index is ready${NC}"
else
    echo -e "${RED}✗ Index not ready or error occurred - creating new index...${NC}"
    CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/pinecone-tests/create-index")
    print_json "$CREATE_RESPONSE"
    
    # Wait longer for index creation and verify it's ready
    echo -e "${YELLOW}Waiting for index creation (60s)...${NC}"
    sleep 60
    
    # Verify index is actually ready
    VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/pinecone-tests/check-status")
    IS_READY=$(check_json_field "$VERIFY_RESPONSE" "ready")
    if [ "$IS_READY" = "true" ] && ! echo "$VERIFY_RESPONSE" | grep -q "\"error\":"; then
        echo -e "${GREEN}✓ Index created and ready${NC}"
    else
        echo -e "${RED}✗ Index creation failed${NC}"
        exit 1
    fi
fi

# Test 2: Process Video
echo -e "\n${GREEN}Test 2: Processing Video${NC}"
VIDEO_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "'${TEST_USER_NS}'",
    "videoUrl": "'${TEST_VIDEO_URL}'",
    "MediaType": "Post",
    "InstaId": "17841470348429979",
    "username": "kaden.t.bevan",
    "name": "KadenBevan"
  }' \
  "${BASE_URL}/api/incoming/video")

echo -e "\n${YELLOW}Video Response:${NC}"
print_json "$VIDEO_RESPONSE"

# Add retry logic for vector storage check
MAX_RETRIES=5
RETRY_COUNT=0
VECTORS_STORED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$VECTORS_STORED" != "true" ]; do
    VECTORS_STORED=$(check_json_field "$VIDEO_RESPONSE" "vectorsStored")
    if [ "$VECTORS_STORED" = "true" ]; then
        echo -e "${GREEN}✓ Vectors successfully stored${NC}"
        break
    fi
    echo -e "${YELLOW}Waiting for vector storage (5s)...${NC}"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$VECTORS_STORED" != "true" ]; then
    echo -e "${RED}✗ Vector storage failed after $MAX_RETRIES retries${NC}"
    exit 1
fi

# Check video processing status
ANALYSIS_TEXT=$(get_json_field "$VIDEO_RESPONSE" "analysis")

if [ ! -z "$ANALYSIS_TEXT" ]; then
    echo -e "${GREEN}✓ Analysis text generated${NC}"
else
    echo -e "${RED}✗ No analysis text generated${NC}"
    exit 1
fi

# Wait for processing
echo -e "\n${YELLOW}Waiting for vector processing (5s)...${NC}"
sleep 5

# Test 3: Query Video Content
echo -e "\n${GREEN}Test 3: Querying Video Content${NC}"
QUERY_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "'${TEST_USER_NS}'",
    "InstaMsgTxt": "What was in the video I sent?",
    "MediaType": "Text",
    "InstaId": "17841470348429979",
    "username": "kaden.t.bevan",
    "name": "KadenBevan"
  }' \
  "${BASE_URL}/api/incoming/message")

echo -e "\n${YELLOW}Query Response:${NC}"
print_json "$QUERY_RESPONSE"

# Validate query response
ANSWER_TEXT=$(get_json_field "$QUERY_RESPONSE" "answer")
VIDEO_URL=$(get_json_field "$QUERY_RESPONSE" "videoUrl")

if [ ! -z "$ANSWER_TEXT" ]; then
    echo -e "${GREEN}✓ Answer generated${NC}"
else
    echo -e "${RED}✗ No answer generated${NC}"
    exit 1
fi

if [ "$VIDEO_URL" = "$TEST_VIDEO_URL" ]; then
    echo -e "${GREEN}✓ Correct video URL returned${NC}"
else
    echo -e "${RED}✗ Wrong or missing video URL${NC}"
    exit 1
fi

# Test 4: Verify Vector Storage
echo -e "\n${GREEN}Test 4: Verifying Vector Storage${NC}"
STATS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/pinecone-tests/stats")
print_json "$STATS_RESPONSE"

echo -e "\n${GREEN}Test Complete${NC}"