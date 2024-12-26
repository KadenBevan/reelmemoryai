#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Testing Incoming Message and Video Webhooks${NC}\n"

# Base URL - change this based on your environment
BASE_URL="http://localhost:3000"

# Test 1: Incoming Message
echo -e "${GREEN}Test 1: Sending Incoming Message${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "f131667u184732093",
    "InstaMsgTxt": "This is a test",
    "MediaType": "Text",
    "InstaId": "17841470348429979",
    "username": "kaden.t.bevan",
    "name": "KadenBevan"
  }' \
  "${BASE_URL}/api/incoming/message"

echo -e "\n"

# Test 2: Incoming Video
echo -e "${GREEN}Test 2: Sending Incoming Video${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "f131667u184732093",
    "videoUrl": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17905817880029000&signature=Abx-9mHVahM6mzagz7VRMihGg5UeifmKKTkzvy7mIIMkhMknB4kt4ydVb4JjgFloqEzm41U8POj3Mbnol60ryGixJQ4Jv9MGfSDgpVpgj9rxP5Z5CbyGiZEydCqs9n5O4WKd4Yq0w8ZGX1CbzgfrUhaIWYedYsb3xZqOj-FGd1_hYNR4ZS8Ipqyx9d0Q_qX18RqlP4Otu_OV-FEkOYECAqRsw7EEGU4",
    "MediaType": "Post",
    "InstaId": "17841470348429979",
    "username": "kaden.t.bevan",
    "name": "KadenBevan"
  }' \
  "${BASE_URL}/api/incoming/video"

echo -e "\n"

# Test 3: Another User's Video
echo -e "${GREEN}Test 3: Sending Another User's Video${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "f131667u187892027",
    "videoUrl": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17866746798250553&signature=AbzgXzOG3rpdl5I756ONAGfXx0eHSMSnExZB4DKPazB6Po2irpD-zs-iNXRcR4SAfMxRvNdnrgWoIywhJmGjMXED4IhkSxfndYQiWDMO9zl0cERw1gYBcXWn_rmf33iwQivYYmo7q6tR7pLQo4qgTGyP2Mp60p4Unyyn7X25pisP_xDCKRwchlh8Nggw7590WkThF744rBgQBx9MwMfHXcLUuTj_u9k",
    "MediaType": "Post",
    "InstaId": "17841470348429979",
    "username": "kalie_creative",
    "name": "Kalie"
  }' \
  "${BASE_URL}/api/incoming/video"

echo -e "\n"

# Test 4: Invalid Message (Missing Text)
echo -e "${GREEN}Test 4: Sending Invalid Message (Missing Text)${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "f131667u184732093",
    "MediaType": "Text",
    "InstaId": "17841470348429979",
    "username": "kaden.t.bevan",
    "name": "KadenBevan"
  }' \
  "${BASE_URL}/api/incoming/message"

echo -e "\n"

# Test 5: Invalid Video (Missing URL)
echo -e "${GREEN}Test 5: Sending Invalid Video (Missing URL)${NC}"
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "userNS": "f131667u184732093",
    "MediaType": "Post",
    "InstaId": "17841470348429979",
    "username": "kaden.t.bevan",
    "name": "KadenBevan"
  }' \
  "${BASE_URL}/api/incoming/video"

echo -e "\n" 