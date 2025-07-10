// Test script to verify YouTube Shorts support
// This script tests the video ID extraction and URL validation functions

console.log('=== Testing YouTube Shorts Support ===\n');

// Copy the utility functions from popup.js and background.js
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

function isYouTubeVideoUrl(url) {
    if (!url) return false;
    return url.includes('youtube.com/watch') || url.includes('youtube.com/shorts/');
}

// Test data
const testCases = [
    {
        description: 'Standard YouTube video',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expectedVideoId: 'dQw4w9WgXcQ',
        expectedValid: true
    },
    {
        description: 'Standard YouTube video with additional parameters',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&index=1&t=30s',
        expectedVideoId: 'dQw4w9WgXcQ',
        expectedValid: true
    },
    {
        description: 'YouTube Shorts',
        url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        expectedVideoId: 'dQw4w9WgXcQ',
        expectedValid: true
    },
    {
        description: 'YouTube Shorts with complex video ID',
        url: 'https://www.youtube.com/shorts/AbC_123-xyz',
        expectedVideoId: 'AbC_123-xyz',
        expectedValid: true
    },
    {
        description: 'Mobile YouTube video',
        url: 'https://m.youtube.com/watch?v=testVideo123',
        expectedVideoId: 'testVideo123',
        expectedValid: true
    },
    {
        description: 'Mobile YouTube Shorts',
        url: 'https://m.youtube.com/shorts/test-Video_123',
        expectedVideoId: 'test-Video_123',
        expectedValid: true
    },
    {
        description: 'YouTube channel (should not work)',
        url: 'https://www.youtube.com/channel/UCxxxxxxx',
        expectedVideoId: null,
        expectedValid: false
    },
    {
        description: 'YouTube homepage (should not work)',
        url: 'https://www.youtube.com/',
        expectedVideoId: null,
        expectedValid: false
    },
    {
        description: 'Non-YouTube URL (should not work)',
        url: 'https://www.google.com/',
        expectedVideoId: null,
        expectedValid: false
    },
    {
        description: 'Null URL',
        url: null,
        expectedVideoId: null,
        expectedValid: false
    },
    {
        description: 'Empty URL',
        url: '',
        expectedVideoId: null,
        expectedValid: false
    }
];

// Run tests
let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`URL: ${testCase.url || 'null'}`);
    
    const actualVideoId = extractVideoId(testCase.url);
    const actualValid = isYouTubeVideoUrl(testCase.url);
    
    console.log(`Expected Video ID: ${testCase.expectedVideoId || 'null'}`);
    console.log(`Actual Video ID: ${actualVideoId || 'null'}`);
    console.log(`Expected Valid: ${testCase.expectedValid}`);
    console.log(`Actual Valid: ${actualValid}`);
    
    const videoIdMatch = actualVideoId === testCase.expectedVideoId;
    const validMatch = actualValid === testCase.expectedValid;
    
    if (videoIdMatch && validMatch) {
        console.log('✅ PASS\n');
        passCount++;
    } else {
        console.log('❌ FAIL');
        if (!videoIdMatch) console.log(`  Video ID mismatch: expected '${testCase.expectedVideoId}', got '${actualVideoId}'`);
        if (!validMatch) console.log(`  Validation mismatch: expected ${testCase.expectedValid}, got ${actualValid}`);
        console.log('');
        failCount++;
    }
});

console.log('=== Test Results ===');
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total: ${passCount + failCount}`);

if (failCount === 0) {
    console.log('\n🎉 All tests passed! YouTube Shorts support is working correctly.');
} else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
}
