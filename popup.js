const transcriptBtn = document.getElementById('getTranscriptBtn');
const commentsBtn = document.getElementById('analyzeCommentsBtn');
const ragBtn = document.getElementById('analyzeWithRagBtn');
const ragQuery = document.getElementById('ragQuery');
const transcriptResultDiv = document.getElementById('transcriptResult');
const commentResultDiv = document.getElementById('commentResult');
const ragResultDiv = document.getElementById('ragResult');
const factCheckResultDiv = document.getElementById('factCheckResult');
const statusDiv = document.getElementById('status');
const processingIndicator = document.getElementById('processing-indicator');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

let isProcessing = false;
let currentVideoId = '';
let transcriptData = null;

// Tab switching functionality
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Show corresponding content
        const tabId = button.id.replace('tab-', 'tab-content-');
        document.getElementById(tabId).classList.add('active');
    });
});

function setProcessing(processing) {
    isProcessing = processing;
    processingIndicator.style.display = processing ? 'block' : 'none';
    transcriptBtn.disabled = processing;
    commentsBtn.disabled = processing;
    ragBtn.disabled = processing;
    
    // Reset progress bars when starting or ending
    if (!processing) {
        document.querySelectorAll('.progress-bar').forEach(bar => {
            bar.style.width = '0%';
        });
    }
}

function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'red' : '#333'; // Use a default dark color for non-errors
    console.log("Status:", message);
    if (isError) {
        setProcessing(false); // Stop processing on error
    }
}

function displayFormattedTranscript(transcriptText) {
    // Simple text display for now
    transcriptResultDiv.textContent = transcriptText;
}

function displayFormattedCommentAnalysis(analysisData) {
    let html = `<strong>Total Comments Analyzed:</strong> ${analysisData.totalAnalyzed}<br>`;
    if (analysisData.totalFetched !== analysisData.totalAnalyzed) {
        html += `(Fetched ${analysisData.totalFetched}, analyzed subset)<br>`;
    }
    html += `<strong>Sentiment:</strong><br>`;
    html += `  Positive: ${analysisData.sentiment.positive}<br>`;
    html += `  Negative: ${analysisData.sentiment.negative}<br>`;
    html += `  Neutral: ${analysisData.sentiment.neutral}<br>`;

    if (analysisData.sampleAnalyzedComments && analysisData.sampleAnalyzedComments.length > 0) {
        html += `<br><strong>Sample Comments:</strong><br>`;
        analysisData.sampleAnalyzedComments.slice(0, 5).forEach(c => { // Show first 5
            let sentimentEmoji = '😐';
            if (c.sentiment === 'positive') sentimentEmoji = '😊';
            else if (c.sentiment === 'negative') sentimentEmoji = '😞';
            html += `<div style="font-size: 0.9em; margin-bottom: 3px; border-bottom: 1px solid #eee; padding-bottom: 2px;">${sentimentEmoji} (${c.sentiment}): ${c.text.substring(0, 100)}${c.text.length > 100 ? '...' : ''}</div>`;
        });
    }
    commentResultDiv.innerHTML = html;
}

function displayFormattedFactCheck(factCheckData) {
    let html = `<strong>Verdict:</strong> ${factCheckData.verdict || 'Unknown'}<br>`;
    if (factCheckData.confidence !== undefined && factCheckData.confidence !== null) {
        html += `<strong>Confidence:</strong> ${(factCheckData.confidence * 100).toFixed(0)}%<br>`;
    }
    if (factCheckData.explanation) {
        html += `<strong>Explanation:</strong> ${factCheckData.explanation}<br>`;
    }
    if (factCheckData.sources && factCheckData.sources.length > 0 && factCheckData.sources[0] !== "No specific sources provided") {
        html += `<strong>Sources:</strong><ul>`;
        factCheckData.sources.forEach(source => {
            try {
                // Try creating a clickable link
                const url = new URL(source.startsWith('http') ? source : `http://${source}`);
                html += `<li><a href="${url.href}" target="_blank">${url.hostname}</a></li>`;
            } catch (_) {
                // If it's not a valid URL, just display the text
                html += `<li>${source}</li>`;
            }
        });
        html += `</ul>`;
    } else {
        html += `<strong>Sources:</strong> Not provided or unable to extract.<br>`;
    }
    factCheckResultDiv.innerHTML = html;
}

function displayFormattedRagAnalysis(ragData) {
    let providerName = ragData.provider ? ragData.provider.charAt(0).toUpperCase() + ragData.provider.slice(1) : 'API';
    
    let html = `<div class="rag-answer">${ragData.answer}</div>`;
    
    if (ragData.sources && ragData.sources.length > 0) {
        html += `<div class="rag-sources"><strong>Sources from transcript:</strong><ul>`;
        ragData.sources.forEach(source => {
            html += `<li>${source}</li>`;
        });
        html += `</ul></div>`;
    }
    
    // Add info about the API provider used
    html += `<div class="api-provider-info">Generated using ${providerName}</div>`;
    
    ragResultDiv.innerHTML = html;
}

function displayMultiLanguageTranscript(multiLangData) {
    let html = `<div class="multi-language-transcript">`;
    
    // Language availability information
    html += `<div class="language-info">`;
    html += `<strong>Available Languages (${multiLangData.languages.length}):</strong> `;
    html += multiLangData.languages.map(lang => {
        const langData = multiLangData.languageData[lang];
        const languageName = getLanguageName(lang);
        const typeIndicator = langData.isAutoTranslated ? '📝' : 
                            langData.kind === 'asr' ? '🤖' : '👤';
        return `<span class="language-tag" title="${languageName} ${getLanguageTypeDescription(langData)}">${typeIndicator} ${lang.toUpperCase()}</span>`;
    }).join(' ');
    html += `</div>`;
    
    // Warning/info about missing languages
    if (multiLangData.metadata && multiLangData.metadata.missingLanguages.length > 0) {
        html += `<div class="language-warning">`;
        const missingLangs = multiLangData.metadata.missingLanguages;
        const limitedSupportLangs = multiLangData.metadata.limitedSupportLanguages || [];
        
        if (limitedSupportLangs.length > 0) {
            const langNames = limitedSupportLangs.map(lang => getLanguageName(lang)).join(', ');
            html += `<div class="warning limited-support">`;
            html += `⚠️ <strong>Limited Caption Support:</strong> ${langNames} may not have auto-generated captions available. `;
            html += `<button class="help-button" onclick="showLanguageSupportInfo()">Learn More</button>`;
            html += `</div>`;
        }
        
        const otherMissing = missingLangs.filter(lang => !limitedSupportLangs.includes(lang));
        if (otherMissing.length > 0) {
            const langNames = otherMissing.map(lang => getLanguageName(lang)).join(', ');
            html += `<div class="warning">`;
            html += `📋 <strong>Unavailable:</strong> ${langNames} - No captions found for this video.`;
            html += `</div>`;
        }
        
        if (multiLangData.metadata.availableLanguages.length > multiLangData.languages.length) {
            html += `<div class="info">`;
            html += `💡 <strong>Tip:</strong> This video has additional languages available. `;
            html += `<button class="help-button" onclick="showAllAvailableLanguages('${JSON.stringify(multiLangData.metadata.availableLanguages).replace(/"/g, '&quot;')}')">Show All</button>`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    
    // Fetch errors information
    if (multiLangData.metadata && multiLangData.metadata.fetchErrors.length > 0) {
        html += `<div class="language-errors">`;
        html += `<div class="error-summary">`;
        html += `⚠️ <strong>Fetch Issues:</strong> Some languages couldn't be loaded. `;
        html += `<button class="help-button" onclick="showFetchErrors('${JSON.stringify(multiLangData.metadata.fetchErrors).replace(/"/g, '&quot;')}')">Details</button>`;
        html += `</div>`;
        html += `</div>`;
    }
    
    // Language selector tabs
    html += `<div class="language-tabs">`;
    html += `<button class="lang-tab active" data-lang="combined">Combined View</button>`;
    multiLangData.languages.forEach(lang => {
        const langData = multiLangData.languageData[lang];
        const languageName = getLanguageName(lang);
        const displayName = languageName !== lang.toUpperCase() ? languageName : (langData.name || lang.toUpperCase());
        const typeIndicator = langData.isAutoTranslated ? ' 📝' : 
                            langData.kind === 'asr' ? ' 🤖' : ' 👤';
        html += `<button class="lang-tab" data-lang="${lang}" title="${getLanguageTypeDescription(langData)}">${displayName}${typeIndicator}</button>`;
    });
    html += `</div>`;
    
    // Combined transcript view (default)
    html += `<div class="transcript-content active" data-content="combined">`;
    html += `<pre>${multiLangData.combinedTranscript}</pre>`;
    html += `</div>`;
    
    // Individual language views
    multiLangData.languages.forEach(lang => {
        const langData = multiLangData.languageData[lang];
        const languageName = getLanguageName(lang);
        html += `<div class="transcript-content" data-content="${lang}">`;
        html += `<div class="language-meta">`;
        html += `<strong>Language:</strong> ${languageName} (${lang.toUpperCase()})<br>`;
        html += `<strong>Type:</strong> ${getLanguageTypeDescription(langData)}<br>`;
        if (langData.kind) html += `<strong>Track Kind:</strong> ${langData.kind}<br>`;
        if (langData.audioTrackType) html += `<strong>Audio Track:</strong> ${langData.audioTrackType}<br>`;
        html += `</div>`;
        html += `<pre>${convertSRTToTranscript(langData.content)}</pre>`;
        html += `</div>`;
    });
    
    html += `</div>`;
    
    transcriptResultDiv.innerHTML = html;
    
    // Add event listeners for language tabs
    setupLanguageTabSwitching();
}

// Helper function to convert SRT to readable transcript (client-side)
function convertSRTToTranscript(srtContent) {
    const entries = srtContent.split('\n\n').filter(entry => entry.trim());
    const parsedCaptions = [];
    
    for (const entry of entries) {
        const lines = entry.split('\n');
        if (lines.length >= 3) {
            const timestamp = lines[1].trim();
            const text = lines.slice(2).join(' ').trim();
            
            // Extract start time
            const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2},\d{3})/);
            const startTime = timeMatch ? timeMatch[1] : null;
            
            if (startTime && text) {
                parsedCaptions.push(`[${startTime}] ${text}`);
            }
        }
    }
    
    return parsedCaptions.join('\n');
}

function setupLanguageTabSwitching() {
    const tabs = document.querySelectorAll('.lang-tab');
    const contents = document.querySelectorAll('.transcript-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const targetLang = tab.dataset.lang;
            const targetContent = document.querySelector(`[data-content="${targetLang}"]`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

function displayManualTranscriptModal(videoId, errorMessage = null) {
    // Create the modal container
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const modalHeader = document.createElement('h3');
    modalHeader.textContent = 'Manual Transcript Entry';
    
    const modalClose = document.createElement('button');
    modalClose.className = 'modal-close';
    modalClose.textContent = '×';
    modalClose.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    const modalMessage = document.createElement('p');
    if (errorMessage) {
        modalMessage.innerHTML = `<span class="error">${errorMessage}</span><br>Please paste the video transcript below:`;
    } else {
        modalMessage.textContent = 'Please paste the video transcript below:';
    }
    
    const textArea = document.createElement('textarea');
    textArea.className = 'manual-transcript';
    textArea.placeholder = 'Paste YouTube transcript here...';
    textArea.rows = 10;
    
    const helpText = document.createElement('p');
    helpText.className = 'modal-help';
    helpText.textContent = 'Tip: Open YouTube transcript panel, select all (Ctrl+A), copy (Ctrl+C), then paste here.';
    
    const submitButton = document.createElement('button');
    submitButton.className = 'modal-submit';
    submitButton.textContent = 'Use This Transcript';
    submitButton.addEventListener('click', () => {
        const transcript = textArea.value.trim();
        if (!transcript) {
            alert('Please paste a transcript before submitting.');
            return;
        }
        
        // Save as default transcript if checkbox is checked
        if (saveAsDefaultCheckbox.checked) {
            chrome.storage.local.set({ defaultTranscript: transcript });
        }
        
        // Send the transcript to background
        chrome.runtime.sendMessage({
            action: "useManualTranscript",
            videoId: videoId,
            transcript: transcript
        });
        
        // Close the modal
        document.body.removeChild(modalOverlay);
    });
    
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    const saveAsDefaultCheckbox = document.createElement('input');
    saveAsDefaultCheckbox.type = 'checkbox';
    saveAsDefaultCheckbox.id = 'saveAsDefault';
    
    const saveAsDefaultLabel = document.createElement('label');
    saveAsDefaultLabel.htmlFor = 'saveAsDefault';
    saveAsDefaultLabel.textContent = 'Save as default transcript for manual mode';
    
    checkboxContainer.appendChild(saveAsDefaultCheckbox);
    checkboxContainer.appendChild(saveAsDefaultLabel);
    
    // Assemble the modal
    modalContent.appendChild(modalClose);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalMessage);
    modalContent.appendChild(textArea);
    modalContent.appendChild(helpText);
    modalContent.appendChild(checkboxContainer);
    modalContent.appendChild(submitButton);
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
}

// Add more CSS for the manual transcript modal
const style = document.createElement('style');
style.textContent = `
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background-color: white;
    padding: 20px;
    border-radius: 5px;
    width: 90%;
    max-width: 500px;
    max-height: 90%;
    overflow-y: auto;
    position: relative;
}

.modal-close {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 5px;
}

.manual-transcript {
    width: 100%;
    margin: 10px 0;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
}

.modal-help {
    font-size: 12px;
    color: #666;
    margin-bottom: 15px;
}

.modal-submit {
    width: 100%;
    margin-top: 10px;
}

.checkbox-container {
    margin: 10px 0;
}

.error {
    color: #c62828;
    font-weight: bold;
}
`;
document.head.appendChild(style);

// --- Button Listeners ---

transcriptBtn.addEventListener('click', () => {
    if (isProcessing) return;
    setProcessing(true);
    updateStatus('Requesting transcript...');
    transcriptResultDiv.textContent = 'Processing...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0]?.url && isYouTubeVideoUrl(tabs[0].url)) {
            const videoId = extractVideoId(tabs[0].url);
            currentVideoId = videoId;
            chrome.runtime.sendMessage({ 
                action: "getTranscript", 
                tabId: tabs[0].id,
                videoId: videoId 
            });
        } else {
            updateStatus("Not a YouTube video or Short page or cannot access tab.", true);
            transcriptResultDiv.textContent = "Please navigate to a YouTube video or Short page.";
            setProcessing(false);
        }
    });
});

commentsBtn.addEventListener('click', () => {
    console.log('Comment analysis button clicked');
    if (isProcessing) {
        console.log('Already processing, ignoring click');
        return;
    }
    setProcessing(true);
    updateStatus('Requesting comment analysis...');
    commentResultDiv.textContent = 'Processing...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log('Tabs query result:', tabs);
        if (tabs[0]?.id && tabs[0]?.url && isYouTubeVideoUrl(tabs[0].url)) {
            const videoId = extractVideoId(tabs[0].url);
            console.log('Video ID extracted:', videoId);
            currentVideoId = videoId;
            console.log('Sending analyzeComments message to background');
            chrome.runtime.sendMessage({ 
                action: "analyzeComments", 
                tabId: tabs[0].id,
                videoId: videoId 
            });
        } else {
            console.log('Not on YouTube video or Short page');
            updateStatus("Not a YouTube video or Short page or cannot access tab.", true);
            commentResultDiv.textContent = "Please navigate to a YouTube video or Short page.";
            setProcessing(false);
        }
    });
});

ragBtn.addEventListener('click', () => {
    console.log('RAG analysis button clicked');
    if (isProcessing) {
        console.log('Already processing, ignoring click');
        return;
    }
    
    const query = ragQuery.value.trim();
    if (!query) {
        console.log('No query entered');
        updateStatus("Please enter a question to analyze.", true);
        return;
    }
    
    console.log('RAG query:', query);
    setProcessing(true);
    updateStatus('Performing RAG analysis...');
    ragResultDiv.textContent = 'Processing...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log('RAG tabs query result:', tabs);
        if (tabs[0]?.id && tabs[0]?.url && isYouTubeVideoUrl(tabs[0].url)) {
            const videoId = extractVideoId(tabs[0].url);
            console.log('RAG Video ID extracted:', videoId);
            currentVideoId = videoId;
            
            console.log('Sending performRagAnalysis message to background');
            chrome.runtime.sendMessage({ 
                action: "performRagAnalysis",
                tabId: tabs[0].id,
                videoId: videoId,
                query: query 
            });
        } else {
            console.log('Not on YouTube video or Short page for RAG');
            updateStatus("Not a YouTube video or Short page or cannot access tab.", true);
            ragResultDiv.textContent = "Please navigate to a YouTube video or Short page.";
            setProcessing(false);
        }
    });
});

// --- Listener for results/status from background script ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Popup received message:", request);

    if (request.action === "updateStatus") {
        updateStatus(request.message, request.isError || false);
        if (request.isProcessing !== undefined) {
            setProcessing(request.isProcessing);
        }
        // Update progress if provided
        if (request.progress && request.progressType) {
            updateProgress(request.progressType, request.progress);
        }
    } else if (request.action === "updateProgress") {
        updateProgress(request.type, request.progress);
    } else if (request.action === "displayTranscript") {
        setProcessing(false); // Transcript process finished
        updateProgress('transcript', 100); // Complete the progress
        
        if (request.data) {
            transcriptData = request.data; // Store transcript for RAG
            
            // Handle multi-language transcripts
            if (request.data.type === 'multi-language') {
                displayMultiLanguageTranscript(request.data);
                
                // Enhanced status message with language info
                let statusMessage = `Multi-language transcript processed (${request.data.languages.length} languages).`;
                if (request.data.metadata) {
                    const meta = request.data.metadata;
                    
                    // Show extraction method
                    if (meta.extractionMethod === 'browser-player') {
                        statusMessage += ` 🌐 Extracted from browser player.`;
                    } else if (meta.extractionMethod === 'browser-player-fallback') {
                        statusMessage += ` 🔄 Used browser player fallback.`;
                    }
                    
                    if (meta.missingLanguages.length > 0) {
                        const limitedSupport = meta.limitedSupportLanguages || [];
                        if (limitedSupport.length > 0) {
                            const langNames = limitedSupport.map(lang => getLanguageName(lang)).join(', ');
                            statusMessage += ` Note: ${langNames} may have limited caption support.`;
                        }
                        if (meta.missingLanguages.length > limitedSupport.length) {
                            statusMessage += ` Some preferred languages were not available.`;
                        }
                    }
                    if (meta.fetchErrors.length > 0) {
                        statusMessage += ` Some languages had fetch issues.`;
                    }
                }
                updateStatus(statusMessage);
            } else {
                // Single language transcript (backward compatibility)
                displayFormattedTranscript(request.data);
                updateStatus('Transcript processed.');
            }
            
            if (request.fromCache) {
                updateStatus('Transcript loaded from cache.');
            }
        } else if (request.error) {
            transcriptResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error fetching transcript: ${request.error}`, true);
            displayManualTranscriptModal(currentVideoId, request.error); // Show manual entry modal on error
        }
    } else if (request.action === "displayCommentAnalysis") {
        console.log('Received displayCommentAnalysis message:', request);
        setProcessing(false); // Comment analysis finished
        updateProgress('comments', 100); // Complete the progress
        
        if (request.data) {
            console.log('Displaying comment analysis data:', request.data);
            displayFormattedCommentAnalysis(request.data);
            
            if (request.data.fromCache) {
                updateStatus('Comment analysis loaded from cache.');
            } else {
                updateStatus('Comment analysis complete.');
            }
        } else if (request.error) {
            console.error('Comment analysis error:', request.error);
            commentResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error analyzing comments: ${request.error}`, true);
        }
    } else if (request.action === "displayRagAnalysis") {
        console.log('Received displayRagAnalysis message:', request);
        setProcessing(false);
        updateProgress('rag', 100); // Complete the progress
        
        if (request.data) {
            console.log('Displaying RAG analysis data:', request.data);
            displayFormattedRagAnalysis(request.data);
            
            if (request.data.fromCache) {
                updateStatus('RAG analysis loaded from cache.');
            } else {
                updateStatus('RAG analysis complete.');
            }
        } else if (request.error) {
            console.error('RAG analysis error:', request.error);
            ragResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error in RAG analysis: ${request.error}`, true);
        }
    } else if (request.action === "displayFactCheck") {
        setProcessing(false);
        
        if (request.data) {
            displayFormattedFactCheck(request.data);
            
            if (request.data.fromCache) {
                updateStatus('Fact-check loaded from cache.');
            } else {
                updateStatus('Fact-check complete.');
            }
        } else if (request.error) {
            factCheckResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Fact-check error: ${request.error}`, true);
        }
    } else if (request.action === "requestManualTranscript") {
        setProcessing(false);
        displayManualTranscriptModal(request.videoId, request.error);
    }
});

function updateProgress(tabName, percent) {
    const progressBar = document.querySelector(`#tab-content-${tabName} .progress-bar`);
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
}

// Function to export analysis results
function exportResults(type) {
    let data = null;
    let filename = '';
    
    switch(type) {
        case 'transcript':
            data = transcriptData;
            filename = `transcript_${currentVideoId}.txt`;
            break;
        case 'comments':
            // Get the comment data from the innerHTML
            const commentHTML = commentResultDiv.innerHTML;
            data = commentHTML;
            filename = `comment_analysis_${currentVideoId}.html`;
            break;
        case 'rag':
            // Get the RAG data from the innerHTML
            const ragHTML = ragResultDiv.innerHTML;
            data = ragHTML;
            filename = `rag_analysis_${currentVideoId}.html`;
            break;
    }
    
    if (!data) {
        alert('No data available to export');
        return;
    }
    
    // Create a blob and download link
    const blob = type === 'transcript' 
        ? new Blob([data], {type: 'text/plain'})
        : new Blob([`<html><head><style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .result { margin: 20px 0; padding: 10px; border: 1px solid #ddd; }
        </style></head><body><h2>YouTube Analysis Results</h2><div class="result">${data}</div></body></html>`], 
        {type: 'text/html'});
        
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Keep popup open
document.addEventListener('click', function() {
    // This prevents the popup from auto-closing
    window.setTimeout(function() {}, 1000);
});

// Initial status
updateStatus("Ready. Ensure API keys are set in options.");
setProcessing(false);

// Initial tab setup - ensure the first tab is active
document.getElementById('tab-transcript').click();

// --- Export Button Listeners ---

document.getElementById('exportTranscriptBtn').addEventListener('click', () => {
    exportResults('transcript');
});

document.getElementById('exportCommentsBtn').addEventListener('click', () => {
    exportResults('comments');
});

document.getElementById('exportRagBtn').addEventListener('click', () => {
    exportResults('rag');
});

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
    // Only process if not in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Ctrl+1, Ctrl+2, Ctrl+3 to switch tabs
    if (e.ctrlKey) {
        switch (e.key) {
            case '1':
                document.getElementById('tab-transcript').click();
                e.preventDefault();
                break;
            case '2':
                document.getElementById('tab-comments').click();
                e.preventDefault();
                break;
            case '3':
                document.getElementById('tab-rag').click();
                e.preventDefault();
                break;
        }
    }
    
    // Shortcuts without modifier keys
    switch (e.key) {
        case 't':
            // Press 't' to get transcript
            if (!isProcessing && document.getElementById('tab-content-transcript').classList.contains('active')) {
                transcriptBtn.click();
                e.preventDefault();
            }
            break;
        case 'c':
            // Press 'c' to analyze comments
            if (!isProcessing && document.getElementById('tab-content-comments').classList.contains('active')) {
                commentsBtn.click();
                e.preventDefault();
            }
            break;
        case 'r':
            // Press 'r' to focus on RAG query input
            if (document.getElementById('tab-content-rag').classList.contains('active')) {
                ragQuery.focus();
                e.preventDefault();
            }
            break;
    }
});

// Helper functions for language support

// Get language name from language code
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

// Get description of language track type
function getLanguageTypeDescription(langData) {
    if (langData.isAutoTranslated) {
        return 'Auto-translated from another language';
    } else if (langData.kind === 'asr') {
        return 'Auto-generated captions';
    } else {
        return 'Manually created/uploaded captions';
    }
}

// Show language support information modal
function showLanguageSupportInfo() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content language-support-modal">
            <div class="modal-header">
                <h3>🌐 Language Caption Support</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-body">
                <h4>Caption Types:</h4>
                <ul>
                    <li><strong>👤 Manual:</strong> Manually created/uploaded by video creator - highest quality</li>
                    <li><strong>🤖 Auto-generated:</strong> AI-generated captions - good for popular languages</li>
                    <li><strong>📝 Auto-translated:</strong> Machine-translated from another language - may have errors</li>
                </ul>
                
                <h4>Limited Support Languages:</h4>
                <p>Some languages (like Tamil, Telugu, Bengali, etc.) may not have auto-generated captions available because:</p>
                <ul>
                    <li>YouTube's automatic speech recognition has limited support for these languages</li>
                    <li>The video creator hasn't uploaded manual captions</li>
                    <li>Smaller speaker populations mean less training data for AI models</li>
                </ul>
                
                <h4>Alternatives:</h4>
                <ul>
                    <li><strong>Manual Mode:</strong> Use the manual transcript feature to enter text yourself</li>
                    <li><strong>Check for Manual Captions:</strong> Look for manually uploaded captions in your language</li>
                    <li><strong>Use English/Other Available Languages:</strong> Many videos have English captions even if native language captions aren't available</li>
                </ul>
            </div>
            <div class="modal-footer">
                <button class="btn secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Show all available languages
function showAllAvailableLanguages(availableLanguagesJson) {
    const availableLanguages = JSON.parse(availableLanguagesJson);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const languagesList = availableLanguages.map(lang => {
        const langName = getLanguageName(lang);
        return `<li><strong>${langName}</strong> (${lang})</li>`;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📋 All Available Languages</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p>This video has captions available in the following languages:</p>
                <ul class="available-languages-list">
                    ${languagesList}
                </ul>
                <p><em>To fetch different languages, update your preferred languages in the extension options.</em></p>
            </div>
            <div class="modal-footer">
                <button class="btn secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                <button class="btn primary" onclick="chrome.runtime.openOptionsPage(); this.parentElement.parentElement.parentElement.remove()">Open Options</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Show fetch errors details
function showFetchErrors(fetchErrorsJson) {
    const fetchErrors = JSON.parse(fetchErrorsJson);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const errorsList = fetchErrors.map(error => {
        const langName = getLanguageName(error.language);
        return `<li><strong>${langName}</strong> (${error.language}): ${error.error}</li>`;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>⚠️ Fetch Errors</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p>The following languages couldn't be loaded:</p>
                <ul class="fetch-errors-list">
                    ${errorsList}
                </ul>
                <p><em>These errors are usually due to API limitations or temporary issues.</em></p>
            </div>
            <div class="modal-footer">
                <button class="btn secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Utility function to extract video ID from YouTube URL (supports both standard and Shorts)
function extractVideoId(url) {
    if (!url) return null;
    
    try {
        const urlObj = new URL(url);
        
        // Check for standard YouTube video URL (/watch?v=)
        const videoParam = urlObj.searchParams.get('v');
        if (videoParam) {
            return videoParam;
        }
        
        // Check for YouTube Shorts URL (/shorts/)
        const shortsMatch = urlObj.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch) {
            return shortsMatch[1];
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting video ID from URL:', error);
        return null;
    }
}

// Check if URL is a YouTube video or Short
function isYouTubeVideoUrl(url) {
    if (!url) return false;
    return url.includes('youtube.com/watch') || url.includes('youtube.com/shorts/');
}