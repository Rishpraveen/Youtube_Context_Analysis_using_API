console.log("YouTube Context Analyzer: Content script loaded (or injected).");

// Helper function to extract video ID from URL (supports both standard videos and Shorts)
function getYouTubeVideoId() {
    const url = window.location.href;
    
    // Check for standard YouTube video URL (/watch?v=)
    const standardMatch = url.match(/[?&]v=([^&]+)/);
    if (standardMatch) {
        return standardMatch[1];
    }
    
    // Check for YouTube Shorts URL (/shorts/)
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
        return shortsMatch[1];
    }
    
    return null;
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

// Extract available caption tracks from YouTube player
function getAvailableCaptionTracks() {
    return new Promise((resolve, reject) => {
        try {
            // Try to access the YouTube player's caption tracks
            const player = document.querySelector('#movie_player');
            if (!player) {
                reject("YouTube player not found");
                return;
            }

            // Look for caption/subtitle button
            const captionButton = document.querySelector('.ytp-subtitles-button') || 
                                 document.querySelector('[aria-label*="Subtitles"]') ||
                                 document.querySelector('[title*="Subtitles"]');
                                 
            if (!captionButton) {
                reject("Caption button not found in player");
                return;
            }

            // Click the caption button to open the menu
            captionButton.click();
            
            setTimeout(() => {
                // Look for the settings/gear button in the caption menu
                const settingsButton = document.querySelector('.ytp-settings-button') ||
                                      document.querySelector('[aria-label*="Settings"]');
                
                if (settingsButton) {
                    settingsButton.click();
                    
                    setTimeout(() => {
                        // Look for "Subtitles/CC" option in settings menu
                        const subtitleOption = Array.from(document.querySelectorAll('.ytp-menuitem'))
                            .find(item => item.textContent?.includes('Subtitles') || item.textContent?.includes('CC'));
                        
                        if (subtitleOption) {
                            subtitleOption.click();
                            
                            setTimeout(() => {
                                // Extract available languages
                                const languageItems = document.querySelectorAll('.ytp-menuitem');
                                const availableLanguages = [];
                                
                                languageItems.forEach(item => {
                                    const text = item.textContent?.trim();
                                    if (text && text !== 'Off' && text !== 'Subtitles/CC') {
                                        // Parse language info
                                        const langMatch = text.match(/(.+?)(?:\s*\((.+?)\))?$/);
                                        if (langMatch) {
                                            const langName = langMatch[1].trim();
                                            const langType = langMatch[2] || 'Unknown';
                                            
                                            // Try to extract language code from attributes or data
                                            const langCode = extractLanguageCode(item, langName);
                                            
                                            availableLanguages.push({
                                                name: langName,
                                                code: langCode,
                                                type: langType,
                                                element: item
                                            });
                                        }
                                    }
                                });
                                
                                // Close the menu
                                document.body.click();
                                
                                resolve(availableLanguages);
                            }, 500);
                        } else {
                            document.body.click();
                            reject("Subtitles option not found in settings");
                        }
                    }, 500);
                } else {
                    document.body.click();
                    reject("Settings button not found");
                }
            }, 500);
            
        } catch (error) {
            reject(`Error accessing caption tracks: ${error.message}`);
        }
    });
}

// Extract language code from various sources
function extractLanguageCode(element, languageName) {
    // Try to get language code from data attributes
    const dataLang = element.getAttribute('data-language-code') || 
                     element.getAttribute('data-lang') ||
                     element.getAttribute('lang');
    
    if (dataLang) return dataLang;
    
    // Map common language names to codes
    const languageMap = {
        'English': 'en',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Chinese': 'zh',
        'Arabic': 'ar',
        'Hindi': 'hi',
        'Portuguese': 'pt',
        'Russian': 'ru',
        'Italian': 'it',
        'Dutch': 'nl',
        'Swedish': 'sv',
        'Danish': 'da',
        'Norwegian': 'no',
        'Finnish': 'fi',
        'Turkish': 'tr',
        'Polish': 'pl',
        'Ukrainian': 'uk',
        'Tamil': 'ta',
        'Telugu': 'te',
        'Bengali': 'bn',
        'Malayalam': 'ml',
        'Kannada': 'kn',
        'Gujarati': 'gu',
        'Punjabi': 'pa',
        'Marathi': 'mr',
        'Urdu': 'ur',
        'Thai': 'th',
        'Vietnamese': 'vi',
        'Indonesian': 'id',
        'Malay': 'ms',
        'Hebrew': 'he',
        'Persian': 'fa'
    };
    
    // Try exact match first
    if (languageMap[languageName]) {
        return languageMap[languageName];
    }
    
    // Try partial match
    for (const [name, code] of Object.entries(languageMap)) {
        if (languageName.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(languageName.toLowerCase())) {
            return code;
        }
    }
    
    // If no match found, return a simplified version of the name
    return languageName.toLowerCase().replace(/[^a-z]/g, '').substring(0, 3);
}

// Extract captions for a specific language from the player
function extractCaptionsForLanguage(languageInfo) {
    return new Promise((resolve, reject) => {
        try {
            // Click the caption button to open the menu
            const captionButton = document.querySelector('.ytp-subtitles-button') || 
                                 document.querySelector('[aria-label*="Subtitles"]');
                                 
            if (!captionButton) {
                reject("Caption button not found");
                return;
            }

            captionButton.click();
            
            setTimeout(() => {
                const settingsButton = document.querySelector('.ytp-settings-button');
                
                if (settingsButton) {
                    settingsButton.click();
                    
                    setTimeout(() => {
                        const subtitleOption = Array.from(document.querySelectorAll('.ytp-menuitem'))
                            .find(item => item.textContent?.includes('Subtitles') || item.textContent?.includes('CC'));
                        
                        if (subtitleOption) {
                            subtitleOption.click();
                            
                            setTimeout(() => {
                                // Find and click the specific language
                                const targetLangItem = Array.from(document.querySelectorAll('.ytp-menuitem'))
                                    .find(item => item.textContent?.includes(languageInfo.name));
                                
                                if (targetLangItem) {
                                    targetLangItem.click();
                                    
                                    // Wait for captions to load and start extracting
                                    setTimeout(() => {
                                        startCaptionExtraction(languageInfo, resolve, reject);
                                    }, 1000);
                                } else {
                                    document.body.click();
                                    reject(`Language ${languageInfo.name} not found in menu`);
                                }
                            }, 500);
                        } else {
                            document.body.click();
                            reject("Subtitles option not found");
                        }
                    }, 500);
                } else {
                    document.body.click();
                    reject("Settings button not found");
                }
            }, 500);
            
        } catch (error) {
            reject(`Error extracting captions for ${languageInfo.name}: ${error.message}`);
        }
    });
}

// Start extracting caption text as it appears
function startCaptionExtraction(languageInfo, resolve, reject) {
    const captionTexts = [];
    const extractedTexts = new Set(); // Avoid duplicates
    let extractionStartTime = Date.now();
    const maxExtractionTime = 30000; // 30 seconds max
    let lastCaptionTime = Date.now();
    
    const captionExtractor = setInterval(() => {
        const currentTime = Date.now();
        
        // Stop if we've been extracting too long without new content
        if (currentTime - lastCaptionTime > 5000 || currentTime - extractionStartTime > maxExtractionTime) {
            clearInterval(captionExtractor);
            
            if (captionTexts.length > 0) {
                const transcript = captionTexts.join('\n');
                resolve({
                    language: languageInfo,
                    transcript: transcript,
                    extractedSegments: captionTexts.length
                });
            } else {
                reject(`No captions found for ${languageInfo.name} after ${(currentTime - extractionStartTime) / 1000}s`);
            }
            return;
        }
        
        // Look for caption elements
        const captionElements = document.querySelectorAll('.caption-window .captions-text') ||
                               document.querySelectorAll('.ytp-caption-segment') ||
                               document.querySelectorAll('.captions-text') ||
                               document.querySelectorAll('[class*="caption"]');
        
        captionElements.forEach(element => {
            const text = element.textContent?.trim();
            if (text && !extractedTexts.has(text)) {
                extractedTexts.add(text);
                
                // Try to get timestamp from video player
                const player = document.querySelector('#movie_player');
                let timestamp = 'Unknown';
                
                if (player && typeof player.getCurrentTime === 'function') {
                    const seconds = Math.floor(player.getCurrentTime());
                    const minutes = Math.floor(seconds / 60);
                    const remainingSeconds = seconds % 60;
                    timestamp = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                }
                
                captionTexts.push(`[${timestamp}] ${text}`);
                lastCaptionTime = currentTime;
            }
        });
        
    }, 100); // Check every 100ms for new captions
    
    // Auto-resolve if no captions appear after 10 seconds
    setTimeout(() => {
        if (captionTexts.length === 0) {
            clearInterval(captionExtractor);
            reject(`No captions detected for ${languageInfo.name} after 10 seconds`);
        }
    }, 10000);
}

// Extract multiple language captions from browser player
function extractMultiLanguageCaptionsFromPlayer(preferredLanguages = []) {
    return new Promise(async (resolve, reject) => {
        try {
            // First, get all available caption tracks
            const availableLanguages = await getAvailableCaptionTracks();
            
            if (availableLanguages.length === 0) {
                reject("No caption tracks found in player");
                return;
            }
            
            const results = {
                availableLanguages: availableLanguages,
                extractedCaptions: {},
                errors: []
            };
            
            // Determine which languages to extract
            let languagesToExtract = availableLanguages;
            
            if (preferredLanguages.length > 0) {
                languagesToExtract = availableLanguages.filter(lang => 
                    preferredLanguages.some(prefLang => 
                        lang.code === prefLang || 
                        lang.name.toLowerCase().includes(prefLang.toLowerCase())
                    )
                );
                
                // If no preferred languages found, fall back to first available
                if (languagesToExtract.length === 0) {
                    languagesToExtract = [availableLanguages[0]];
                }
            }
            
            // Extract captions for each language
            for (const langInfo of languagesToExtract) {
                try {
                    const captionData = await extractCaptionsForLanguage(langInfo);
                    results.extractedCaptions[langInfo.code] = captionData;
                } catch (error) {
                    results.errors.push({
                        language: langInfo.name,
                        code: langInfo.code,
                        error: error.toString()
                    });
                }
                
                // Small delay between language extractions
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            resolve(results);
            
        } catch (error) {
            reject(`Error extracting multi-language captions: ${error.message}`);
        }
    });
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getVideoInfo") {
        sendResponse(getVideoMetadata());
        return true;
    }
    
    if (request.action === "extractTranscriptFromPage") {
        extractTranscriptFromPage()
            .then(transcript => sendResponse({ success: true, transcript }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        return true; // Keep message channel open for async response
    }
    
    if (request.action === "getAvailableCaptionTracks") {
        getAvailableCaptionTracks()
            .then(tracks => sendResponse({ success: true, tracks }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        return true;
    }
    
    if (request.action === "extractCaptionsFromPlayer") {
        const preferredLanguages = request.preferredLanguages || [];
        extractMultiLanguageCaptionsFromPlayer(preferredLanguages)
            .then(results => sendResponse({ success: true, results }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        return true;
    }
    
    if (request.action === "extractSingleLanguageCaptions") {
        const languageInfo = request.languageInfo;
        extractCaptionsForLanguage(languageInfo)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
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
