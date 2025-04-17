// --- Globals ---
let YOUTUBE_API_KEY = null;
let GEMINI_API_KEY = null;

// --- Utility Functions ---

// Load API keys from storage
async function loadAPIKeys() {
    try {
        const keys = await chrome.storage.local.get(['youtubeApiKey', 'geminiApiKey']);
        YOUTUBE_API_KEY = keys.youtubeApiKey || null;
        GEMINI_API_KEY = keys.geminiApiKey || null;
        console.log("API keys loaded",
            YOUTUBE_API_KEY ? "YouTube: ✓" : "YouTube: ✗",
            GEMINI_API_KEY ? "Gemini: ✓" : "Gemini: ✗");
        return { youtubeKey: YOUTUBE_API_KEY, geminiKey: GEMINI_API_KEY };
    } catch (err) {
        console.error("Error loading API keys:", err);
        return { youtubeKey: null, geminiKey: null };
    }
}

// Send status updates to popup
function updatePopupStatus(message, isError = false, isProcessing = undefined) {
    const statusMessage = { action: "updateStatus", message: message, isError: isError };
    if (isProcessing !== undefined) {
        statusMessage.isProcessing = isProcessing;
    }
    chrome.runtime.sendMessage(statusMessage).catch(err => {/* Popup likely closed */ });
}

// Send data results to popup
function sendDataToPopup(action, data, error = null) {
    const message = { action: action };
    if (data) message.data = data;
    if (error) message.error = error;
    chrome.runtime.sendMessage(message).catch(err => {/* Popup likely closed */ });
}

// Helper to extract video ID from tab
async function getVideoIdFromTab(tabId) {
    try {
        const response = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: () => {
                const params = new URLSearchParams(window.location.search);
                return params.get('v');
            }
        });
        const videoId = response[0]?.result;
        if (!videoId) {
            throw new Error("Could not extract video ID from URL.");
        }
        return videoId;
    } catch (error) {
        console.error("Error injecting script or extracting video ID:", error);
        throw new Error(`Failed to get video ID: ${error.message}`);
    }
}

// --- Core Logic Functions ---

// Attempt to fetch transcript text by parsing page data (avoids OAuth)
async function fetchTranscriptFromPage(videoId, langPrefs = ['ta', 'en']) {
    updatePopupStatus("Attempting to fetch transcript data from page...", false, true);
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // Fetch the watch page HTML
        const response = await fetch(watchUrl, {
            headers: {
                // Try to mimic browser headers somewhat
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch watch page: ${response.statusText}`);
        }
        const html = await response.text();

        // Find the player response data (often in a script tag)
        // This regex is fragile and might need updating if YouTube changes structure
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
        if (!playerResponseMatch || !playerResponseMatch[1]) {
            console.log("Could not find ytInitialPlayerResponse in page HTML.");
            // Fallback to API list method
            return fetchAvailableTranscriptLangsAPI(videoId);
        }

        const playerResponse = JSON.parse(playerResponseMatch[1]);

        if (!playerResponse?.captions?.playerCaptionsTracklistRenderer) {
            console.log("No captions renderer found in player response.");
            return fetchAvailableTranscriptLangsAPI(videoId); // Fallback
        }

        const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        if (!tracks || tracks.length === 0) {
            console.log("No caption tracks found in player response.");
            return fetchAvailableTranscriptLangsAPI(videoId); // Fallback
        }

        console.log("Available tracks found in page data:", tracks.map(t => ({ lang: t.languageCode, kind: t.kind })));

        let bestTrackUrl = null;
        let foundLang = null;

        // Find the best matching track based on preferences
        for (const lang of langPrefs) {
            const track = tracks.find(t => t.languageCode === lang && !t.kind); // Prioritize non-ASR first if available
            if (track) {
                bestTrackUrl = track.baseUrl;
                foundLang = lang;
                break;
            }
            // Check ASR (auto-generated) if non-ASR not found for preferred lang
            const asrTrack = tracks.find(t => t.languageCode === lang && t.kind === 'asr');
            if (!bestTrackUrl && asrTrack) {
                bestTrackUrl = asrTrack.baseUrl;
                foundLang = lang + " (auto)";
            }
        }

        // If no preferred language found, take the first available track
        if (!bestTrackUrl && tracks.length > 0) {
            bestTrackUrl = tracks[0].baseUrl;
            foundLang = tracks[0].languageCode + (tracks[0].kind === 'asr' ? " (auto)" : "");
        }


        if (!bestTrackUrl) {
            throw new Error("Could not find a suitable caption track URL in page data.");
        }

        updatePopupStatus(`Fetching transcript content for language: ${foundLang}...`);

        // Fetch the actual transcript XML/timed text
        const transcriptResponse = await fetch(bestTrackUrl);
        if (!transcriptResponse.ok) {
            throw new Error(`Failed to fetch transcript content: ${transcriptResponse.statusText}`);
        }
        const transcriptXML = await transcriptResponse.text();

        // Simple XML parsing to extract text (could be improved with DOMParser)
        const lines = [];
        const textMatches = transcriptXML.match(/<text.*?>(.*?)<\/text>/gs);
        if (textMatches) {
            textMatches.forEach(match => {
                let text = match.replace(/<[^>]+>/g, ''); // Remove tags
                text = text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'"); // Decode HTML entities
                lines.push(text.trim());
            });
        }

        if (lines.length === 0) {
            throw new Error("Transcript content fetched but no text found after parsing.");
        }

        const fullTranscript = lines.join('\n');
        sendDataToPopup("displayTranscript", `Transcript (${foundLang}):\n--------------------\n${fullTranscript}`);
        return fullTranscript; // Success

    } catch (error) {
        console.error("Error fetching transcript from page:", error);
        updatePopupStatus(`Transcript fetch from page failed: ${error.message}. Trying API list fallback...`, true);
        // Fallback to API list method on any error during page parsing
        return fetchAvailableTranscriptLangsAPI(videoId);
    }
}

// Fallback: Use API key to list available languages (doesn't get text)
async function fetchAvailableTranscriptLangsAPI(videoId) {
    updatePopupStatus("Fetching available caption languages via API...");
    const { youtubeKey } = await loadAPIKeys();
    if (!youtubeKey) {
        throw new Error("YouTube API Key not set in options.");
    }

    try {
        const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${youtubeKey}`;
        const response = await fetch(captionsListUrl);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
        }
        const captionsData = await response.json();

        if (!captionsData.items || captionsData.items.length === 0) {
            throw new Error("No captions found via API for this video.");
        }

        const languages = captionsData.items.map(item => `${item.snippet.language} (${item.snippet.trackKind})`);
        const message = `Transcript text download requires OAuth or may be restricted.\nAvailable caption tracks found via API:\n- ${languages.join('\n- ')}`;
        sendDataToPopup("displayTranscript", message); // Send info message
        return message; // Return the info string

    } catch (error) {
        console.error("Error fetching transcript list via API:", error);
        const errorMsg = `Transcript check via API failed: ${error.message}`;
        // Don't throw here, just send the error message to the popup
        sendDataToPopup("displayTranscript", null, errorMsg);
        return null; // Indicate failure
    }
}


async function fetchAndAnalyzeComments(videoId, maxResults = 50) { // Limit results initially
    updatePopupStatus(`Fetching comments for video: ${videoId}...`, false, true);
    const { youtubeKey, geminiKey } = await loadAPIKeys();

    if (!youtubeKey) throw new Error("YouTube API Key not set in options.");
    if (!geminiKey) throw new Error("Gemini API Key not set in options.");

    let comments = [];
    let nextPageToken = null;
    let fetchedCount = 0;

    try {
        // Fetch comments using YouTube Data API with pagination
        do {
            let commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${Math.min(maxResults - fetchedCount, 100)}&key=${youtubeKey}&textFormat=plainText`; // Request plain text
            if (nextPageToken) {
                commentsUrl += `&pageToken=${nextPageToken}`;
            }

            updatePopupStatus(`Fetching comment page (fetched ${fetchedCount}/${maxResults})...`);
            const response = await fetch(commentsUrl);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
            }
            const commentsData = await response.json();

            if (commentsData.items) {
                const pageComments = commentsData.items.map(item => ({
                    id: item.id,
                    text: item.snippet?.topLevelComment?.snippet?.textOriginal || '', // Use textOriginal
                }));
                comments = comments.concat(pageComments);
                fetchedCount += pageComments.length;
            }

            nextPageToken = commentsData.nextPageToken;

        } while (nextPageToken && fetchedCount < maxResults);

        if (comments.length === 0) {
            sendDataToPopup("displayCommentAnalysis", { totalAnalyzed: 0, totalFetched: 0, sentiment: { positive: 0, negative: 0, neutral: 0 }, sampleAnalyzedComments: [] });
            updatePopupStatus("No comments found or fetched.", false, false);
            return;
        }

        updatePopupStatus(`Analyzing ${comments.length} comments using Gemini...`);

        // Prepare comments for Gemini batch analysis (if possible, else individually)
        // Gemini might handle multiple comments in one prompt better
        const batchSize = 10; // Adjust batch size as needed
        const analyzedComments = [];
        const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

        for (let i = 0; i < comments.length; i += batchSize) {
            const batch = comments.slice(i, i + batchSize);
            const promptText = `Analyze the sentiment (positive, negative, or neutral) for each of the following YouTube comments. Respond ONLY with a valid JSON array where each element is an object containing the original 'id' and the 'sentiment' classification. Do not include any other text or markdown formatting. Comments:\n${JSON.stringify(batch)}`;

            const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; // Use Flash for speed/cost
            const geminiResponse = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            if (!geminiResponse.ok) {
                console.error(`Gemini API error (${geminiResponse.status}) for comment batch ${i / batchSize + 1}`);
                // Skip this batch on error, maybe add placeholders later
                continue; // Move to next batch
            }

            const geminiResult = await geminiResponse.json();
            try {
                const responseText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                // Try to parse the expected JSON array directly
                const sentiments = JSON.parse(responseText);

                if (Array.isArray(sentiments)) {
                    sentiments.forEach(sentimentResult => {
                        const originalComment = batch.find(c => c.id === sentimentResult.id);
                        if (originalComment) {
                            const sentiment = (sentimentResult.sentiment || 'neutral').toLowerCase();
                            analyzedComments.push({ ...originalComment, sentiment: sentiment });
                            if (sentimentCounts[sentiment] !== undefined) {
                                sentimentCounts[sentiment]++;
                            } else {
                                sentimentCounts.neutral++; // Default to neutral if classification is unexpected
                            }
                        }
                    });
                } else {
                    console.warn("Gemini sentiment response was not a JSON array:", responseText);
                }

            } catch (parseError) {
                console.error("Failed to parse Gemini sentiment response:", parseError, "Response text:", geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text);
                // Could add basic keyword matching here as a fallback if parsing fails
                batch.forEach(comment => analyzedComments.push({ ...comment, sentiment: 'neutral' }));
                sentimentCounts.neutral += batch.length;
            }
        } // End batch loop


        const results = {
            totalFetched: fetchedCount,
            totalAnalyzed: analyzedComments.length,
            sentiment: sentimentCounts,
            sampleAnalyzedComments: analyzedComments // Send all analyzed back for now
        };

        sendDataToPopup("displayCommentAnalysis", results);
        updatePopupStatus(`Analyzed ${analyzedComments.length} comments.`, false, false);
        return results;

    } catch (error) {
        console.error("Error fetching/analyzing comments:", error);
        const errorMsg = `Comment analysis failed: ${error.message}`;
        sendDataToPopup("displayCommentAnalysis", null, errorMsg);
        updatePopupStatus(errorMsg, true, false);
        throw error; // Re-throw if needed upstream
    }
}

async function performFactCheck(textToFactCheck) {
    updatePopupStatus(`Fact-checking selected text...`, false, true);
    const { geminiKey } = await loadAPIKeys();
    if (!geminiKey) {
        throw new Error("Gemini API Key not set in options.");
    }

    try {
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiKey}`; // Use Pro for better reasoning
        // Refined prompt requesting specific JSON structure
        const prompt = {
            contents: [{
                parts: [{
                    text: `Please act as a neutral fact-checker. Analyze the following claim: "${textToFactCheck}"

              Respond ONLY with a single, valid JSON object containing the following fields:
              - "verdict": A string classification ("True", "False", "Partially True", "Misleading", "Unverifiable", "Opinion").
              - "confidence": A number between 0.0 (low confidence) and 1.0 (high confidence) in your verdict.
              - "explanation": A concise string explaining your reasoning (1-2 sentences).
              - "sources": An array of strings, listing URL(s) or credible references supporting your conclusion. If unverifiable or opinion, the array can be empty or contain a note.

              Do not include any introductory text, concluding remarks, or markdown formatting like \`\`\`json ... \`\`\` around the JSON object.`
                }]
            }],
            // Optional: Add safety settings if needed
            //"safetySettings": [ ... ],
            "generationConfig": {
                "responseMimeType": "application/json" // Explicitly request JSON if API supports it directly
            }
        };


        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prompt)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
            throw new Error(`Gemini API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
        }

        // Since we requested JSON directly, parse it
        const geminiResult = await response.json();

        // Extract content, assuming the structure { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
        // OR if responseMimeType worked, it might be directly in the candidate
        let parsedResult;
        if (geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text) {
            // Try parsing the text part if JSON mime type wasn't fully respected
            try {
                parsedResult = JSON.parse(geminiResult.candidates[0].content.parts[0].text);
            } catch (e) {
                console.error("Failed to parse JSON from text part:", e);
                throw new Error("Fact-check response from Gemini was not valid JSON.");
            }
        } else if (typeof geminiResult?.candidates?.[0]?.content === 'object') {
            // If the content itself is the object (due to mime type request)
            parsedResult = geminiResult.candidates[0].content; // Adjust based on actual API response structure if mime type works
        } else {
            throw new Error("Could not find parsable content in Gemini fact-check response.");
        }


        // Validate expected fields (optional but good practice)
        const formattedResult = {
            verdict: parsedResult.verdict || "Unknown",
            confidence: parsedResult.confidence !== undefined ? parsedResult.confidence : null,
            explanation: parsedResult.explanation || "No explanation provided.",
            sources: Array.isArray(parsedResult.sources) ? parsedResult.sources : []
        };

        sendDataToPopup("displayFactCheck", formattedResult);
        updatePopupStatus('Fact-check complete.', false, false);
        return formattedResult;

    } catch (error) {
        console.error("Error during fact-check:", error);
        const errorMsg = `Fact-check failed: ${error.message}`;
        sendDataToPopup("displayFactCheck", null, errorMsg);
        updatePopupStatus(errorMsg, true, false);
        throw error;
    }
}

// --- Event Listeners ---

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received message:", request);
    let isAsync = false; // Flag to indicate if we need to return true

    if (request.action === "getTranscript" && request.tabId) {
        isAsync = true; // We will handle this asynchronously
        (async () => {
            try {
                updatePopupStatus("Getting video details...", false, true);
                const videoId = await getVideoIdFromTab(request.tabId);
                console.log("Extracted Video ID:", videoId);
                // Attempt fetch from page first, fallback to API list if needed
                await fetchTranscriptFromPage(videoId);
                // Status/data sent within fetchTranscriptFromPage or fetchAvailableTranscriptLangsAPI
            } catch (error) {
                // Errors handled and sent to popup within the functions or getVideoIdFromTab
                console.error("Error in getTranscript flow:", error);
                updatePopupStatus(`Transcript Error: ${error.message}`, true, false);
                sendDataToPopup("displayTranscript", null, `Error: ${error.message}`); // Ensure error is displayed
            }
        })();

    } else if (request.action === "analyzeComments" && request.tabId) {
        isAsync = true;
        (async () => {
            try {
                updatePopupStatus("Getting video details for comments...", false, true);
                const videoId = await getVideoIdFromTab(request.tabId);
                console.log("Extracted Video ID for comments:", videoId);
                await fetchAndAnalyzeComments(videoId);
                // Status/data sent within fetchAndAnalyzeComments
            } catch (error) {
                // Errors handled and sent to popup within the function
                console.error("Error in analyzeComments flow:", error);
                updatePopupStatus(`Comments Error: ${error.message}`, true, false);
                sendDataToPopup("displayCommentAnalysis", null, `Error: ${error.message}`); // Ensure error is displayed
            }
        })();

    } else if (request.action === "factCheckSelection" && request.text) {
        isAsync = true;
        (async () => {
            try {
                await performFactCheck(request.text);
                // Status/data sent within performFactCheck
            } catch (error) {
                // Errors handled and sent to popup within the function
                console.error("Error in factCheckSelection flow:", error);
                updatePopupStatus(`Fact-check Error: ${error.message}`, true, false);
                // No need to send error data again here, performFactCheck does it
            }
        })();
    }
    // NOTE: No 'saveAPIKeys' handler needed here, options.js handles saving directly to storage.

    return isAsync; // Return true if any async operation was started
});


// --- Context Menu Setup ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "factCheckSelectedText",
        title: "Fact-Check Selection",
        contexts: ["selection"] // Show only when text is selected
    });
    console.log("Fact-Check context menu created.");

    // Load keys once on startup/install just to check they exist
    loadAPIKeys().then(({ youtubeKey, geminiKey }) => {
        if (!youtubeKey || !geminiKey) {
            console.warn("One or more API keys are missing. Please set them in the extension options.");
            // Maybe open options page automatically on first install?
            // chrome.runtime.openOptionsPage();
        }
    });
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "factCheckSelectedText" && info.selectionText) {
        if (info.selectionText.length > 500) { // Add a length limit for fact-checking
            updatePopupStatus("Selected text too long for fact-checking (max 500 chars).", true, false);
            sendDataToPopup("displayFactCheck", null, "Selected text too long (max 500 chars).");
            return;
        }
        console.log("Fact-check requested for:", info.selectionText);
        updatePopupStatus("Starting fact-check...", false, true); // Update status immediately
        // Send to our own background script handler
        chrome.runtime.sendMessage({
            action: "factCheckSelection",
            text: info.selectionText.trim()
        }).catch(err => console.error("Error sending fact-check message:", err));
    }
});

console.log("Background service worker started/restarted.");