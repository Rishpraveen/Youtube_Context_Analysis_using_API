console.log("YouTube Context Analyzer: Content script loaded (or injected).");

// Helper function to extract video ID from URL
function getYouTubeVideoId() {
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

// Function to extract video metadata
function getVideoMetadata() {
    const videoId = getYouTubeVideoId();
    const title = document.querySelector('meta[property="og:title"]')?.content || 
                 document.querySelector('title')?.textContent || 'Unknown Video';
    const channelName = document.querySelector('ytd-channel-name yt-formatted-string')?.textContent || 'Unknown Channel';
    
    return { videoId, title, channelName };
}

// Extract transcript from page (will be called via executeScript)
function extractTranscriptFromPage() {
    return new Promise((resolve, reject) => {
        // Check if transcript button is already visible
        const transcriptButton = Array.from(document.querySelectorAll('button'))
            .find(button => button.textContent?.includes('Show transcript'));
            
        if (!transcriptButton) {
            // Try to access "More" dropdown first if transcript button not found
            const moreActionsButton = document.querySelector('button[aria-label="More actions"]');
            if (moreActionsButton) {
                moreActionsButton.click();
                // Wait for menu to appear
                setTimeout(() => {
                    const showTranscriptMenuItem = Array.from(document.querySelectorAll('tp-yt-paper-item'))
                        .find(item => item.textContent?.includes('Show transcript'));
                    
                    if (showTranscriptMenuItem) {
                        showTranscriptMenuItem.click();
                        // Wait for transcript to appear
                        setTimeout(extractTranscriptText, 1000);
                    } else {
                        reject("Transcript option not found in menu");
                    }
                }, 500);
            } else {
                reject("Transcript button not found and cannot access 'More' menu");
            }
        } else {
            transcriptButton.click();
            // Wait for transcript to load
            setTimeout(extractTranscriptText, 1000);
        }
        
        function extractTranscriptText() {
            const transcriptPanel = document.querySelector('ytd-transcript-renderer') || 
                                    document.querySelector('.ytd-transcript-renderer');
                                    
            if (!transcriptPanel) {
                reject("Transcript panel not found after clicking button");
                return;
            }
            
            // Extract text from transcript segments
            const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer') || 
                            transcriptPanel.querySelectorAll('.ytd-transcript-segment-renderer');
                            
            if (!segments || segments.length === 0) {
                reject("No transcript segments found");
                return;
            }
            
            const transcriptText = Array.from(segments).map(segment => {
                const timeElement = segment.querySelector('.segment-timestamp') || 
                                   segment.querySelector('[class*="timestamp"]');
                const textElement = segment.querySelector('.segment-text') || 
                                   segment.querySelector('[class*="text"]');
                                   
                if (timeElement && textElement) {
                    return `[${timeElement.textContent.trim()}] ${textElement.textContent.trim()}`;
                }
                return '';
            }).filter(text => text.length > 0).join('\n');
            
            resolve(transcriptText);
            
            // Close transcript panel after extraction
            const closeButton = document.querySelector('button[aria-label="Close transcript"]') || 
                               document.querySelector('.ytd-transcript-renderer [aria-label="Close"]');
            if (closeButton) {
                closeButton.click();
            }
        }
    });
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getVideoInfo") {
        sendResponse(getVideoMetadata());
        return true;
    }
    
    if (request.action === "displayFactCheck") {
        // Display fact check in a floating panel
        const panel = document.createElement('div');
        panel.className = 'yt-context-analyzer-panel';
        panel.style = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            max-height: 400px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            z-index: 9999;
            overflow-y: auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => panel.remove();
        
        const title = document.createElement('h3');
        title.textContent = 'Fact Check Result';
        title.style = 'margin-top: 0; margin-bottom: 10px;';
        
        const content = document.createElement('div');
        if (request.result) {
            content.innerHTML = `
                <strong>Verdict:</strong> ${request.result.verdict || 'Unknown'}<br>
                <strong>Confidence:</strong> ${request.result.confidence ? (request.result.confidence * 100).toFixed(0) + '%' : 'Unknown'}<br>
                <strong>Explanation:</strong> ${request.result.explanation || 'No explanation provided.'}
            `;
        } else if (request.error) {
            content.innerHTML = `<p style="color: red;">Error: ${request.error}</p>`;
        }
        
        panel.appendChild(closeBtn);
        panel.appendChild(title);
        panel.appendChild(content);
        document.body.appendChild(panel);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (document.body.contains(panel)) {
                panel.remove();
            }
        }, 30000);
        
        return true;
    }
});
