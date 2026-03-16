// --- Globals ---
let YOUTUBE_API_KEY = null;
let API_PROVIDER = 'openai';

// OpenAI settings
let OPENAI_API_KEY = null;
let OPENAI_MODEL = 'gpt-4.1-mini';

// Hugging Face settings
let HUGGINGFACE_API_KEY = null;
let HUGGINGFACE_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

// Gemini settings
let GEMINI_API_KEY = null;
let GEMINI_MODEL = 'gemini-2.0-flash';

// Ollama settings
let OLLAMA_ENDPOINT = 'http://localhost:11434';
let OLLAMA_MODEL = 'llama3.2:3b';

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

// LRU Cache implementation with TTL and size limits
class LRUCache {
    constructor(maxSize = 20, ttlMs = 60 * 60 * 1000, storageKey = null) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.storageKey = storageKey;
        this.cache = new Map();
        if (this.storageKey) {
            this._restoreFromSession();
        }
    }

    async _restoreFromSession() {
        try {
            const result = await chrome.storage.session.get(this.storageKey);
            if (result[this.storageKey]) {
                const entries = JSON.parse(result[this.storageKey]);
                for (const [key, entry] of entries) {
                    if (Date.now() - entry.timestamp < this.ttlMs) {
                        this.cache.set(key, entry);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to restore cache from session storage:', e);
        }
    }

    _persistToSession() {
        if (!this.storageKey) return;
        try {
            const entries = Array.from(this.cache.entries());
            chrome.storage.session.set({
                [this.storageKey]: JSON.stringify(entries)
            }).catch(() => {});
        } catch (e) {
            // Silently fail - session storage is a best-effort optimization
        }
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const entry = this.cache.get(key);
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            this._persistToSession();
            return null;
        }
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }

    set(key, data) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, { data, timestamp: Date.now() });
        this._persistToSession();
    }

    clear() {
        this.cache.clear();
        this._persistToSession();
    }

    get size() {
        return this.cache.size;
    }

    // Remove all expired entries
    evictExpired() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.ttlMs) {
                this.cache.delete(key);
            }
        }
        this._persistToSession();
    }
}

// Cache instances with reasonable limits
const transcriptCache = new LRUCache(10, 60 * 60 * 1000, 'cache_transcripts');
const commentAnalysisCache = new LRUCache(10, 60 * 60 * 1000, 'cache_comments');
const ragAnalysisCache = new LRUCache(20, 30 * 60 * 1000, 'cache_rag');

// Cache accessor functions
function getCachedTranscript(videoId) {
    return transcriptCache.get(videoId);
}
function cacheTranscript(videoId, transcript) {
    transcriptCache.set(videoId, transcript);
}
function getCachedCommentAnalysis(videoId, provider) {
    return commentAnalysisCache.get(`${videoId}_${provider}`);
}
function cacheCommentAnalysis(videoId, provider, result) {
    commentAnalysisCache.set(`${videoId}_${provider}`, result);
}
function getCachedRagAnalysis(videoId, query, provider) {
    return ragAnalysisCache.get(`${videoId}_${query}_${provider}`);
}
function cacheRagAnalysis(videoId, query, provider, result) {
    ragAnalysisCache.set(`${videoId}_${query}_${provider}`, result);
}

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
        OPENAI_MODEL = settings.openaiModel || 'gpt-4.1-mini';
        
        // Hugging Face settings
        HUGGINGFACE_API_KEY = settings.huggingfaceApiKey || null;
        HUGGINGFACE_MODEL = settings.huggingfaceModel || 'Qwen/Qwen2.5-7B-Instruct';
        
        // Gemini settings
        GEMINI_API_KEY = settings.geminiApiKey || null;
        GEMINI_MODEL = settings.geminiModel || 'gemini-2.0-flash';
        
        // Ollama settings
        OLLAMA_ENDPOINT = settings.ollamaEndpoint || 'http://localhost:11434';
        OLLAMA_MODEL = settings.ollamaModel || 'llama3.2:3b';
        
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

// Send data to popup (transcript, analysis results, etc.)
function sendDataToPopup(action, data) {
    chrome.runtime.sendMessage({
        action: action,
        data: data
    }).catch(err => {
        console.error("Error sending data to popup:", err);
    });
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
            // Yield to event loop to allow GC (gc() is not available in service workers)
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
    
    const modelCandidates = [
        GEMINI_MODEL,
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ].filter(Boolean).filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const candidateModel of modelCandidates) {
        for (let i = 0; i < retries; i++) {
        try {
            updatePopupStatus(`Calling Gemini API with ${candidateModel} (attempt ${i+1}/${retries})...`);
            
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/${candidateModel}:generateContent?key=${GEMINI_API_KEY}`,
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
                        throw new Error(`Gemini model '${candidateModel}' is not available for this key/project.`);
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
            
            const errorText = error?.message || '';
            const isModelAvailabilityError = /not available|not found|not supported/i.test(errorText);
            const isAuthOrQuotaError = /access denied|permissions|401|403|429/i.test(errorText);

            // If model is unavailable, try next model candidate immediately.
            if (isModelAvailabilityError) {
                break;
            }

            if (i === retries - 1) throw error;

            // Do not aggressively retry auth/quota failures.
            if (isAuthOrQuotaError) {
                throw error;
            }
            
            // Exponential backoff
            const delay = 1000 * Math.pow(2, i);
            updatePopupStatus(`API call failed. Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        }
    }

    throw new Error('No compatible Gemini model found. Select another model in options and re-test API.');
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

// RAG Analysis: chunk transcript and query LLM with context
async function performRagAnalysis(videoId, query) {
    await loadSettings();

    // Validate LLM API key
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
            throw new Error("Unknown API provider. Please check your settings.");
    }

    updatePopupStatus("Fetching transcript for RAG analysis...", false, true);

    // Get transcript (use cache if available)
    let transcriptText = '';
    const cachedTranscript = getCachedTranscript(videoId);
    if (cachedTranscript) {
        if (typeof cachedTranscript === 'object' && cachedTranscript.combinedTranscript) {
            transcriptText = cachedTranscript.combinedTranscript;
        } else if (typeof cachedTranscript === 'string') {
            transcriptText = cachedTranscript;
        }
    }

    if (!transcriptText) {
        const transcript = await fetchTranscriptFromPage(videoId);
        cacheTranscript(videoId, transcript);
        if (typeof transcript === 'object' && transcript.combinedTranscript) {
            transcriptText = transcript.combinedTranscript;
        } else if (typeof transcript === 'string') {
            transcriptText = transcript;
        }
    }

    if (!transcriptText) {
        throw new Error("No transcript available for RAG analysis. Please fetch the transcript first.");
    }

    updatePopupStatus("Analyzing transcript with your query...", false, true, 50, 'rag');

    // Chunk the transcript
    const chunks = [];
    for (let i = 0; i < transcriptText.length; i += CHUNK_SIZE) {
        chunks.push(transcriptText.substring(i, i + CHUNK_SIZE));
    }

    // Use the most relevant chunks (limit to avoid exceeding API token limits)
    const contextText = chunks.slice(0, 5).join('\n...\n');

    const messages = [
        {
            role: 'system',
            content: 'You are a helpful assistant that answers questions about YouTube videos based on their transcript. Provide accurate answers with references to specific parts of the transcript when possible. Return your response as valid JSON with fields "answer" (string) and "sources" (array of strings with relevant transcript excerpts).'
        },
        {
            role: 'user',
            content: `Based on the following video transcript, answer this question: "${query}"\n\nTranscript:\n${contextText}`
        }
    ];

    const result = await callLLMAPI(messages);

    // Parse the response
    try {
        const parsed = JSON.parse(result);
        return {
            answer: parsed.answer || result,
            sources: parsed.sources || [],
            query: query,
            provider: API_PROVIDER
        };
    } catch (parseError) {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const extracted = JSON.parse(jsonMatch[0]);
            return {
                answer: extracted.answer || result,
                sources: extracted.sources || [],
                query: query,
                provider: API_PROVIDER
            };
        }
        return {
            answer: result,
            sources: [],
            query: query,
            provider: API_PROVIDER
        };
    }
}

// Fetch comments via YouTube Data API v3
async function fetchCommentsViaAPI(videoId) {
    const comments = [];
    let nextPageToken = null;
    let totalFetched = 0;

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

    return comments;
}

// Fetch comments by scraping the YouTube page DOM (no API key required)
async function fetchCommentsViaDOM(videoId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0]?.id) {
                reject(new Error("Cannot access active tab for comment scraping"));
                return;
            }
            try {
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "scrapeCommentsFromPage",
                    maxComments: MAX_COMMENTS
                });
                if (response && response.success) {
                    resolve(response.comments);
                } else {
                    reject(new Error(response?.error || "DOM comment scraping failed"));
                }
            } catch (error) {
                reject(new Error(`Comment scraping failed: ${error.message}`));
            }
        });
    });
}

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
    
    console.log('API keys validated successfully');
    updatePopupStatus(`Fetching comments for video: ${videoId}...`, false, true);

    let comments = [];
    let fetchMethod = 'api';

    try {
        if (YOUTUBE_API_KEY) {
            // Try YouTube Data API first
            comments = await fetchCommentsViaAPI(videoId);
        } else {
            // No API key — use DOM scraping fallback
            console.log('No YouTube API key, using DOM scraping fallback...');
            updatePopupStatus("No YouTube API key. Scraping comments from page...", false, true);
            comments = await fetchCommentsViaDOM(videoId);
            fetchMethod = 'dom';
        }
    } catch (apiError) {
        // API failed — try DOM fallback
        console.warn('YouTube API comment fetch failed, trying DOM fallback:', apiError);
        updatePopupStatus("API failed. Scraping comments from page...", false, true);
        try {
            comments = await fetchCommentsViaDOM(videoId);
            fetchMethod = 'dom';
        } catch (domError) {
            console.error('DOM comment scraping also failed:', domError);
            throw new Error(`Could not fetch comments. API error: ${apiError.message}. DOM scraping error: ${domError.message || domError}`);
        }
    }

    try {
        if (comments.length === 0) {
            throw new Error("No comments found. Comments may be disabled for this video.");
        }

        console.log(`Comment fetching complete (${fetchMethod}). Total comments: ${comments.length}`);
        updatePopupStatus(`Analyzing ${comments.length} comments...`, false, true, 25, 'comments');

        // Stream-process: analyze each batch immediately to reduce peak memory
        const analysis = {
            totalFetched: comments.length,
            totalAnalyzed: 0,
            fetchMethod: fetchMethod,
            sentiment: { positive: 0, negative: 0, neutral: 0 },
            themes: [],
            sampleComments: comments.slice(0, 5)
        };

        const totalBatches = Math.ceil(comments.length / BATCH_SIZE);
        for (let i = 0; i < comments.length; i += BATCH_SIZE) {
            const batch = comments.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;

            console.log(`Analyzing batch ${batchNum}/${totalBatches} (${batch.length} comments)`);
            const batchResult = await analyzeCommentBatch(batch);

            analysis.sentiment.positive += batchResult.positive || 0;
            analysis.sentiment.negative += batchResult.negative || 0;
            analysis.sentiment.neutral += batchResult.neutral || 0;
            if (batchResult.themes) {
                analysis.themes.push(...batchResult.themes);
            }
            analysis.totalAnalyzed += batch.length;

            const progress = Math.round((batchNum / totalBatches) * 100);
            updateProgressStatus('comments', progress);

            // Yield to event loop between batches
            if (batchNum % 4 === 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Deduplicate themes
        analysis.themes = [...new Set(analysis.themes)];

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

    const parts = ["=== MULTI-LANGUAGE TRANSCRIPT ===\n\n"];

    for (const [langCode, langData] of Object.entries(allCaptions)) {
        const languageName = getLanguageName(langCode);
        const typeInfo = langData.isAutoTranslated ? ' (Auto-translated)' :
                        langData.kind === 'asr' ? ' (Auto-generated)' : '';

        parts.push(`--- ${languageName} (${langCode.toUpperCase()})${typeInfo} ---\n`);
        parts.push(convertSRTToTranscript(langData.content));
        parts.push("\n\n");
    }

    return parts.join('');
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
                // First try player-data caption extraction (more robust across Chrome/Brave UI variants).
                const playerDataResult = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: extractTranscriptFromPlayerData,
                    args: [PREFERRED_LANGUAGES, FETCH_ALL_LANGUAGES]
                });

                if (playerDataResult && playerDataResult[0] && playerDataResult[0].result) {
                    resolve(playerDataResult[0].result);
                    return;
                }

                // Fall back to UI-driven extraction.
                const uiResult = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: extractTranscriptFromPage,
                });
                
                if (uiResult && uiResult[0] && uiResult[0].result) {
                    resolve(uiResult[0].result);
                } else {
                    reject(new Error("Could not extract transcript from page"));
                }
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Extract transcript directly from YouTube player response caption tracks.
// This avoids brittle UI selectors and works better across browser variants (e.g. Brave).
function extractTranscriptFromPlayerData(preferredLanguages = ['en'], fetchAllLanguages = false) {
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatSrtTime(totalSeconds) {
        const ms = Math.round((totalSeconds % 1) * 1000);
        const total = Math.floor(totalSeconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }

    function srtToTranscript(srtContent) {
        const entries = srtContent.split('\n\n').filter(entry => entry.trim());
        const lines = [];

        for (const entry of entries) {
            const parts = entry.split('\n');
            if (parts.length < 3) continue;
            const timeLine = parts[1] || '';
            const text = parts.slice(2).join(' ').trim();
            const match = timeLine.match(/^(\d{2}:\d{2}:\d{2},\d{3})\s+-->/);
            if (match && text) {
                lines.push(`[${match[1]}] ${text}`);
            }
        }

        return lines.join('\n');
    }

    function createCombinedTranscript(languageData) {
        const langs = Object.keys(languageData);
        if (langs.length === 1) {
            return srtToTranscript(languageData[langs[0]].content);
        }

        const parts = ['=== MULTI-LANGUAGE TRANSCRIPT ===\n\n'];
        for (const lang of langs) {
            const item = languageData[lang];
            parts.push(`--- ${(item.name || lang).toString()} (${lang.toUpperCase()}) ---\n`);
            parts.push(srtToTranscript(item.content));
            parts.push('\n\n');
        }
        return parts.join('');
    }

    function xmlToSrt(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const textNodes = Array.from(xmlDoc.getElementsByTagName('text'));

        const chunks = [];
        for (let i = 0; i < textNodes.length; i += 1) {
            const node = textNodes[i];
            const start = parseFloat(node.getAttribute('start') || '0');
            const dur = parseFloat(node.getAttribute('dur') || '2');
            const end = start + (Number.isFinite(dur) ? dur : 2);
            const rawText = (node.textContent || '').replace(/\s+/g, ' ').trim();

            if (!rawText) continue;

            chunks.push([
                String(chunks.length + 1),
                `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
                escapeHtml(rawText)
            ].join('\n'));
        }

        return chunks.join('\n\n');
    }

    function parsePlayerResponse() {
        const direct = window.ytInitialPlayerResponse;
        if (direct && typeof direct === 'object') {
            return direct;
        }

        try {
            const raw = window.ytplayer?.config?.args?.player_response;
            if (raw) return JSON.parse(raw);
        } catch (_) {
            // Ignore and continue.
        }

        return null;
    }

    function pickTracks(captionTracks) {
        if (!Array.isArray(captionTracks) || captionTracks.length === 0) return [];

        if (fetchAllLanguages) {
            return captionTracks;
        }

        const selected = [];
        const used = new Set();

        for (const wanted of preferredLanguages || []) {
            const wantedLc = String(wanted || '').toLowerCase();
            const found = captionTracks.find(track => {
                const code = String(track.languageCode || '').toLowerCase();
                return code === wantedLc || code.startsWith(`${wantedLc}-`);
            });

            if (found && !used.has(found.baseUrl)) {
                selected.push(found);
                used.add(found.baseUrl);
            }
        }

        if (selected.length > 0) {
            return selected;
        }

        return [captionTracks[0]];
    }

    return new Promise(async (resolve, reject) => {
        try {
            const playerResponse = parsePlayerResponse();
            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

            if (!captionTracks.length) {
                reject('No caption tracks found in player data');
                return;
            }

            const tracks = pickTracks(captionTracks);
            const languageData = {};
            const fetchErrors = [];

            for (const track of tracks) {
                const langCode = track.languageCode || 'unknown';
                try {
                    const url = track.baseUrl.includes('fmt=') ? track.baseUrl : `${track.baseUrl}&fmt=srv3`;
                    const response = await fetch(url, { credentials: 'include' });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const xmlText = await response.text();
                    const srt = xmlToSrt(xmlText);
                    if (!srt) {
                        throw new Error('Empty caption response');
                    }

                    languageData[langCode] = {
                        code: langCode,
                        name: track.name?.simpleText || langCode,
                        kind: track.kind || null,
                        audioTrackType: track.audioTrackType || null,
                        content: srt,
                        isAutoTranslated: !!track.isTranslatable && !!track.vssId && String(track.vssId).includes('.tlang.')
                    };
                } catch (error) {
                    fetchErrors.push({
                        language: langCode,
                        error: error?.message || String(error)
                    });
                }
            }

            const languages = Object.keys(languageData);
            if (!languages.length) {
                reject(fetchErrors[0]?.error || 'Unable to load captions from player data');
                return;
            }

            if (fetchAllLanguages || languages.length > 1) {
                resolve({
                    type: 'multi-language',
                    languages,
                    languageData,
                    primaryLanguage: languages[0],
                    combinedTranscript: createCombinedTranscript(languageData),
                    metadata: {
                        availableLanguages: captionTracks.map(track => track.languageCode).filter(Boolean),
                        missingLanguages: [],
                        fetchErrors,
                        totalTracksFound: captionTracks.length,
                        totalTracksFetched: languages.length,
                        extractionMethod: 'player-data'
                    }
                });
                return;
            }

            resolve(srtToTranscript(languageData[languages[0]].content));
        } catch (error) {
            reject(error?.message || String(error));
        }
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
        const hasInvalidMultiLangShape = cachedTranscript &&
            typeof cachedTranscript === 'object' &&
            cachedTranscript.type === 'multi-language' &&
            (!cachedTranscript.languageData || Array.isArray(cachedTranscript.languageData));

        if (cachedTranscript && !hasInvalidMultiLangShape) {
            sendDataToPopup("displayTranscript", cachedTranscript);
            return true;
        }

        if (hasInvalidMultiLangShape) {
            console.warn('Ignoring malformed cached multi-language transcript payload and refetching.');
        }
        
        // If not in cache, fetch it
        fetchTranscriptFromPage(request.videoId)
            .then(transcript => {
                // Cache the transcript
                cacheTranscript(request.videoId, transcript);
                
                // Handle both multi-language and single-language transcripts
                if (transcript && typeof transcript === 'object' && transcript.type === 'multi-language') {
                    // Send the normalized multi-language transcript object as-is.
                    sendDataToPopup("displayTranscript", transcript);
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

        // Ensure provider/settings are up-to-date before cache routing.
        loadSettings().then(() => {
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
                return;
            }

            console.log('No cached analysis found, performing new analysis...');
            fetchAndAnalyzeComments(request.videoId)
                .then(result => {
                    console.log('Comment analysis completed:', result);
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
        }).catch(error => {
            chrome.runtime.sendMessage({
                action: "displayCommentAnalysis",
                error: `Failed to load settings: ${error.message}`
            });
        });
        return true;
    }
    
    if (request.action === "performRagAnalysis") {
        console.log('performRagAnalysis request received for video:', request.videoId, 'query:', request.query);

        // Ensure provider/settings are up-to-date before cache routing.
        loadSettings().then(() => {
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
                return;
            }

            console.log('No cached RAG analysis found, performing new analysis...');
            performRagAnalysis(request.videoId, request.query)
                .then(result => {
                    console.log('RAG analysis completed:', result);
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
        }).catch(error => {
            chrome.runtime.sendMessage({
                action: "displayRagAnalysis",
                error: `Failed to load settings: ${error.message}`
            });
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

// Periodic cache cleanup every 5 minutes
setInterval(() => {
    transcriptCache.evictExpired();
    commentAnalysisCache.evictExpired();
    ragAnalysisCache.evictExpired();
}, 5 * 60 * 1000);