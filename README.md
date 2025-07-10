# YouTube Context Analyzer Extension

A powerful Chrome extension that analyzes YouTube video context using transcript extraction, comment analysis, and RAG (Retrieval-Augmented Generation).

## Features

- **Transcript Extraction**: Automatically extracts video transcripts using YouTube API or direct page extraction
- **Comment Analysis**: Analyzes video comments for sentiment and key themes
- **RAG Analysis**: Ask questions about video content and get answers based on the transcript
- **Fact Checking**: Select text and right-click to fact-check claims in the video
- **Multiple LLM Providers**: Support for OpenAI, Hugging Face, Gemini, and Ollama
- **Manual Mode**: Option to manually input transcripts when automatic extraction fails
- **Progress Tracking**: Visual progress indicators for all operations
- **Result Caching**: Improved performance with intelligent result caching
- **Export Results**: Download analysis results as HTML or text files
- **Keyboard Shortcuts**: Convenient keyboard shortcuts for common actions

## Setup Instructions

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing this extension
5. Click the extension icon to open the popup
6. Go to options and configure your API keys

## API Keys

### YouTube API Key

- Go to the [Google Cloud Console](https://console.developers.google.com/)
- Create a new project or select an existing one
- Enable the YouTube Data API v3
- Create credentials (API key)
- Copy and paste the API key in the extension options

### LLM Provider Options

#### OpenAI API Key

- Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
- Create an account or log in
- Create a new secret key
- Copy and paste the key in the extension options

#### Hugging Face API Key (Free Alternative)

- Go to [Hugging Face](https://huggingface.co/settings/tokens)
- Create an account or log in
- Create a new access token
- Copy and paste the token in the extension options

#### Google Gemini API Key (Free Tier Available)

- Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
- Create an account or log in
- Create a new API key
- Copy and paste the key in the extension options

#### Ollama (Completely Free, Local Option)

- [Install Ollama](https://ollama.ai/download) on your local machine
- Start the Ollama server
- Configure the endpoint URL (default: `http://localhost:11434`)
- Select your preferred model in the extension options

## Performance Settings

- **Comment Batch Size**: Controls how many comments are processed at once (lower = less RAM)
- **Max Comments**: Limits total comments to analyze (lower = faster processing)
- **Chunk Size**: Size of transcript chunks for RAG (smaller = less memory usage)

## Manual Mode

If automatic transcript extraction fails, you can enable Manual Mode in the options:

1. Go to extension options
2. Enable "Use Manual Mode"
3. Optionally paste a default transcript
4. When using the extension, you'll be prompted to paste the transcript manually

## Keyboard Shortcuts

- **Ctrl+1**: Switch to Transcript tab
- **Ctrl+2**: Switch to Comments tab
- **Ctrl+3**: Switch to RAG Analysis tab
- **T**: Get transcript (when in Transcript tab)
- **C**: Analyze comments (when in Comments tab)
- **R**: Focus on RAG query input (when in RAG tab)

## Exporting Results

You can export results using the download buttons next to each analysis section:

- **Transcript**: Exports as a text file (.txt)
- **Comment Analysis**: Exports as an HTML report
- **RAG Analysis**: Exports as an HTML report

## Caching

The extension uses intelligent caching to improve performance:

- Transcripts are cached for 1 hour
- Analysis results are cached based on the selected API provider
- Cache is automatically cleaned to prevent excessive memory usage

## Technologies Used

- JavaScript
- Chrome Extension APIs
- YouTube Data API v3
- OpenAI API
- Retrieval-Augmented Generation (RAG)

## Troubleshooting

- **API Keys Not Working**: Use the "Test API" buttons in options to verify your keys
- **High Memory Usage**: Reduce batch size and chunk size in the options
- **Transcript Extraction Fails**: Switch to manual mode and paste the transcript manually
- **Extension Closing**: Fixed in recent update - popup now stays open during operations
- **Slow Analysis**: Enable caching and consider using a more efficient API provider

## Privacy Notice

This extension only processes data for the currently active YouTube video. No data is stored on external servers, and API keys are stored locally in your browser.
