# Debug Guide for Comment Analysis and RAG Features

## Current Status
- Transcripts and API settings: ✅ Working
- Comment analysis: ❌ Not working
- RAG analysis: ❌ Not working

## Added Debugging

The following debugging has been added to help identify issues:

### Background.js Debug Points
1. `fetchAndAnalyzeComments()` - Logs API provider, video ID, API key validation
2. `analyzeCommentBatch()` - Logs LLM API calls and responses
3. `performRagAnalysis()` - Logs transcript fetching and processing
4. Message handlers - Logs when requests are received and processed

### Popup.js Debug Points
1. Button click events - Logs when buttons are clicked
2. Tab queries - Logs results of active tab detection
3. Message sending - Logs when messages are sent to background
4. Message receiving - Logs when responses are received

## Testing Steps

### Prerequisites
1. Load the extension in Chrome
2. Open Chrome Developer Tools (F12)
3. Go to a YouTube video page
4. Open the extension popup

### Testing Comment Analysis
1. Click "Analyze Comments" button
2. Check the console for debug messages:
   - Should see "Comment analysis button clicked"
   - Should see "Video ID extracted: [video_id]"
   - Should see "Sending analyzeComments message to background"
   - In background console: "analyzeComments request received for video: [video_id]"

### Testing RAG Analysis
1. Enter a question in the RAG input field
2. Click "Analyze" button
3. Check the console for debug messages:
   - Should see "RAG analysis button clicked"
   - Should see "RAG query: [your_question]"
   - Should see "Sending performRagAnalysis message to background"
   - In background console: "performRagAnalysis request received for video: [video_id]"

## Common Issues to Check

### 1. API Provider Configuration
- Check that the selected API provider has a valid API key configured
- Verify API provider is correctly loaded from settings

### 2. Message Passing
- Check that messages are being sent from popup to background
- Verify that background script receives the messages
- Ensure responses are sent back to popup

### 3. YouTube API Permissions
- Comment analysis requires YouTube API access
- Check that the YouTube API key is configured and valid

### 4. Transcript Access
- RAG analysis requires transcript access
- Check if manual mode is enabled or if automatic transcript fetching works

## Debug Console Commands

Open the background script console and run:
```javascript
// Check current settings
console.log('API_PROVIDER:', API_PROVIDER);
console.log('YOUTUBE_API_KEY:', YOUTUBE_API_KEY ? 'Set' : 'Not set');
console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? 'Set' : 'Not set');

// Check cache
console.log('commentAnalysisCache:', commentAnalysisCache);
console.log('ragAnalysisCache:', ragAnalysisCache);
```

## Next Steps
1. Load the extension and test the features
2. Check the console for debug messages
3. Report any specific error messages or missing logs
4. We can then target the specific issue based on the debug output
