# YouTube Context Analyzer

Chrome extension for extracting YouTube transcripts, analyzing comments, and running transcript-grounded Q&A with selectable LLM providers.

## What It Does

- Extracts transcripts from YouTube videos and Shorts.
- Supports multi-language caption retrieval when available.
- Extracts captions locally from YouTube player/page data without requiring YouTube Data API v3.
- Analyzes comments for sentiment and recurring themes.
- Answers user questions from transcript context (RAG-style flow).
- Supports `openai`, `huggingface`, `gemini`, and local `ollama` providers.
- Provides manual transcript mode when automatic extraction is not possible.

## Supported URLs

- `https://www.youtube.com/watch?v=...`
- `https://www.youtube.com/shorts/...`

## Install (Developer Mode)

1. Clone the repository:

```bash
git clone https://github.com/Rishpraveen/Youtube_Context_Analysis_using_API.git
```

2. Open `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked` and select this project folder.

## Required and Optional Configuration

Open the extension options page and configure the following.

- `YouTube API key`:
   Optional. Transcript extraction primarily uses player/page methods; API key is mainly used for more reliable comment fetching.
- `LLM provider`:
   Choose one of `openai`, `huggingface`, `gemini`, or `ollama`.

Provider-specific settings:

- `openai`: API key and model.
- `huggingface`: API key (optional for some models) and model.
- `gemini`: API key and model.
- `ollama`: local endpoint (default `http://localhost:11434`) and model.

Performance/settings:

- `batchSize`, `maxComments`, `chunkSize`.
- `fetchAllLanguages`, `preferredLanguages`, `autoTranslateCaptions`.
- `browserExtractionEnabled`.
- `manualMode` and `defaultTranscript`.

## Usage

1. Open a YouTube video or Short.
2. Open the extension popup.
3. Use tabs:
    - `Transcript`: fetch transcript.
    - `Comments`: analyze comments.
    - `RAG Analysis`: ask questions based on transcript text.
4. Export transcript/comments/RAG outputs from popup export buttons.

Keyboard shortcuts in popup:

- `Ctrl+1`, `Ctrl+2`, `Ctrl+3`: switch tabs.
- `t`: fetch transcript (Transcript tab).
- `c`: analyze comments (Comments tab).
- `r`: focus RAG input (RAG tab).

## Local Model (Ollama)

To run analysis locally:

1. Install Ollama.
2. Start Ollama service locally.
3. Pull at least one model (example: `llama3.2:3b`).
4. In options, set provider to `ollama`.
5. Confirm endpoint and model values match your local setup.

If you installed models using Alpaca, use the same model name shown by `ollama list` in the `Model` field.

If the endpoint or model is invalid, analysis requests fail with a provider error in the popup status.

## Architecture (High-Level)

- `manifest.json`: extension configuration and permissions.
- `background.js`: orchestration, API calls, caching, provider routing, context menu.
- `content.js`: page-level extraction (captions/comments metadata and fallback logic).
- `popup.js`: popup UI actions, progress, rendering, export.
- `options.js`: settings management and provider/API validation.

## Troubleshooting

- Transcript not loading:
   Verify you are on a supported YouTube URL, then try manual mode if captions are unavailable.
- Provider errors:
   Re-check selected provider credentials/endpoint/model in options.
- Ollama not responding:
   Confirm Ollama is running and reachable at configured endpoint.
- Comment fetch issues:
   If YouTube API path fails, fallback scraping may still work depending on page state and loaded comments.

## Development Notes

- Project is plain JavaScript (no bundler).
- Load as unpacked extension for testing.
- A small URL support script exists: `test_shorts_support.js` (requires local Node.js runtime).

## Contributing

See `Contributing.md`.

## License

MIT. See `LICENSE`.

