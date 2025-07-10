# YouTube Context Analyzer Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/extension-id.svg)](https://chrome.google.com/webstore/detail/extension-id)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/extension-id.svg)](https://chrome.google.com/webstore/detail/extension-id)
[![GitHub issues](https://img.shields.io/github/issues/Rishpraveen/Youtube_Context_Analysis_using_API.svg)](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/issues)
[![GitHub stars](https://img.shields.io/github/stars/Rishpraveen/Youtube_Context_Analysis_using_API.svg?style=social)](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/stargazers)

> A powerful Chrome extension that analyzes YouTube video context using transcript extraction, comment analysis, and RAG (Retrieval-Augmented Generation). **Now supports both standard YouTube videos and YouTube Shorts!**

## ✨ Features

### 🎥 **Video Analysis**
- **Transcript Extraction**: Automatically extracts video transcripts using YouTube API or direct page extraction
- **Multi-Language Caption Support**: Fetches and analyzes captions in multiple languages for comprehensive analysis
- **YouTube Shorts Support**: Works with both standard YouTube videos (`/watch?v=`) and YouTube Shorts (`/shorts/`)
- **Browser Player Extraction**: Fallback extraction directly from YouTube player when API is unavailable

### 💬 **Comment Analysis**
- **Sentiment Analysis**: Analyzes video comments for sentiment and key themes
- **Batch Processing**: Configurable comment batch sizes for optimal performance
- **Comment Filtering**: Supports limiting total comments analyzed

### 🤖 **AI-Powered RAG Analysis**
- **Multiple LLM Providers**: Support for OpenAI, Hugging Face, Gemini, and Ollama
- **Question Answering**: Ask questions about video content and get answers based on the transcript
- **Fact Checking**: Select text and right-click to fact-check claims in the video
- **Intelligent Chunking**: Configurable transcript chunk sizes for better processing

### 🌍 **Language Support**
- **Well-supported languages**: English, Spanish, French, German, Japanese, Korean, Chinese, Arabic, Hindi, Portuguese, Russian, Italian, Dutch, Swedish, Danish, Norwegian, Finnish, Turkish, Polish, Ukrainian
- **Indian languages**: Tamil, Telugu, Bengali, Malayalam, Kannada, Gujarati, Punjabi, Marathi, Urdu (⚠️ limited auto-caption support)
- **Other languages**: Thai, Vietnamese, Indonesian, Malay, Hebrew, Persian (some with limited support)

### ⚡ **Performance & Usability**
- **Result Caching**: Improved performance with intelligent result caching
- **Export Results**: Download analysis results as HTML or text files
- **Keyboard Shortcuts**: Convenient keyboard shortcuts for common actions
- **Progress Tracking**: Visual progress indicators for all operations
- **Manual Mode**: Option to manually input transcripts when automatic extraction fails

## 🚀 Quick Start

### Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API.git
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the folder containing this extension

3. **Configure API keys**
   - Click the extension icon to open the popup
   - Go to options and configure your API keys (see [API Setup](#-api-setup) below)

### API Setup

#### YouTube API Key (Required)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API key)
5. Copy and paste the API key in the extension options

#### Choose Your LLM Provider

**Option 1: OpenAI API Key**
- Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
- Create an account or log in
- Create a new secret key
- Copy and paste the key in the extension options

**Option 2: Hugging Face API Key (Free Alternative)**
- Go to [Hugging Face](https://huggingface.co/settings/tokens)
- Create an account or log in
- Create a new access token
- Copy and paste the token in the extension options

**Option 3: Google Gemini API Key (Free Tier Available)**
- Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create an account or log in
- Create a new API key
- Copy and paste the key in the extension options

**Option 4: Ollama (Completely Free, Local Option)**
- Install [Ollama](https://ollama.ai/) on your local machine
- Start the Ollama server
- Configure the endpoint URL (default: `http://localhost:11434`)
- Select your preferred model in the extension options

## 📖 Usage Guide

### Getting Transcripts
1. Navigate to any YouTube video or Short
2. Click the extension icon
3. Go to the "Transcript" tab
4. Click "Get Transcript" or use **Ctrl+T**
5. View extracted transcripts in multiple languages (if available)

### Analyzing Comments
1. In the "Comments" tab
2. Click "Analyze Comments" or use **Ctrl+C**
3. Configure batch size and maximum comments in options for optimal performance
4. View sentiment analysis and key themes

### RAG Analysis
1. Go to the "RAG Analysis" tab
2. Enter your question about the video content
3. Use **Ctrl+R** to focus on the query input
4. Get AI-powered answers based on the transcript

### Keyboard Shortcuts
- **Ctrl+1**: Switch to Transcript tab
- **Ctrl+2**: Switch to Comments tab  
- **Ctrl+3**: Switch to RAG Analysis tab
- **T**: Get transcript (when in Transcript tab)
- **C**: Analyze comments (when in Comments tab)
- **R**: Focus on RAG query input (when in RAG tab)

### Exporting Results
Use the download buttons next to each analysis section:
- **Transcript**: Exports as a text file (.txt)
- **Comment Analysis**: Exports as an HTML report
- **RAG Analysis**: Exports as an HTML report

## ⚙️ Configuration

### Performance Settings
- **Comment Batch Size**: Controls how many comments are processed at once (lower = less RAM usage)
- **Max Comments**: Limits total comments to analyze (lower = faster processing)
- **Chunk Size**: Size of transcript chunks for RAG (smaller = less memory usage)

### Language Settings
- **Fetch All Languages**: When enabled, fetches captions in all available languages
- **Preferred Languages**: Select languages in order of preference (when "Fetch All Languages" is disabled)
- **Auto-Generated Translations**: Include auto-translated captions (may be less accurate)

### Manual Mode
If automatic transcript extraction fails:
1. Go to extension options
2. Enable "Use Manual Mode"
3. Optionally paste a default transcript
4. When using the extension, you'll be prompted to paste the transcript manually

## 🛠️ Technical Details

### Supported YouTube Formats
- **Standard YouTube Videos**: `https://www.youtube.com/watch?v=VIDEO_ID`
- **YouTube Shorts**: `https://www.youtube.com/shorts/VIDEO_ID`

The extension automatically detects the video format and extracts the video ID accordingly.

### Browser Player Caption Extraction
When the YouTube API doesn't have captions for certain languages:
- **Automatic Fallback**: Enabled by default, triggers when API extraction fails
- **Real-time Extraction**: Captures captions as they appear in the player
- **Multi-language Support**: Can extract multiple languages sequentially
- **Manual Control**: Can be disabled in settings if not desired

### Caching System
- Transcripts are cached for 1 hour
- Analysis results are cached based on the selected API provider
- Cache is automatically cleaned to prevent excessive memory usage

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- How to report bugs
- How to suggest features
- How to submit pull requests
- Code style guidelines

## 🛡️ Security

For security concerns, please see our [Security Policy](SECURITY.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Support

If you find this project useful, please consider:
- ⭐ Starring this repository
- 🐛 Reporting bugs through [Issues](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/issues)
- 💡 Suggesting new features
- 🔄 Sharing with others

## 🔧 Troubleshooting

### Common Issues

**API Keys Not Working**
- Use the "Test API" buttons in options to verify your keys

**High Memory Usage**
- Reduce batch size and chunk size in the options

**Transcript Extraction Fails**
- Switch to manual mode and paste the transcript manually
- Check if the video has captions available

**Extension Closing**
- This has been fixed in recent updates - popup now stays open during operations

**Slow Analysis**
- Enable caching and consider using a more efficient API provider
- Reduce the number of comments being analyzed

**YouTube Shorts Issues**
- Ensure you're on a valid YouTube video or Short page
- Extension now supports both `/watch?v=` and `/shorts/` URLs

**Video ID Not Detected**
- Make sure you're on `youtube.com/watch?v=` or `youtube.com/shorts/` URLs
- Refresh the page and try again

### Privacy Notice

This extension only processes data for the currently active YouTube video. No data is stored on external servers, and API keys are stored locally in your browser.

## 🏗️ Built With

- **JavaScript** - Core functionality
- **Chrome Extension APIs** - Browser integration
- **YouTube Data API v3** - Video and transcript data
- **Multiple AI APIs** - OpenAI, Hugging Face, Gemini, Ollama
- **RAG Technology** - Retrieval-Augmented Generation

## 🔗 Links

- [Chrome Web Store](https://chrome.google.com/webstore) (Coming Soon)
- [Issues](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/issues)
- [Discussions](https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API/discussions)

---

**Made with ❤️ by [Rishpraveen](https://github.com/Rishpraveen)**

*⚡ Powered by AI • 🎯 Built for Researchers • 🌍 Multi-language Ready*
