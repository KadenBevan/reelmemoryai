# Reel Memory AI - Database Documentation

This document describes the Firestore database structure used in the Reel Memory AI application.

## Collections

### `users`
This collection stores information about users who sign up on our website.

### `webhook_users`

This collection stores information about users who interact with the application through Instagram DM webhooks.

#### Document ID
- The document ID is the user's `userNS` (unique identifier from Instagram)

#### Fields

| Field Name | Type | Description |
|------------|------|-------------|
| **Basic Information** |
| name | string | The user's name from Instagram |
| username | string | The user's Instagram username |
| userNS | string | Unique identifier for the Instagram account (used as document ID) |
| InstaId | string | Instagram's internal user ID |
| **Timestamps** |
| lastActive | timestamp | Timestamp of the user's most recent interaction |
| createdAt | timestamp | Timestamp when the user first interacted with the bot |
| **Communication Arrays** |
| incomingMessages | array | Array of messages received from the user |
| outgoingMessages | array | Array of messages sent to the user |
| incomingVideos | array | Array of videos received from the user |
| outgoingVideos | array | Array of videos sent to the user |
| **Statistics** |
| totalIncomingMessages | number | Total count of messages received |
| totalOutgoingMessages | number | Total count of messages sent |
| totalIncomingVideos | number | Total count of videos received |
| totalOutgoingVideos | number | Total count of videos sent |

#### Sub-document Structures

##### IncomingMessage
```typescript
{
  text: string          // Content of the message
  timestamp: timestamp  // When the message was received
  messageId?: string    // Optional unique identifier
}
```

##### OutgoingMessage
```typescript
{
  text: string          // Content of the message
  timestamp: timestamp  // When the message was sent
  messageId?: string    // Optional unique identifier
  type: string         // One of: 'ANALYSIS_RESULT', 'ACKNOWLEDGMENT', 'ERROR', 'OTHER'
}
```

##### IncomingVideo
```typescript
{
  videoUrl: string     // URL of the video
  timestamp: timestamp // When the video was received
  videoId?: string     // Optional unique identifier
  analysisRequested: boolean // Whether analysis was requested
}
```

##### OutgoingVideo
```typescript
{
  videoUrl: string     // URL of the video
  timestamp: timestamp // When the video was sent
  videoId?: string     // Optional unique identifier
  type: string        // One of: 'ANALYSIS_RESULT', 'OTHER'
}
```

#### Example Document
```json
{
  "name": "John Doe",
  "username": "johndoe",
  "userNS": "abc123xyz",
  "InstaId": "12345678",
  "lastActive": "2024-02-20T15:30:00Z",
  "createdAt": "2024-02-15T10:00:00Z",
  "incomingMessages": [
    {
      "text": "Hello, can you analyze this video?",
      "timestamp": "2024-02-20T15:30:00Z",
      "messageId": "msg_123"
    }
  ],
  "outgoingMessages": [
    {
      "text": "I've received your video and I'm analyzing it now!",
      "timestamp": "2024-02-20T15:30:01Z",
      "messageId": "msg_124",
      "type": "ACKNOWLEDGMENT"
    }
  ],
  "incomingVideos": [
    {
      "videoUrl": "https://example.com/video.mp4",
      "timestamp": "2024-02-20T15:30:00Z",
      "videoId": "vid_123",
      "analysisRequested": true
    }
  ],
  "outgoingVideos": [],
  "totalIncomingMessages": 1,
  "totalOutgoingMessages": 1,
  "totalIncomingVideos": 1,
  "totalOutgoingVideos": 0
}
```

### Security Rules

Basic security rules for the `webhook_users` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow read/write from authenticated server endpoints
    match /webhook_users/{userId} {
      allow read, write: if false; // Only allow access via server-side admin SDK
    }
  }
}
```

## Usage Notes

1. The `userNS` field serves as both the document ID and a field within the document for easier querying.
2. `lastActive` is updated on every interaction (message or video) to track user engagement.
3. `createdAt` is set only once when the user first interacts with the system.
4. All timestamps are stored in UTC.
5. Message and video arrays use `arrayUnion` for atomic updates.
6. Counter fields are updated atomically with each new message/video.

## Performance Considerations

1. Arrays have a practical limit in Firestore. If a user's message/video count grows very large, consider:
   - Implementing pagination
   - Moving messages/videos to subcollections
   - Archiving old messages to a separate collection
2. Keep message content within Firestore document size limits (1MB)
3. Consider implementing cleanup for old messages/videos

## Backup and Maintenance

1. Regular backups should be configured through Firebase Console
2. Consider implementing a cleanup policy for:
   - Inactive users (e.g., inactive for more than 6 months)
   - Old messages and videos (e.g., older than 3 months)
3. Monitor collection size and implement pagination for large-scale queries

## Future Considerations

1. Add indices if complex queries are needed
2. Consider adding fields for:
   - User preferences
   - Analysis history references
   - Success/failure statistics for video analysis
   - Message categories or tags
3. Consider implementing subcollections for:
   - Long-term message storage
   - Detailed analysis results
   - User activity logs 