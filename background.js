// --- Globals ---
let YOUTUBE_API_KEY = null;
let API_PROVIDER = 'openai';

// OpenAI settings
let OPENAI_API_KEY = null;
let OPENAI_MODEL = 'gpt-3.5-turbo';

// Hugging Face settings
let HUGGINGFACE_API_KEY = null;
let HUGGINGFACE_MODEL = 'microsoft/phi-2';

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
            'defaultTranscript'
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
        HUGGINGFACE_MODEL = settings.huggingfaceModel || 'microsoft/phi-2';
        
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

        console.log("Settings loaded",
            `Provider: ${API_PROVIDER}`,
            YOUTUBE_API_KEY ? "YouTube API: ✓" : "YouTube API: ✗",
            MANUAL_MODE ? "Manual Mode: ✓" : "Manual Mode: ✗");
            
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
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await processFunc(batch);
        results.push(...batchResults);
        
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
    return results;
}

// Call the selected LLM API based on user preference
async function callLLMAPI(messages, retries = 3) {
    await loadSettings(); // Make sure we have the latest settings
    
    switch(API_PROVIDER) {
        case 'openai':
            return callOpenAI(messages, retries);
        case 'huggingface':
            return callHuggingFace(messages, retries);
        case 'gemini':
            return callGemini(messages, retries);
        case 'ollama':
            return callOllama(messages, retries);
        default:
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
                const data = await response.json().catch(() => ({}));
                const errorMsg = data.error || `Status code: ${response.status}`;
                console.error("Hugging Face API error:", data);
                
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

            const data = await response.json();
            
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
        const analysis = await callLLMAPI(messages);
        // Try to parse the response as JSON
        try {
            return JSON.parse(analysis);
        } catch (parseError) {
            // If parsing fails, attempt to extract JSON from the text
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
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
    await loadSettings();
    if (!YOUTUBE_API_KEY || !OPENAI_API_KEY) {
        throw new Error("API keys not configured");
    }

    updatePopupStatus(`Fetching comments for video: ${videoId}...`, false, true);
    
    let comments = [];
    let nextPageToken = null;
    let totalFetched = 0;

    try {
        do {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
            );

            if (!response.ok) {
                throw new Error(`YouTube API error: ${response.status}`);
            }

            const data = await response.json();
            const newComments = data.items.map(item => ({
                text: item.snippet.topLevelComment.snippet.textDisplay,
                likes: item.snippet.topLevelComment.snippet.likeCount,
                author: item.snippet.topLevelComment.snippet.authorDisplayName
            }));

            comments.push(...newComments);
            totalFetched += newComments.length;
            nextPageToken = data.nextPageToken;

        } while (nextPageToken && totalFetched < MAX_COMMENTS);

        updatePopupStatus(`Analyzing ${comments.length} comments...`, false, true, 25, 'comments');

        // Process comments in batches
        const analysisResults = await processBatch(comments, BATCH_SIZE, analyzeCommentBatch, 'comments');

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

// Fetch transcript via YouTube API (requires API key)
async function fetchTranscriptViaAPI(videoId) {
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
    const captionId = englishTrack.id;
    const transcriptResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${YOUTUBE_API_KEY}`
    );
    
    if (!transcriptResponse.ok) {
        throw new Error(`Failed to fetch caption track: ${transcriptResponse.status}`);
    }
    
    const transcriptData = await transcriptResponse.json();
    return transcriptData.snippet.text;
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

// RAG implementation using the selected LLM API
async function performRagAnalysis(videoId, query) {
    await loadSettings();
    
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
    
    updatePopupStatus("Fetching video information...");
    
    // First, get the transcript
    let transcript;
    try {
        transcript = await fetchTranscriptFromPage(videoId);
    } catch (error) {
        throw new Error(`Failed to get transcript: ${error.message}`);
    }
    
    // Get video metadata
    let videoTitle = "YouTube Video";
    let videoAuthor = "Unknown Creator";
    
    try {
        if (YOUTUBE_API_KEY) {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    videoTitle = data.items[0].snippet.title;
                    videoAuthor = data.items[0].snippet.channelTitle;
                }
            }
        } else {
            // Try to get title from document title if we're on YouTube
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.url && tab.url.includes('youtube.com/watch') && tab.title) {
                    videoTitle = tab.title.replace(' - YouTube', '');
                }
            });
        }
    } catch (error) {
        console.error("Error fetching video metadata:", error);
        // Continue with default values
    }
    
    updatePopupStatus(`Processing with RAG using ${API_PROVIDER.toUpperCase()}...`);
    
    // Chunking the transcript for better retrieval
    const chunks = chunkText(transcript, CHUNK_SIZE, Math.floor(CHUNK_SIZE * 0.2));
    
    // Implement RAG processing
    try {
        // Adjust chunk handling based on the provider's capabilities
        let chunkedContent;
        
        // Some providers might have smaller context windows
        if (API_PROVIDER === 'huggingface' || API_PROVIDER === 'ollama') {
            // For smaller context models, use fewer chunks or summarize chunks first
            const relevantChunks = selectRelevantChunks(chunks, query);
            chunkedContent = relevantChunks.map((chunk, i) => `CHUNK ${i+1}:\n${chunk}`).join('\n\n');
        } else {
            // For larger context models like OpenAI and Gemini, use all chunks
            chunkedContent = chunks.map((chunk, i) => `CHUNK ${i+1}:\n${chunk}`).join('\n\n');
        }
        
        const messages = [
            {
                role: 'system',
                content: `You are analyzing a YouTube video titled "${videoTitle}" by "${videoAuthor}". 
                Use the transcript chunks to answer the user's question. 
                Include timestamps from the transcript when relevant.
                If the answer isn't in the transcript, clearly state that.`
            },
            {
                role: 'user',
                content: `The transcript of the video is split into chunks for analysis:
                ${chunkedContent}
                
                Based on this information, please answer the following question: ${query}`
            }
        ];
        
        const response = await callLLMAPI(messages);
        
        // Extract potential sources from the transcript based on the answer
        const sources = extractRelevantSources(transcript, response);
        
        return {
            answer: response,
            sources: sources,
            provider: API_PROVIDER
        };
    } catch (error) {
        console.error("RAG processing error:", error);
        throw error;
    }
}

// Helper function to select the most relevant chunks for smaller context window models
function selectRelevantChunks(chunks, query) {
    // Simple keyword matching for relevance
    const keywords = query.toLowerCase().split(' ')
        .filter(word => word.length > 3)
        .filter(word => !["what", "when", "where", "which", "whose", "whom", "will", "this", "that", "these", "those", "with", "about", "from"].includes(word));
    
    // Score each chunk by counting keywords
    const scoredChunks = chunks.map(chunk => {
        const lowerChunk = chunk.toLowerCase();
        let score = 0;
        keywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'g');
            const matches = lowerChunk.match(regex);
            if (matches) score += matches.length;
        });
        return { chunk, score };
    });
    
    // Sort by score and take top chunks
    scoredChunks.sort((a, b) => b.score - a.score);
    const maxChunks = 3; // Adjust based on model capacity
    
    return scoredChunks.slice(0, maxChunks).map(item => item.chunk);
}

// Helper function to chunk text for RAG
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = Math.floor(CHUNK_SIZE * 0.2)) {
    const chunks = [];
    let i = 0;
    
    // Default to global CHUNK_SIZE if not specified
    if (!chunkSize || chunkSize < 100) {
        chunkSize = CHUNK_SIZE;
    }
    
    // Default overlap to 20% if not specified
    if (!overlap || overlap < 10) {
        overlap = Math.floor(chunkSize * 0.2);
    }
    
    while (i < text.length) {
        const chunk = text.substring(i, i + chunkSize);
        chunks.push(chunk);
        i += (chunkSize - overlap);
    }
    
    console.log(`Text chunked into ${chunks.length} pieces (size: ${chunkSize}, overlap: ${overlap})`);
    return chunks;
}

// Helper function to extract relevant sources from the transcript
function extractRelevantSources(transcript, answer) {
    const sources = [];
    const transcriptLines = transcript.split('\n');
    
    // Find timestamps mentioned in the answer
    const timestampRegex = /\[(\d+:\d+)\]/g;
    const mentionedTimestamps = Array.from(answer.matchAll(timestampRegex))
        .map(match => match[1]);
        
    // If timestamps are mentioned, include those segments
    if (mentionedTimestamps.length > 0) {
        mentionedTimestamps.forEach(timestamp => {
            const matchingLine = transcriptLines.find(line => line.includes(`[${timestamp}]`));
            if (matchingLine) {
                sources.push(matchingLine);
            }
        });
    } 
    
    // If no specific timestamps, find keyword matches
    if (sources.length === 0) {
        // Extract keywords from the answer (non-stopwords)
        const keywords = extractKeywords(answer);
        
        // Find transcript lines containing these keywords
        keywords.forEach(keyword => {
            transcriptLines.forEach(line => {
                if (line.toLowerCase().includes(keyword.toLowerCase()) && 
                    !sources.includes(line)) {
                    sources.push(line);
                }
            });
        });
        
        // Limit to 5 most relevant sources
        sources.splice(5);
    }
    
    return sources;
}

// Helper function to extract keywords from text
function extractKeywords(text) {
    const stopwords = ["a", "about", "above", "after", "again", "against", "all", "am", "an", "and", 
                      "any", "are", "as", "at", "be", "because", "been", "before", "being", "below", 
                      "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down", 
                      "during", "each", "few", "for", "from", "further", "had", "has", "have", "having", 
                      "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", 
                      "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my", 
                      "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", 
                      "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", 
                      "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", 
                      "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", 
                      "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", 
                      "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves"];
                      
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopwords.includes(word));
        
    // Get unique words and sort by length (longer words are typically more specific)
    const uniqueWords = [...new Set(words)].sort((a, b) => b.length - a.length);
    
    // Return the top 10 keywords
    return uniqueWords.slice(0, 10);
}

// Send data to popup
function sendDataToPopup(action, data) {
    chrome.runtime.sendMessage({
        action: action,
        data: data
    }).catch(err => {
        console.error("Error sending data to popup:", err);
    });
}

// --- Cache Management ---
function getCachedTranscript(videoId) {
    const cachedItem = transcriptCache[videoId];
    if (!cachedItem) return null;
    
    // Check if cache is still valid
    if (Date.now() - cachedItem.timestamp < CACHE_TIMEOUT) {
        console.log(`Using cached transcript for video ${videoId}`);
        return cachedItem.data;
    } else {
        // Cache expired
        delete transcriptCache[videoId];
        return null;
    }
}

function cacheTranscript(videoId, data) {
    transcriptCache[videoId] = {
        data: data,
        timestamp: Date.now()
    };
    console.log(`Cached transcript for video ${videoId}`);
    
    // Clean up old cache entries
    cleanCache(transcriptCache);
}

function getCachedCommentAnalysis(videoId, provider) {
    const cacheKey = `${videoId}_${provider}`;
    const cachedItem = commentAnalysisCache[cacheKey];
    if (!cachedItem) return null;
    
    // Check if cache is still valid
    if (Date.now() - cachedItem.timestamp < CACHE_TIMEOUT) {
        console.log(`Using cached comment analysis for video ${videoId} (${provider})`);
        return cachedItem.data;
    } else {
        // Cache expired
        delete commentAnalysisCache[cacheKey];
        return null;
    }
}

function cacheCommentAnalysis(videoId, provider, data) {
    const cacheKey = `${videoId}_${provider}`;
    commentAnalysisCache[cacheKey] = {
        data: data,
        timestamp: Date.now()
    };
    console.log(`Cached comment analysis for video ${videoId} (${provider})`);
    
    // Clean up old cache entries
    cleanCache(commentAnalysisCache);
}

function getCachedRagAnalysis(videoId, query, provider) {
    const cacheKey = `${videoId}_${query}_${provider}`;
    const cachedItem = ragAnalysisCache[cacheKey];
    if (!cachedItem) return null;
    
    // Check if cache is still valid
    if (Date.now() - cachedItem.timestamp < CACHE_TIMEOUT) {
        console.log(`Using cached RAG analysis for video ${videoId}, query: ${query.substring(0, 20)}... (${provider})`);
        return cachedItem.data;
    } else {
        // Cache expired
        delete ragAnalysisCache[cacheKey];
        return null;
    }
}

function cacheRagAnalysis(videoId, query, provider, data) {
    const cacheKey = `${videoId}_${query}_${provider}`;
    ragAnalysisCache[cacheKey] = {
        data: data,
        timestamp: Date.now()
    };
    console.log(`Cached RAG analysis for video ${videoId}, query: ${query.substring(0, 20)}... (${provider})`);
    
    // Clean up old cache entries
    cleanCache(ragAnalysisCache);
}

function cleanCache(cache) {
    const now = Date.now();
    const cacheKeys = Object.keys(cache);
    
    // If cache has more than 20 items, remove oldest entries
    if (cacheKeys.length > 20) {
        const oldestKeys = cacheKeys
            .map(key => ({ key, timestamp: cache[key].timestamp }))
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, cacheKeys.length - 20)
            .map(item => item.key);
        
        oldestKeys.forEach(key => delete cache[key]);
    }
    
    // Remove expired entries
    cacheKeys.forEach(key => {
        if (now - cache[key].timestamp > CACHE_TIMEOUT) {
            delete cache[key];
        }
    });
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
                sendDataToPopup("displayTranscript", transcript);
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
        // First check the cache
        const cachedAnalysis = getCachedCommentAnalysis(request.videoId, API_PROVIDER);
        if (cachedAnalysis) {
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
        
        // If not in cache, perform analysis
        fetchAndAnalyzeComments(request.videoId)
            .then(result => {
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
        // First check the cache
        const cachedRagAnalysis = getCachedRagAnalysis(request.videoId, request.query, API_PROVIDER);
        if (cachedRagAnalysis) {
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
        
        // If not in cache, perform analysis
        performRagAnalysis(request.videoId, request.query)
            .then(result => {
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