console.log("YouTube Context Analyzer: Content script loaded (or injected).");

// This script primarily exists to be *injected* by the background script
// using chrome.scripting.executeScript() to get page-specific data like the video ID.
// It doesn't need much code itself initially, as the functions to execute
// are passed directly in the executeScript call from background.js.

// We *could* add listeners here if the background script needed to push
// UI changes *to* the page (e.g., highlight text), but let's keep it simple for now.

// Example of how it might listen for commands from background later:
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "highlightText") {
        console.log("TODO: Highlight text on page:", request.textToHighlight);
        // Add DOM manipulation logic here
        sendResponse({ success: true });
    }
});
