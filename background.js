// --- Globals ---
let YOUTUBE_API_KEY = null;
let API_PROVIDER = 'openai';

// OpenAI settings
let OPENAI_API_KEY = null;
let OPENAI_MODEL = 'gpt-3.5-turbo';

// Hugging Face settings
let HUGGINGFACE_API_KEY = null;
let HUGGINGFACE_MODEL = 'microsoft/DialoGPT-medium';

// Gemini settings
let GEMINI_API_KEY = null;
let GEMINI_MODEL = 'gemini-1.5-flash';

// Ollama settings
let OLLAMA_ENDPOINT = 'http://localhost:11434';
let OLLAMA_MODEL = 'llama2';

// General settings
let BATCH_SIZE = 25;
let MAX_COMMENTS = 100;
let CHUNK_SIZE = 1000;
let MANUAL_MODE = false;
let DEFAULT_TRANSCRIPT = '';

// Language settings for captions
let PREFERRED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'hi', 'pt']; // Default language priority
let FETCH_ALL_LANGUAGES = false; // Whether to fetch all available languages
let AUTO_TRANSLATE_CAPTIONS = false; // Whether to use auto-generated translations
let BROWSER_EXTRACTION_ENABLED = true; // Whether to enable browser player caption extraction as fallback

// Cache objects
const transcriptCache = {};
const commentAnalysisCache = {};
const ragAnalysisCache = {};

// Cache timeout in milliseconds (1 hour)
const CACHE_TIMEOUT = 60 * 60 * 1000;

// --- Utility Functions ---

// Load API keys and settings from storage
async function loadSettings() {
    try {
        const settings = await chrome.storage.local.get([
            'apiProvider',
            'youtubeApiKey',
            'openaiApiKey',
            'openaiModel',
            'huggingfaceApiKey',
            'huggingfaceModel',
            'geminiApiKey',
            'geminiModel',
            'ollamaEndpoint',
            'ollamaModel',
            'batchSize',
            'maxComments',
            'chunkSize',
            'manualMode',
            'defaultTranscript',
            'preferredLanguages',
            'fetchAllLanguages',
            'autoTranslateCaptions',
            'browserExtractionEnabled'
        ]);
        
        // API Provider
        API_PROVIDER = settings.apiProvider || 'openai';
        
        // YouTube API
        YOUTUBE_API_KEY = settings.youtubeApiKey || null;
        
        // OpenAI settings
        OPENAI_API_KEY = settings.openaiApiKey || null;
        OPENAI_MODEL = settings.openaiModel || 'gpt-3.5-turbo';
        
        // Hugging Face settings
        HUGGINGFACE_API_KEY = settings.huggingfaceApiKey || null;
        HUGGINGFACE_MODEL = settings.huggingfaceModel || 'microsoft/DialoGPT-medium';
        
        // Gemini settings
        GEMINI_API_KEY = settings.geminiApiKey || null;
        GEMINI_MODEL = settings.geminiModel || 'gemini-1.5-flash';
        
        // Ollama settings
        OLLAMA_ENDPOINT = settings.ollamaEndpoint || 'http://localhost:11434';
        OLLAMA_MODEL = settings.ollamaModel || 'llama2';
        
        // General settings
        BATCH_SIZE = settings.batchSize || 25;
        MAX_COMMENTS = settings.maxComments || 100;
        CHUNK_SIZE = settings.chunkSize || 1000;
        MANUAL_MODE = settings.manualMode || false;
        DEFAULT_TRANSCRIPT = settings.defaultTranscript || '';

        // Language settings
        PREFERRED_LANGUAGES = settings.preferredLanguages || ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'hi', 'pt'];
        FETCH_ALL_LANGUAGES = settings.fetchAllLanguages || false;
        AUTO_TRANSLATE_CAPTIONS = settings.autoTranslateCaptions || false;
        BROWSER_EXTRACTION_ENABLED = settings.browserExtractionEnabled !== false; // Default to true

        console.log("Settings loaded",
            `Provider: ${API_PROVIDER}`,
            YOUTUBE_API_KEY ? "YouTube API: ✓" : "YouTube API: ✗",
            OPENAI_API_KEY ? "OpenAI API: ✓" : "OpenAI API: ✗",
            HUGGINGFACE_API_KEY ? "Hugging Face API: ✓" : "Hugging Face API: ✗",
            GEMINI_API_KEY ? "Gemini API: ✓" : "Gemini API: ✗",
            OLLAMA_ENDPOINT ? "Ollama API: ✓" : "Ollama API: ✗",
            MANUAL_MODE ? "Manual Mode: ✓" : "Manual Mode: ✗",
            BROWSER_EXTRACTION_ENABLED ? "Browser Extraction: ✓" : "Browser Extraction: ✗");
            
        return settings;
    } catch (err) {
        console.error("Error loading settings:", err);
        return null;
    }
}

// Send status updates to popup
function updatePopupStatus(message, isError = false, isProcessing = undefined, progress = null, progressType = null) {
    const statusMessage = {
        action: "updateStatus",
        message: message,
        isError: isError,
        isProcessing: isProcessing
    };
    
    // Add progress info if provided
    if (progress !== null && progressType) {
        statusMessage.progress = progress;
        statusMessage.progressType = progressType;
    }
    
    chrome.runtime.sendMessage(statusMessage).catch(err => {
        console.error("Error sending status update:", err);
    });
}

// Send progress updates to popup
function updateProgressStatus(type, progress) {
    chrome.runtime.sendMessage({
        action: "updateProgress",
        type: type,
        progress: progress
    }).catch(err => {
        console.log("Error sending progress message:", err);
    });
}

// Memory-efficient batch processing
async function processBatch(items, batchSize, processFunc, progressType = null) {
    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    console.log(`Processing ${items.length} items in ${totalBatches} batches of size ${batchSize}`);
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${totalBatches} with ${batch.length} items`);
        
        const batchResult = await processFunc(batch);
        console.log('Batch result:', batchResult);
        
        // Handle both single results and array results
        if (Array.isArray(batchResult)) {
            results.push(...batchResult);
        } else {
            results.push(batchResult);
        }
        
        // Update progress if progressType is provided
        if (progressType) {
            const currentBatch = Math.floor(i / batchSize) + 1;
            const progress = Math.round((currentBatch / totalBatches) * 100);
            updateProgressStatus(progressType, progress);
        }
        
        // Free up memory
        if (i > 0 && i % (batchSize * 4) === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            gc && gc(); // Hint garbage collection if available
        }
    }
    
    console.log(`processBatch completed, ${results.length} results`);
    return results;
}

// Call the selected LLM API based on user preference
async function callLLMAPI(messages, retries = 3) {
    console.log('callLLMAPI called with provider:', API_PROVIDER);
    await loadSettings(); // Make sure we have the latest settings
    console.log('Settings reloaded in callLLMAPI, provider:', API_PROVIDER);
    
    switch(API_PROVIDER) {
        case 'openai':
            console.log('Calling OpenAI API');
            return callOpenAI(messages, retries);
        case 'huggingface':
            console.log('Calling Hugging Face API');
            return callHuggingFace(messages, retries);
        case 'gemini':
            console.log('Calling Gemini API');
            return callGemini(messages, retries);
        case 'ollama':
            console.log('Calling Ollama API');
            return callOllama(messages, retries);
        default:
            console.error('Unknown API provider:', API_PROVIDER);
            throw new Error("Unknown API provider selected. Please check your settings.");
    }
}

// OpenAI API call with retry logic
async function callOpenAI(messages, retries = 3) {
    if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured. Please set it in the options page.");
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            updatePopupStatus(`Calling OpenAI API (attempt ${i+1}/${retries})...`);
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    messages: messages,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                const errorMsg = data.error?.message || `Status code: ${response.status}`;
                console.error("OpenAI API error:", data);
                
                // Special handling for common errors
                if (response.status === 401) {
                    throw new Error("Invalid OpenAI API key. Please check your key in the options page.");
                } else if (response.status === 429) {
                    throw new Error("OpenAI API rate limit exceeded. Please try again later or use a different API key.");
                } else if (response.status === 400 && data.error?.code === "context_length_exceeded") {
                    throw new Error("Input text is too long. Try reducing the chunk size in options.");
                } else {
                    throw new Error(`OpenAI API error: ${errorMsg}`);
                }
            }

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Invalid response from OpenAI API");
            }
            
            return data.choices[0].message.content;
        } catch (error) {
            console.error(`API attempt ${i+1} failed:`, error);
            
            if (i === retries - 1) throw error;
            
            // Exponential backoff
            const delay = 1000 * Math.pow(2, i);
            updatePopupStatus(`API call failed. Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Hugging Face API call with retry logic
async function callHuggingFace(messages, retries = 3) {
    if (!HUGGINGFACE_API_KEY) {
        throw new Error("Hugging Face API key not configured. Please set it in the options page.");
    }
    
    // Convert chat messages format to a prompt string for Hugging Face
    let prompt = "";
    for (const msg of messages) {
        if (msg.role === 'system') {
            prompt += `System: ${msg.content}\n\n`;
        } else if (msg.role === 'user') {
            prompt += `User: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
            prompt += `Assistant: ${msg.content}\n\n`;
        }
    }
    prompt += "Assistant:";
    
    for (let i = 0; i < retries; i++) {
        try {
            updatePopupStatus(`Calling Hugging Face API (attempt ${i+1}/${retries})...`);
            
            const response = await fetch(`https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 512,
                        temperature: 0.7,
                        return_full_text: false
                    }
                })
            });

            if (!response.ok) {
                let errorData;
                let errorMsg;
                
                // Try to parse as JSON, fall back to text
                try {
                    errorData = await response.json();
                    errorMsg = errorData.error || `Status code: ${response.status}`;
                } catch (jsonError) {
                    errorData = await response.text();
                    errorMsg = errorData || `Status code: ${response.status}`;
                }
                
                console.error("Hugging Face API error:", errorData);
                
                if (response.status === 401) {
                    throw new Error("Invalid Hugging Face API key. Please check your key in the options page.");
                } else if (response.status === 429) {
                    throw new Error("Hugging Face API rate limit exceeded. Please try again later.");
                } else if (response.status === 404) {
                    throw new Error(`Model ${HUGGINGFACE_MODEL} not found. Please select a different model in options.`);
                } else {
                    throw new Error(`Hugging Face API error: ${errorMsg}`);
                }
            }

            let data;
            
            // Try to parse response as JSON
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error("Failed to parse Hugging Face response as JSON:", jsonError);
                const textResponse = await response.text();
                throw new Error(`Invalid JSON response from Hugging Face: ${textResponse.substring(0, 200)}`);
            }
            
            // Different models might have different response formats
            // Adjust based on the actual response structure from the model you're using
            if (Array.isArray(data) && data.length > 0) {
                if (data[0].generated_text) {
                    return data[0].generated_text;
                }
            }
            
            // Fallback if response format is unexpected
            return JSON.stringify(data);
        } catch (error) {
            console.error(`API attempt ${i+1} failed:`, error);
            
            if (i === retries - 1) throw error;
            
            // Exponential backoff
            const delay = 1000 * Math.pow(2, i);
            updatePopupStatus(`API call failed. Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Gemini API call with retry logic
async function callGemini(messages, retries = 3) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key not configured. Please set it in the options page.");
    }
    
    // Convert chat messages to Gemini format
    const geminiMessages = [];
    
    // Handle system message (Gemini doesn't have a system role, so we'll prepend it to the first user message)
    const systemMessage = messages.find(msg => msg.role === 'system');
    let systemContent = '';
    if (systemMessage) {
        systemContent = `${systemMessage.content}\n\n`;
    }
    
    // Process the rest of the messages
    for (const msg of messages) {
        if (msg.role === 'user') {
            geminiMessages.push({
                role: 'user',
                parts: [{
                    text: systemContent + msg.content
                }]
            });
            // Only prepend system message to the first user message
            systemContent = '';
        } else if (msg.role === 'assistant') {
            geminiMessages.push({
                role: 'model',
                parts: [{
                    text: msg.content
                }]
            });
        }
        // Skip system messages as we handled them separately
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            updatePopupStatus(`Calling Gemini API (attempt ${i+1}/${retries})...`);
            
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: geminiMessages.length > 0 ? geminiMessages : [{
                            parts: [{
                                text: messages[messages.length - 1].content
                            }]
                        }],
                        generationConfig: {
                            maxOutputTokens: 1000,
                            temperature: 0.7
                        }
                    })
                }
            );

            const data = await response.json();
            
            if (!response.ok) {
                const errorMsg = data.error?.message || `Status code: ${response.status}`;
                console.error("Gemini API error:", data);
                
                if (response.status === 400) {
                    // Check for specific model not found error
                    if (errorMsg.includes('not found') || errorMsg.includes('not supported')) {
                        throw new Error(`Gemini model '${GEMINI_MODEL}' is not available. Please update to a newer model like 'gemini-1.5-flash' in the options.`);
                    }
                    throw new Error(`Gemini API error: ${errorMsg}. Check your API key or reduce input size.`);
                } else if (response.status === 403) {
                    throw new Error(`Gemini API access denied: ${errorMsg}. Check your API key and permissions.`);
                } else {
                    throw new Error(`Gemini API error: ${errorMsg}`);
                }
            }

            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error("Invalid response from Gemini API");
            }
            
            // Get the response text
            const responseText = data.candidates[0].content.parts.map(part => part.text).join('');
            return responseText;
        } catch (error) {
            console.error(`API attempt ${i+1} failed:`, error);
            
            if (i === retries - 1) throw error;
            
            // Exponential backoff
            const delay = 1000 * Math.pow(2, i);
            updatePopupStatus(`API call failed. Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Ollama API call with retry logic (local LLM)
async function callOllama(messages, retries = 3) {
    if (!OLLAMA_ENDPOINT) {
        throw new Error("Ollama endpoint not configured. Please set it in the options page.");
    }
    
    // Convert chat messages to Ollama format
    const ollamaMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    
    for (let i = 0; i < retries; i++) {
        try {
            updatePopupStatus(`Calling Ollama API (attempt ${i+1}/${retries})...`);
            
            const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    messages: ollamaMessages,
                    stream: false
                })
            });

            if (!response.ok) {
                let errorMsg = `Status code: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // Ignore JSON parsing errors for error responses
                }
                
                console.error("Ollama API error:", errorMsg);
                
                if (response.status === 404) {
                    throw new Error("Ollama endpoint not found. Make sure Ollama is running locally.");
                } else if (response.status === 400) {
                    throw new Error(`Ollama error: ${errorMsg}. The model might not be available.`);
                } else {
                    throw new Error(`Ollama error: ${errorMsg}`);
                }
            }

            const data = await response.json();
            
            if (!data.message || !data.message.content) {
                throw new Error("Invalid response from Ollama API");
            }
            
            return data.message.content;
        } catch (error) {
            console.error(`API attempt ${i+1} failed:`, error);
            
            if (i === retries - 1) throw error;
            
            // Exponential backoff
            const delay = 1000 * Math.pow(2, i);
            updatePopupStatus(`API call failed. Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Analyze comments using the selected LLM
async function analyzeCommentBatch(comments) {
    console.log('analyzeCommentBatch called with', comments.length, 'comments');
    console.log('API Provider:', API_PROVIDER);
    
    const messages = [
        {
            role: 'system',
            content: 'You are analyzing YouTube comments. Provide sentiment analysis and key insights.'
        },
        {
            role: 'user',
            content: `Analyze these comments and provide sentiment scores and key themes. Return your analysis in valid JSON format with "positive", "negative", "neutral" counts and an array of "themes". Example: {"positive": 10, "negative": 5, "neutral": 3, "themes": ["video quality", "helpful content"]}. Here are the comments: ${JSON.stringify(comments)}`
        }
    ];

    try {
        console.log('Calling LLM API for comment analysis...');
        const analysis = await callLLMAPI(messages);
        console.log('LLM API response for comments:', analysis);
        
        // Try to parse the response as JSON
        try {
            const parsed = JSON.parse(analysis);
            console.log('Successfully parsed comment analysis:', parsed);
            return parsed;
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // If parsing fails, attempt to extract JSON from the text
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                console.log('Found JSON in response, attempting to parse...');
                const extracted = JSON.parse(jsonMatch[0]);
                console.log('Successfully extracted and parsed:', extracted);
                return extracted;
            }
            // If no valid JSON found, create a simple structure
            console.error("Couldn't parse LLM response as JSON:", analysis);
            return {
                positive: 0,
                negative: 0,
                neutral: comments.length,
                themes: ["Parsing error - see raw response"],
                rawResponse: analysis
            };
        }
    } catch (error) {
        console.error("Error in analyzeCommentBatch:", error);
        throw error;
    }
}

// Fact checking using the selected LLM
async function performFactCheck(text) {
    const messages = [
        {
            role: 'system',
            content: 'You are a fact-checker. Analyze the given text and provide a structured response with verdict, confidence, and explanation.'
        },
        {
            role: 'user',
            content: `Please fact check this text and provide your analysis in valid JSON format with fields "verdict" (string: "True", "False", "Partially True", "Unverifiable"), "confidence" (number between 0-1), and "explanation" (string). Here's the text: ${text}`
        }
    ];

    try {
        const result = await callLLMAPI(messages);
        // Try to parse the response as JSON
        try {
            return JSON.parse(result);
        } catch (parseError) {
            // If parsing fails, attempt to extract JSON from the text
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // If no valid JSON found, create a simple structure
            console.error("Couldn't parse LLM response as JSON:", result);
            return {
                verdict: "Unverifiable",
                confidence: 0,
                explanation: "Error parsing LLM response. Raw response: " + result.substring(0, 500)
            };
        }
    } catch (error) {
        console.error("Error in performFactCheck:", error);
        throw error;
    }
}

// --- Core Logic Functions ---

async function fetchAndAnalyzeComments(videoId) {
    console.log('fetchAndAnalyzeComments called for video:', videoId);
    await loadSettings();
    console.log('Settings loaded, API Provider:', API_PROVIDER);
    
    // Check if we have API keys for the selected provider
    switch (API_PROVIDER) {
        case 'openai':
            if (!OPENAI_API_KEY) throw new Error("OpenAI API key not configured. Please set it in options.");
            break;
        case 'huggingface':
            if (!HUGGINGFACE_API_KEY) throw new Error("Hugging Face API key not configured. Please set it in options.");
            break;
        case 'gemini':
            if (!GEMINI_API_KEY) throw new Error("Gemini API key not configured. Please set it in options.");
            break;
        case 'ollama':
            if (!OLLAMA_ENDPOINT) throw new Error("Ollama endpoint not configured. Please set it in options.");
            break;
        default:
            throw new Error("Unknown API provider selected. Please check your settings.");
    }
    
    // YouTube API key is still needed for comment fetching
    if (!YOUTUBE_API_KEY) {
        throw new Error("YouTube API key not configured. Comments cannot be fetched without it.");
    }

    console.log('API keys validated successfully');
    updatePopupStatus(`Fetching comments for video: ${videoId}...`, false, true);
    
    let comments = [];
    let nextPageToken = null;
    let totalFetched = 0;

    try {
        console.log('Fetching comments from YouTube API...');
        do {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
            );

            if (!response.ok) {
                console.error('YouTube API response not ok:', response.status, response.statusText);
                throw new Error(`YouTube API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('YouTube API response received, items:', data.items?.length || 0);
            
            const newComments = data.items.map(item => ({
                text: item.snippet.topLevelComment.snippet.textDisplay,
                likes: item.snippet.topLevelComment.snippet.likeCount,
                author: item.snippet.topLevelComment.snippet.authorDisplayName
            }));

            comments.push(...newComments);
            totalFetched += newComments.length;
            nextPageToken = data.nextPageToken;
            
            console.log(`Fetched ${newComments.length} comments, total: ${totalFetched}`);

        } while (nextPageToken && totalFetched < MAX_COMMENTS);

        console.log(`Comment fetching complete. Total comments: ${comments.length}`);
        updatePopupStatus(`Analyzing ${comments.length} comments...`, false, true, 25, 'comments');

        // Process comments in batches
        console.log('Starting batch processing of comments...');
        const analysisResults = await processBatch(comments, BATCH_SIZE, analyzeCommentBatch, 'comments');
        console.log('Batch processing complete, results:', analysisResults);

        // Aggregate results
        const analysis = {
            totalFetched: totalFetched,
            totalAnalyzed: comments.length,
            sentiment: {
                positive: 0,
                negative: 0,
                neutral: 0
            },
            themes: [],
            sampleComments: comments.slice(0, 5)
        };

        // Combine batch results
        analysisResults.forEach(result => {
            analysis.sentiment.positive += result.positive || 0;
            analysis.sentiment.negative += result.negative || 0;
            analysis.sentiment.neutral += result.neutral || 0;
            if (result.themes) {
                analysis.themes.push(...result.themes);
            }
        });

        return analysis;

    } catch (error) {
        console.error("Error in comment analysis:", error);
        throw error;
    }
}

// YouTube transcript fetching with auto-detection
async function fetchTranscriptFromPage(videoId) {
    await loadSettings();
    
    // If manual mode is enabled, use the default transcript
    if (MANUAL_MODE) {
        updatePopupStatus("Using manual transcript mode...");
        
        if (DEFAULT_TRANSCRIPT && DEFAULT_TRANSCRIPT.trim().length > 0) {
            return DEFAULT_TRANSCRIPT;
        } else {
            // Show popup to request transcript input
            chrome.runtime.sendMessage({
                action: "requestManualTranscript",
                videoId: videoId
            }).catch(err => console.error("Error requesting manual transcript:", err));
            
            throw new Error("Manual mode is enabled. Please paste the transcript in the popup.");
        }
    }
    
    // First, try to get the transcript via YouTube API (if key available)
    if (YOUTUBE_API_KEY) {
        try {
            updatePopupStatus("Fetching transcript via YouTube API...");
            const transcript = await fetchTranscriptViaAPI(videoId);
            return transcript;
        } catch (error) {
            console.log("YouTube API transcript fetch failed, falling back to page extraction:", error);
            updatePopupStatus("YouTube API failed, trying page extraction...");
            // Fall through to page extraction
        }
    } else {
        updatePopupStatus("No YouTube API key found, using page extraction...");
    }
    
    // Fall back to page extraction
    try {
        const transcript = await fetchTranscriptViaPageExtraction(videoId);
        return transcript;
    } catch (error) {
        console.error("Transcript extraction failed:", error);
        
        // If all automatic methods fail, ask for manual input
        chrome.runtime.sendMessage({
            action: "requestManualTranscript",
            videoId: videoId,
            error: error.message
        }).catch(err => console.error("Error requesting manual transcript:", err));
        
        throw new Error(`Could not automatically extract transcript: ${error.message}. Please try manual mode.`);
    }
}

// Fetch all available captions for a video
async function fetchAllAvailableCaptions(videoId) {
    if (!YOUTUBE_API_KEY) {
        throw new Error("YouTube API key required for multi-language caption fetching");
    }
    
    updatePopupStatus("Fetching available caption tracks...");
    
    // Get all caption tracks
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
        throw new Error("No captions found for this video");
    }
    
    const captionTracks = data.items;
    console.log(`Found ${captionTracks.length} caption tracks:`, captionTracks.map(track => ({
        language: track.snippet.language,
        name: track.snippet.name,
        kind: track.snippet.trackKind,
        audioTrackType: track.snippet.audioTrackType
    })));
    
    // Analyze available languages and build result structure
    const analysisResult = analyzeCaptionAvailability(captionTracks);
    const allCaptions = {};
    const tracksToFetch = [];
    const missingLanguages = [];
    const availableLanguages = captionTracks.map(track => track.snippet.language);
    
    if (FETCH_ALL_LANGUAGES) {
        // Fetch all available languages
        tracksToFetch.push(...captionTracks);
    } else {
        // Check each preferred language
        for (const langCode of PREFERRED_LANGUAGES) {
            const track = captionTracks.find(track => 
                track.snippet.language && track.snippet.language.toLowerCase().startsWith(langCode.toLowerCase())
            );
            if (track) {
                tracksToFetch.push(track);
            } else {
                // Check if auto-translated version exists
                const autoTranslatedTrack = captionTracks.find(track => 
                    track.snippet.language && 
                    track.snippet.language.toLowerCase().startsWith(langCode.toLowerCase()) &&
                    track.snippet.trackKind === 'asr'
                );
                if (autoTranslatedTrack) {
                    tracksToFetch.push(autoTranslatedTrack);
                } else {
                    missingLanguages.push(langCode);
                }
            }
        }
        
        // If no preferred languages found, fall back to the first available track
        if (tracksToFetch.length === 0 && captionTracks.length > 0) {
            tracksToFetch.push(captionTracks[0]);
        }
    }
    
    console.log(`Will fetch ${tracksToFetch.length} caption tracks`);
    
    if (missingLanguages.length > 0) {
        console.log(`Missing preferred languages: ${missingLanguages.join(', ')}`);
        console.log(`Available languages: ${availableLanguages.join(', ')}`);
    }
    
    // Fetch caption content for each track
    const fetchErrors = [];
    for (let i = 0; i < tracksToFetch.length; i++) {
        const track = tracksToFetch[i];
        const progress = Math.round(((i + 1) / tracksToFetch.length) * 100);
        updatePopupStatus(`Fetching captions: ${track.snippet.name || track.snippet.language} (${progress}%)...`);
        
        try {
            const captionContent = await fetchCaptionTrack(track.id);
            const languageInfo = {
                code: track.snippet.language,
                name: track.snippet.name,
                kind: track.snippet.trackKind,
                audioTrackType: track.snippet.audioTrackType,
                content: captionContent,
                isAutoTranslated: track.snippet.trackKind === 'asr'
            };
            
            allCaptions[track.snippet.language] = languageInfo;
            console.log(`Successfully fetched captions for: ${track.snippet.language} (${track.snippet.name})`);
        } catch (error) {
            console.error(`Failed to fetch caption track ${track.snippet.language}:`, error);
            fetchErrors.push({
                language: track.snippet.language,
                name: track.snippet.name,
                error: error.message
            });
            // Continue with other languages even if one fails
        }
    }
    
    if (Object.keys(allCaptions).length === 0) {
        let errorMessage = "Failed to fetch any caption tracks";
        if (missingLanguages.length > 0) {
            errorMessage += `. Missing languages: ${missingLanguages.join(', ')}. Available languages: ${availableLanguages.join(', ')}`;
        }
        if (fetchErrors.length > 0) {
            errorMessage += `. Fetch errors: ${fetchErrors.map(e => `${e.language}: ${e.error}`).join('; ')}`;
        }
        throw new Error(errorMessage);
    }
    
    // Return enhanced result with language availability info
    return {
        captions: allCaptions,
        availableLanguages: availableLanguages,
        missingLanguages: missingLanguages,
        fetchErrors: fetchErrors,
        totalTracksFound: captionTracks.length,
        totalTracksFetched: Object.keys(allCaptions).length
    };
}

// Fetch content for a specific caption track
async function fetchCaptionTrack(captionId) {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${YOUTUBE_API_KEY}&tfmt=srt`
    );
    
    if (!response.ok) {
        throw new Error(`Failed to fetch caption track: ${response.status}`);
    }
    
    // The response should be SRT format text
    const captionText = await response.text();
    return captionText;
}

// Parse SRT format captions to extract text with timestamps
function parseSRTCaptions(srtContent) {
    const entries = srtContent.split('\n\n').filter(entry => entry.trim());
    const parsedCaptions = [];
    
    for (const entry of entries) {
        const lines = entry.split('\n');
        if (lines.length >= 3) {
            const index = lines[0].trim();
            const timestamp = lines[1].trim();
            const text = lines.slice(2).join(' ').trim();
            
            // Extract start time for sorting/referencing
            const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2},\d{3})/);
            const startTime = timeMatch ? timeMatch[1] : null;
            
            parsedCaptions.push({
                index: parseInt(index),
                timestamp: timestamp,
                startTime: startTime,
                text: text
            });
        }
    }
    
    return parsedCaptions;
}

// Convert SRT captions to simple transcript format
function convertSRTToTranscript(srtContent) {
    const captions = parseSRTCaptions(srtContent);
    return captions.map(caption => `[${caption.startTime}] ${caption.text}`).join('\n');
}

// Fetch transcript via YouTube API (enhanced for multiple languages)
async function fetchTranscriptViaAPI(videoId) {
    try {
        // Check if we should fetch multiple languages
        if (FETCH_ALL_LANGUAGES || PREFERRED_LANGUAGES.length > 1) {
            const captionResult = await fetchAllAvailableCaptions(videoId);
            const allCaptions = captionResult.captions;
            
            // Return the multi-language structure with enhanced metadata
            return {
                type: 'multi-language',
                languages: Object.keys(allCaptions),
                languageData: allCaptions,
                primaryLanguage: Object.keys(allCaptions)[0], // First available language as primary
                combinedTranscript: createCombinedTranscript(allCaptions),
                metadata: {
                    availableLanguages: captionResult.availableLanguages,
                    missingLanguages: captionResult.missingLanguages,
                    fetchErrors: captionResult.fetchErrors,
                    totalTracksFound: captionResult.totalTracksFound,
                    totalTracksFetched: captionResult.totalTracksFetched,
                    hasLimitedSupport: captionResult.missingLanguages.some(lang => hasLimitedCaptionSupport(lang)),
                    limitedSupportLanguages: captionResult.missingLanguages.filter(lang => hasLimitedCaptionSupport(lang))
                }
            };
        } else {
            // Single language mode (backward compatibility)
            const captionResult = await fetchAllAvailableCaptions(videoId);
            const allCaptions = captionResult.captions;
            const primaryLang = Object.keys(allCaptions)[0];
            const primaryCaption = allCaptions[primaryLang];
            
            return convertSRTToTranscript(primaryCaption.content);
        }
    } catch (error) {
        console.error("Multi-language caption fetch failed:", error);
        
        // Enhanced error handling with language-specific messages
        if (error.message.includes('Missing languages:')) {
            // Extract missing languages from error message
            const missingLangsMatch = error.message.match(/Missing languages: ([^.]+)/);
            if (missingLangsMatch) {
                const missingLanguages = missingLangsMatch[1].split(', ');
                const limitedSupportLangs = missingLanguages.filter(lang => hasLimitedCaptionSupport(lang));
                
                if (limitedSupportLangs.length > 0 && BROWSER_EXTRACTION_ENABLED) {
                    console.log(`Attempting browser player extraction for limited-support languages: ${limitedSupportLangs.join(', ')}`);
                    
                    try {
                        const browserResult = await fetchCaptionsViaBrowserPlayer(videoId, limitedSupportLangs);
                        
                        if (browserResult.totalTracksFetched > 0) {
                            // Convert browser extraction result to multi-language format
                            return {
                                type: 'multi-language',
                                languages: Object.keys(browserResult.captions),
                                languageData: browserResult.captions,
                                primaryLanguage: Object.keys(browserResult.captions)[0],
                                combinedTranscript: createCombinedTranscript(browserResult.captions),
                                metadata: {
                                    availableLanguages: browserResult.availableLanguages,
                                    missingLanguages: browserResult.missingLanguages,
                                    fetchErrors: browserResult.fetchErrors,
                                    totalTracksFound: browserResult.totalTracksFound,
                                    totalTracksFetched: browserResult.totalTracksFetched,
                                    extractionMethod: 'browser-player',
                                    hasLimitedSupport: true,
                                    limitedSupportLanguages: limitedSupportLangs
                                }
                            };
                        }
                    } catch (browserError) {
                        console.error("Browser player extraction also failed:", browserError);
                        // Continue to show the original helpful error message
                    }
                    
                    const langNames = limitedSupportLangs.map(lang => getLanguageName(lang)).join(', ');
                    throw new Error(`Captions not available for ${langNames}. These languages have limited auto-generated caption support on YouTube. Browser player extraction was attempted but failed. Try using manual transcript mode or check if the video has manually uploaded captions.`);
                }
            }
        }
        
        // Try browser extraction as general fallback if enabled
        if (BROWSER_EXTRACTION_ENABLED) {
            console.log("Attempting browser player extraction as fallback...");
            try {
                const browserResult = await fetchCaptionsViaBrowserPlayer(videoId, PREFERRED_LANGUAGES);
                
                if (browserResult.totalTracksFetched > 0) {
                    return {
                        type: 'multi-language',
                        languages: Object.keys(browserResult.captions),
                        languageData: browserResult.captions,
                        primaryLanguage: Object.keys(browserResult.captions)[0],
                        combinedTranscript: createCombinedTranscript(browserResult.captions),
                        metadata: {
                            availableLanguages: browserResult.availableLanguages,
                            missingLanguages: browserResult.missingLanguages,
                            fetchErrors: browserResult.fetchErrors,
                            totalTracksFound: browserResult.totalTracksFound,
                            totalTracksFetched: browserResult.totalTracksFetched,
                            extractionMethod: 'browser-player-fallback',
                            hasLimitedSupport: false,
                            limitedSupportLanguages: []
                        }
                    };
                }
            } catch (browserError) {
                console.error("Browser player fallback extraction failed:", browserError);
            }
        }
        
        // Fall back to the original single-language logic
        return await fetchSingleLanguageTranscript(videoId);
    }
}

// Original single-language transcript fetching (fallback)
async function fetchSingleLanguageTranscript(videoId) {
    // Use YouTube Data API to get video caption tracks
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
        throw new Error("No captions found via API");
    }
    
    // Find the first English track or default to first available
    const captionTracks = data.items;
    const englishTrack = captionTracks.find(track => 
        track.snippet.language && track.snippet.language.toLowerCase().includes('en')
    ) || captionTracks[0];
    
    // Request the caption track content
    const captionContent = await fetchCaptionTrack(englishTrack.id);
    return convertSRTToTranscript(captionContent);
}

// Create a combined transcript from multiple languages
function createCombinedTranscript(allCaptions) {
    const languages = Object.keys(allCaptions);
    if (languages.length === 1) {
        return convertSRTToTranscript(allCaptions[languages[0]].content);
    }
    
    let combined = "=== MULTI-LANGUAGE TRANSCRIPT ===\n\n";
    
    for (const [langCode, langData] of Object.entries(allCaptions)) {
        const languageName = getLanguageName(langCode);
        const typeInfo = langData.isAutoTranslated ? ' (Auto-translated)' : 
                        langData.kind === 'asr' ? ' (Auto-generated)' : '';
        
        combined += `--- ${languageName} (${langCode.toUpperCase()})${typeInfo} ---\n`;
        combined += convertSRTToTranscript(langData.content);
        combined += "\n\n";
    }
    
    return combined;
}

// Fetch transcript via page extraction (no API key required)
async function fetchTranscriptViaPageExtraction(videoId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0]?.id) {
                reject(new Error("Cannot access active tab"));
                return;
            }
            
            try {
                // Inject content script to extract transcript
                const result = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: extractTranscriptFromPage,
                });
                
                if (result && result[0] && result[0].result) {
                    resolve(result[0].result);
                } else {
                    reject(new Error("Could not extract transcript from page"));
                }
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Content script function to extract transcript from YouTube page
function extractTranscriptFromPage() {
    return new Promise((resolve, reject) => {
        // Find transcript button and click it
        const transcriptButton = Array.from(document.querySelectorAll('button'))
            .find(button => button.textContent?.includes('Show transcript'));
        
        if (!transcriptButton) {
            reject("Transcript button not found on page");
            return;
        }
        
        transcriptButton.click();
        
        // Wait for transcript panel to appear
        setTimeout(() => {
            const transcriptPanel = document.querySelector('ytd-transcript-renderer');
            if (!transcriptPanel) {
                reject("Transcript panel not found after clicking button");
                return;
            }
            
            // Extract text from transcript segments
            const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
            const transcriptText = Array.from(segments).map(segment => {
                const timeElement = segment.querySelector('.segment-timestamp');
                const textElement = segment.querySelector('.segment-text');
                if (timeElement && textElement) {
                    return `[${timeElement.textContent.trim()}] ${textElement.textContent.trim()}`;
                }
                return '';
            }).join('\n');
            
            resolve(transcriptText);
            
            // Close transcript panel
            const closeButton = transcriptPanel.querySelector('button[aria-label="Close transcript"]');
            if (closeButton) {
                closeButton.click();
            }
        }, 1000);
    });
}

// Fetch captions via browser player extraction (alternative method)
async function fetchCaptionsViaBrowserPlayer(videoId, preferredLanguages = []) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0]?.id) {
                reject(new Error("Cannot access active tab"));
                return;
            }
            
            try {
                updatePopupStatus("Extracting captions from browser player...");
                
                // Send message to content script to extract captions
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "extractCaptionsFromPlayer",
                    preferredLanguages: preferredLanguages.length > 0 ? preferredLanguages : PREFERRED_LANGUAGES
                });
                
                if (response && response.success) {
                    const results = response.results;
                    
                    // Convert browser extraction results to our format
                    const formattedCaptions = {};
                    const availableLanguages = results.availableLanguages.map(lang => lang.code);
                    const missingLanguages = [];
                    const fetchErrors = results.errors || [];
                    
                    // Process extracted captions
                    for (const [langCode, captionData] of Object.entries(results.extractedCaptions)) {
                        const langInfo = results.availableLanguages.find(lang => lang.code === langCode);
                        formattedCaptions[langCode] = {
                            code: langCode,
                            name: langInfo?.name || getLanguageName(langCode),
                            kind: 'browser-extracted',
                            audioTrackType: 'primary',
                            content: captionData.transcript,
                            extractedSegments: captionData.extractedSegments,
                            isAutoTranslated: false
                        };
                    }
                    
                    // Check for missing preferred languages
                    if (preferredLanguages.length > 0) {
                        for (const prefLang of preferredLanguages) {
                            if (!availableLanguages.some(lang => lang.startsWith(prefLang))) {
                                missingLanguages.push(prefLang);
                            }
                        }
                    }
                    
                    const result = {
                        captions: formattedCaptions,
                        availableLanguages: availableLanguages,
                        missingLanguages: missingLanguages,
                        fetchErrors: fetchErrors,
                        totalTracksFound: results.availableLanguages.length,
                        totalTracksFetched: Object.keys(formattedCaptions).length,
                        extractionMethod: 'browser-player'
                    };
                    
                    resolve(result);
                } else {
                    reject(new Error(response?.error || "Failed to extract captions from browser player"));
                }
            } catch (error) {
                reject(new Error(`Browser player extraction failed: ${error.message}`));
            }
        });
    });
}

// Get available caption tracks from browser player
async function getAvailableCaptionTracksFromPlayer(videoId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0]?.id) {
                reject(new Error("Cannot access active tab"));
                return;
            }
            
            try {
                updatePopupStatus("Checking available caption tracks in player...");
                
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "getAvailableCaptionTracks"
                });
                
                if (response && response.success) {
                    resolve(response.tracks);
                } else {
                    reject(new Error(response?.error || "Failed to get caption tracks from player"));
                }
            } catch (error) {
                reject(new Error(`Failed to access player caption tracks: ${error.message}`));
            }
        });
    });
}

// Analyze caption availability and provide detailed language information
function analyzeCaptionAvailability(captionTracks) {
    const availableLanguages = new Map();
    const autoTranslatedLanguages = new Set();
    const originalLanguages = new Set();
    
    for (const track of captionTracks) {
        const langCode = track.snippet.language;
        const trackInfo = {
            code: langCode,
            name: track.snippet.name,
            kind: track.snippet.trackKind,
            audioTrackType: track.snippet.audioTrackType,
            isAutoGenerated: track.snippet.trackKind === 'asr',
            isAutoTranslated: track.snippet.trackKind === 'asr' && track.snippet.audioTrackType !== 'primary'
        };
        
        if (!availableLanguages.has(langCode)) {
            availableLanguages.set(langCode, []);
        }
        availableLanguages.get(langCode).push(trackInfo);
        
        if (trackInfo.isAutoTranslated) {
            autoTranslatedLanguages.add(langCode);
        } else {
            originalLanguages.add(langCode);
        }
    }
    
    return {
        availableLanguages,
        autoTranslatedLanguages,
        originalLanguages,
        totalTracks: captionTracks.length,
        languageCount: availableLanguages.size
    };
}

// Get language name from language code (for better user display)
function getLanguageName(langCode) {
    const languageNames = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'it': 'Italian',
        'nl': 'Dutch',
        'sv': 'Swedish',
        'da': 'Danish',
        'no': 'Norwegian',
        'fi': 'Finnish',
        'pl': 'Polish',
        'tr': 'Turkish',
        'th': 'Thai',
        'vi': 'Vietnamese',
        'ta': 'Tamil',
        'te': 'Telugu',
        'bn': 'Bengali',
        'ur': 'Urdu',
        'ml': 'Malayalam',
        'kn': 'Kannada',
        'gu': 'Gujarati',
        'pa': 'Punjabi',
        'or': 'Oriya',
        'as': 'Assamese',
        'mr': 'Marathi'
    };
    
    return languageNames[langCode] || langCode.toUpperCase();
}

// Check if a language has limited caption support
function hasLimitedCaptionSupport(langCode) {
    // Languages that typically have limited auto-generated caption support
    const limitedSupportLanguages = [
        'ta', 'te', 'bn', 'ur', 'ml', 'kn', 'gu', 'pa', 'or', 'as', 'mr', // Indian languages
        'my', 'km', 'lo', 'si', 'ne', 'dv', // Southeast Asian languages
        'am', 'ti', 'om', 'so', 'sw', 'zu', 'xh', 'af', // African languages
        'is', 'fo', 'ga', 'cy', 'mt', 'lb', 'eu', 'ca', // European minority languages
        'he', 'yi', 'fa', 'ps', 'ku', 'az', 'kk', 'ky', 'uz', 'tg', 'tk', // Middle Eastern/Central Asian
        'ka', 'hy', 'be', 'lv', 'lt', 'et', 'mk', 'bg', 'hr', 'sr', 'bs', 'sq', 'sl', // Eastern European
        'id', 'ms', 'tl', 'ceb', 'haw', 'mg', 'sm', 'to', 'fj' // Other Pacific/Asian languages
    ];
    
    return limitedSupportLanguages.includes(langCode);
}

// --- Event Listeners ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received message:", request);

    if (request.action === "getTranscript") {
        // First check the cache
        const cachedTranscript = getCachedTranscript(request.videoId);
        if (cachedTranscript) {
            sendDataToPopup("displayTranscript", cachedTranscript);
            return true;
        }
        
        // If not in cache, fetch it
        fetchTranscriptFromPage(request.videoId)
            .then(transcript => {
                // Cache the transcript
                cacheTranscript(request.videoId, transcript);
                
                // Handle both multi-language and single-language transcripts
                if (transcript && typeof transcript === 'object' && transcript.type === 'multi-language') {
                    // Send multi-language transcript with language information
                    sendDataToPopup("displayTranscript", {
                        type: 'multi-language',
                        languages: Object.keys(transcript.languages),
                        primaryLanguage: transcript.primaryLanguage,
                        combinedTranscript: transcript.combinedTranscript,
                        languageData: transcript.languages
                    });
                } else {
                    // Send single-language transcript (backward compatibility)
                    sendDataToPopup("displayTranscript", transcript);
                }
            })
            .catch(error => {
                console.error("Transcript error:", error);
                chrome.runtime.sendMessage({
                    action: "displayTranscript",
                    error: error.message
                });
                updatePopupStatus(error.message, true, false);
            });
        return true;
    }

    if (request.action === "analyzeComments") {
        console.log('analyzeComments request received for video:', request.videoId);
        
        // First check the cache
        const cachedAnalysis = getCachedCommentAnalysis(request.videoId, API_PROVIDER);
        if (cachedAnalysis) {
            console.log('Using cached comment analysis');
            chrome.runtime.sendMessage({
                action: "displayCommentAnalysis",
                data: {
                    ...cachedAnalysis,
                    provider: API_PROVIDER,
                    fromCache: true
                }
            });
            return true;
        }
        
        console.log('No cached analysis found, performing new analysis...');
        // If not in cache, perform analysis
        fetchAndAnalyzeComments(request.videoId)
            .then(result => {
                console.log('Comment analysis completed:', result);
                // Cache the analysis
                cacheCommentAnalysis(request.videoId, API_PROVIDER, result);
                chrome.runtime.sendMessage({
                    action: "displayCommentAnalysis",
                    data: {
                        ...result,
                        provider: API_PROVIDER
                    }
                });
            })
            .catch(error => {
                console.error("Comment analysis error:", error);
                chrome.runtime.sendMessage({
                    action: "displayCommentAnalysis",
                    error: error.message
                });
                updatePopupStatus(error.message, true, false);
            });
        return true;
    }
    
    if (request.action === "performRagAnalysis") {
        console.log('performRagAnalysis request received for video:', request.videoId, 'query:', request.query);
        
        // First check the cache
        const cachedRagAnalysis = getCachedRagAnalysis(request.videoId, request.query, API_PROVIDER);
        if (cachedRagAnalysis) {
            console.log('Using cached RAG analysis');
            chrome.runtime.sendMessage({
                action: "displayRagAnalysis",
                data: {
                    ...cachedRagAnalysis,
                    provider: API_PROVIDER,
                    fromCache: true
                }
            });
            return true;
        }
        
        console.log('No cached RAG analysis found, performing new analysis...');
        // If not in cache, perform analysis
        performRagAnalysis(request.videoId, request.query)
            .then(result => {
                console.log('RAG analysis completed:', result);
                // Cache the RAG analysis
                cacheRagAnalysis(request.videoId, request.query, API_PROVIDER, result);
                chrome.runtime.sendMessage({
                    action: "displayRagAnalysis",
                    data: {
                        ...result,
                        provider: API_PROVIDER
                    }
                });
            })
            .catch(error => {
                console.error("RAG analysis error:", error);
                chrome.runtime.sendMessage({
                    action: "displayRagAnalysis",
                    error: error.message
                });
                updatePopupStatus(error.message, true, false);
            });
        return true;
    }

    if (request.action === "performFactCheck") {
        console.log('performFactCheck request received for text:', request.text?.substring(0, 50) + '...');
        
        performFactCheck(request.text)
            .then(result => {
                console.log('Fact-check completed:', result);
                chrome.runtime.sendMessage({
                    action: "displayFactCheck",
                    data: {
                        ...result,
                        provider: API_PROVIDER
                    }
                });
            })
            .catch(error => {
                console.error("Fact-check error:", error);
                chrome.runtime.sendMessage({
                    action: "displayFactCheck",
                    error: error.message
                });
                updatePopupStatus(error.message, true, false);
            });
        return true;
    }

    if (request.action === "useManualTranscript") {
        const transcript = request.transcript;
        if (transcript) {
            updatePopupStatus("Processing manual transcript...");
            sendDataToPopup("displayTranscript", transcript);
            
            // Save for future use if needed
            if (request.saveAsDefault) {
                chrome.storage.local.set({ defaultTranscript: transcript });
            }
        }
        return true;
    }

    return false;
});

// Listen for storage changes to reload settings
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        console.log('Storage changed, reloading settings...', changes);
        loadSettings();
    }
});

// Initialize extension on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension starting up, loading settings...');
    loadSettings();
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated, loading settings and setting up context menu...');
    loadSettings();
    setupContextMenu();
});

// Set up context menu for fact-checking
function setupContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "factCheckSelection",
            title: "Fact-Check Selection",
            contexts: ["selection"],
            documentUrlPatterns: ["*://www.youtube.com/*"]
        });
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "factCheckSelection") {
        if (info.selectionText) {
            console.log('Fact-check requested for:', info.selectionText);
            
            // Send the selected text for fact-checking
            chrome.runtime.sendMessage({
                action: "performFactCheck",
                text: info.selectionText,
                tabId: tab.id
            }).catch(err => console.error("Error sending fact-check message:", err));
        }
    }
});

// Load settings on extension start
loadSettings();