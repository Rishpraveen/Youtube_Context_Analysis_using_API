const transcriptBtn = document.getElementById('getTranscriptBtn');
const commentsBtn = document.getElementById('analyzeCommentsBtn');
const transcriptResultDiv = document.getElementById('transcriptResult');
const commentResultDiv = document.getElementById('commentResult');
const factCheckResultDiv = document.getElementById('factCheckResult');
const statusDiv = document.getElementById('status');
const processingIndicator = document.getElementById('processing-indicator');

let isProcessing = false;

function setProcessing(processing) {
    isProcessing = processing;
    processingIndicator.style.display = processing ? 'block' : 'none';
    transcriptBtn.disabled = processing;
    commentsBtn.disabled = processing;
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


// --- Button Listeners ---

transcriptBtn.addEventListener('click', () => {
    if (isProcessing) return;
    setProcessing(true);
    updateStatus('Requesting transcript...');
    transcriptResultDiv.textContent = 'Processing...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0]?.url?.includes("youtube.com/watch")) {
            chrome.runtime.sendMessage({ action: "getTranscript", tabId: tabs[0].id });
            // Response handling is now done via the listener below
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
            chrome.runtime.sendMessage({ action: "analyzeComments", tabId: tabs[0].id });
            // Response handling is now done via the listener below
        } else {
            updateStatus("Not a YouTube video page or cannot access tab.", true);
            commentResultDiv.textContent = "Please navigate to a YouTube video page.";
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
    } else if (request.action === "displayTranscript") {
        setProcessing(false); // Transcript process finished
        if (request.data) {
            displayFormattedTranscript(request.data);
            updateStatus('Transcript processed.');
        } else if (request.error) {
            transcriptResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error fetching transcript: ${request.error}`, true);
        }
    } else if (request.action === "displayCommentAnalysis") {
        setProcessing(false); // Comment analysis finished
        if (request.data) {
            displayFormattedCommentAnalysis(request.data);
            updateStatus('Comment analysis complete.');
        } else if (request.error) {
            commentResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Error analyzing comments: ${request.error}`, true);
        }
    } else if (request.action === "displayFactCheck") {
        setProcessing(false); // Fact check finished (assuming it was triggered)
        if (request.data) {
            displayFormattedFactCheck(request.data);
            updateStatus('Fact-check complete.');
        } else if (request.error) {
            factCheckResultDiv.textContent = `Error: ${request.error}`;
            updateStatus(`Fact-check error: ${request.error}`, true);
        }
    }
    // No need to return true or call sendResponse here, background sends separate messages
});

// Initial status
updateStatus("Ready. Ensure API keys are set in options.");
setProcessing(false);