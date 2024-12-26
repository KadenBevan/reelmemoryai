#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Testing Outgoing Message and Video Webhooks${NC}\n"

# Base URL - change this based on your environment
BASE_URL="http://localhost:3000"

# Test 1: Outgoing Message (Acknowledgment)
echo -e "${GREEN}Test 1: Sending Outgoing Acknowledgment Message${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "message": "I'\''ve received your video and I'\''m analyzing it now. I'\''ll send you the results in just a moment! 🎥✨",
    "type": "ACKNOWLEDGMENT"
  }' \
  "${BASE_URL}/api/outgoing/message"

echo -e "\n"

# Test 2: Outgoing Message (Analysis Result)
echo -e "${GREEN}Test 2: Sending Outgoing Analysis Result${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "message": "Here'\''s what I found in your video:\n\nThis video appears to be a cooking demonstration showing the preparation of a delicious meal. The chef is skillfully combining ingredients and using proper cooking techniques.",
    "type": "ANALYSIS_RESULT"
  }' \
  "${BASE_URL}/api/outgoing/message"

echo -e "\n"

# Test 3: Outgoing Message (Error)
echo -e "${GREEN}Test 3: Sending Outgoing Error Message${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "message": "I apologize, but I encountered an error while trying to send you the video analysis. Please try again.",
    "type": "ERROR"
  }' \
  "${BASE_URL}/api/outgoing/message"

echo -e "\n"

# Test 4: Outgoing Video (Analysis Result)
echo -e "${GREEN}Test 4: Sending Outgoing Video (Analysis Result)${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "url": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17905817880029000&signature=Abx-9mHVahM6mzagz7VRMihGg5UeifmKKTkzvy7mIIMkhMknB4kt4ydVb4JjgFloqEzm41U8POj3Mbnol60ryGixJQ4Jv9MGfSDgpVpgj9rxP5Z5CbyGiZEydCqs9n5O4WKd4Yq0w8ZGX1CbzgfrUhaIWYedYsb3xZqOj-FGd1_hYNR4ZS8Ipqyx9d0Q_qX18RqlP4Otu_OV-FEkOYECAqRsw7EEGU4",
    "type": "ANALYSIS_RESULT"
  }' \
  "${BASE_URL}/api/outgoing/video"

echo -e "\n"

# Test 5: Outgoing Video (Other)
echo -e "${GREEN}Test 5: Sending Outgoing Video (Other)${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "url": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17905817880029000&signature=Abx-9mHVahM6mzagz7VRMihGg5UeifmKKTkzvy7mIIMkhMknB4kt4ydVb4JjgFloqEzm41U8POj3Mbnol60ryGixJQ4Jv9MGfSDgpVpgj9rxP5Z5CbyGiZEydCqs9n5O4WKd4Yq0w8ZGX1CbzgfrUhaIWYedYsb3xZqOj-FGd1_hYNR4ZS8Ipqyx9d0Q_qX18RqlP4Otu_OV-FEkOYECAqRsw7EEGU4",
    "type": "OTHER"
  }' \
  "${BASE_URL}/api/outgoing/video"

echo -e "\n"

# Test 6: Invalid Message (Missing Text)
echo -e "${GREEN}Test 6: Sending Invalid Message (Missing Text)${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "type": "OTHER"
  }' \
  "${BASE_URL}/api/outgoing/message"

echo -e "\n"

# Test 7: Invalid Video (Missing URL)
echo -e "${GREEN}Test 7: Sending Invalid Video (Missing URL)${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user_ns": "f131667u184732093",
    "type": "OTHER"
  }' \
  "${BASE_URL}/api/outgoing/video"

echo -e "\n" 