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
        if (tabs[0]?.id && tabs[0]?.url?.includes("youtube.com/watch")) {
            const videoId = new URL(tabs[0].url).searchParams.get('v');
            currentVideoId = videoId;
            chrome.runtime.sendMessage({ 
                action: "getTranscript", 
                tabId: tabs[0].id,
                videoId: videoId 
            });
        } else {
            updateStatus("Not a YouTube video page or cannot access tab.", true);
            transcriptResultDiv.textContent = "Please navigate to a YouTube video page.";
            setProcessing(false);
        }
    });
});

commentsBtn.addEventListener('click', () => {
    if (isProcessing) return;
    setProcessing(true);
    updateStatus('Requesting comment analysis...');
    commentResultDiv.textContent = 'Processing...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0]?.url?.includes("youtube.com/watch")) {
            const videoId = new URL(tabs[0].url).searchParams.get('v');
            currentVideoId = videoId;
            chrome.runtime.sendMessage({ 
                action: "analyzeComments", 
                tabId: tabs[0].id,
                videoId: videoId 
            });
        } else {
            updateStatus("Not a YouTube video page or cannot access tab.", true);
            commentResultDiv.textContent = "Please navigate to a YouTube video page.";
            setProcessing(false);
        }
    });
});

ragBtn.addEventListener('click', () => {
    if (isProcessing) return;
    
    const query = ragQuery.value.trim();
    if (!query) {
        updateStatus("Please enter a question to analyze.", true);
        return;
    }
    
    setProcessing(true);
    updateStatus('Performing RAG analysis...');
    ragResultDiv.textContent = 'Processing...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0]?.url?.includes("youtube.com/watch")) {
            const videoId = new URL(tabs[0].url).searchParams.get('v');
            currentVideoId = videoId;
            
            chrome.runtime.sendMessage({ 
                action: "performRagAnalysis",
                tabId: tabs[0].id,
                videoId: videoId,
                query: query 
            });
        } else {
            updateStatus("Not a YouTube video page or cannot access tab.", true);
            ragResultDiv.textContent = "Please navigate to a YouTube video page.";
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
            displayFormattedTranscript(request.data);
            
            if (request.fromCache) {
                updateStatus('Transcript loaded from cache.');
            } else {
                updateStatus('Transcript processed.');
            }
        } else if (request.error) {
            transcriptResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error fetching transcript: ${request.error}`, true);
            displayManualTranscriptModal(currentVideoId, request.error); // Show manual entry modal on error
        }
    } else if (request.action === "displayCommentAnalysis") {
        setProcessing(false); // Comment analysis finished
        updateProgress('comments', 100); // Complete the progress
        
        if (request.data) {
            displayFormattedCommentAnalysis(request.data);
            
            if (request.data.fromCache) {
                updateStatus('Comment analysis loaded from cache.');
            } else {
                updateStatus('Comment analysis complete.');
            }
        } else if (request.error) {
            commentResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error analyzing comments: ${request.error}`, true);
        }
    } else if (request.action === "displayRagAnalysis") {
        setProcessing(false);
        updateProgress('rag', 100); // Complete the progress
        
        if (request.data) {
            displayFormattedRagAnalysis(request.data);
            
            if (request.data.fromCache) {
                updateStatus('RAG analysis loaded from cache.');
            } else {
                updateStatus('RAG analysis complete.');
            }
        } else if (request.error) {
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