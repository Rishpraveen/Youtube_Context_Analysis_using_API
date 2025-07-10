document.addEventListener('DOMContentLoaded', () => {
    // Form elements - General
    const apiProviderSelect = document.getElementById('apiProviderSelect');
    const batchSizeInput = document.getElementById('batchSize');
    const maxCommentsInput = document.getElementById('maxComments');
    const chunkSizeInput = document.getElementById('chunkSizeInput');
    const manualModeToggle = document.getElementById('manualModeToggle');
    const manualModeSettings = document.getElementById('manualModeSettings');
    const defaultTranscript = document.getElementById('defaultTranscript');
    const saveButton = document.getElementById('saveButton');
    const resetButton = document.getElementById('resetButton');
    const statusDiv = document.getElementById('status');
    
    // Provider setting containers
    const providerSettings = {
        openai: document.getElementById('openai-settings'),
        huggingface: document.getElementById('huggingface-settings'),
        gemini: document.getElementById('gemini-settings'),
        ollama: document.getElementById('ollama-settings')
    };
    
    // YouTube API elements
    const youtubeApiInput = document.getElementById('youtubeApiKey');
    const showYoutubeKeyBtn = document.getElementById('showYoutubeKeyBtn');
    const testYoutubeApiBtn = document.getElementById('testYoutubeApiBtn');
    const youtubeApiStatus = document.getElementById('youtubeApiStatus');
    
    // OpenAI elements
    const openaiApiInput = document.getElementById('openaiApiKey');
    const showOpenAIKeyBtn = document.getElementById('showOpenAIKeyBtn');
    const openaiModelSelect = document.getElementById('openaiModelSelect');
    const testOpenAIApiBtn = document.getElementById('testOpenAIApiBtn');
    const openaiApiStatus = document.getElementById('openaiApiStatus');
    
    // Hugging Face elements
    const huggingfaceApiInput = document.getElementById('huggingfaceApiKey');
    const showHuggingfaceKeyBtn = document.getElementById('showHuggingfaceKeyBtn');
    const huggingfaceModelSelect = document.getElementById('huggingfaceModelSelect');
    const testHuggingfaceApiBtn = document.getElementById('testHuggingfaceApiBtn');
    const huggingfaceApiStatus = document.getElementById('huggingfaceApiStatus');
    
    // Gemini elements
    const geminiApiInput = document.getElementById('geminiApiKey');
    const showGeminiKeyBtn = document.getElementById('showGeminiKeyBtn');
    const geminiModelSelect = document.getElementById('geminiModelSelect');
    const testGeminiApiBtn = document.getElementById('testGeminiApiBtn');
    const geminiApiStatus = document.getElementById('geminiApiStatus');
    
    // Ollama elements
    const ollamaEndpointInput = document.getElementById('ollamaEndpoint');
    const ollamaModelSelect = document.getElementById('ollamaModelSelect');
    const testOllamaApiBtn = document.getElementById('testOllamaApiBtn');
    const ollamaApiStatus = document.getElementById('ollamaApiStatus');

    // Language settings elements
    const fetchAllLanguagesCheckbox = document.getElementById('fetchAllLanguages');
    const autoTranslateCaptionsCheckbox = document.getElementById('autoTranslateCaptions');
    const browserExtractionEnabledCheckbox = document.getElementById('browserExtractionEnabled');
    const languagePreferenceGroup = document.getElementById('languagePreferenceGroup');
    const languageCheckboxes = document.querySelectorAll('.language-checkboxes input[type="checkbox"]');

    // Default settings
    const defaultSettings = {
        apiProvider: 'openai',
        youtubeApiKey: '',
        openaiApiKey: '',
        openaiModel: 'gpt-3.5-turbo',
        huggingfaceApiKey: '',
        huggingfaceModel: 'microsoft/DialoGPT-medium',
        geminiApiKey: '',
        geminiModel: 'gemini-1.5-flash',
        ollamaEndpoint: 'http://localhost:11434',
        ollamaModel: 'llama2',
        batchSize: 25,
        maxComments: 100,
        chunkSize: 1000,
        manualMode: false,
        defaultTranscript: '',
        preferredLanguages: ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'hi', 'pt'],
        fetchAllLanguages: false,
        autoTranslateCaptions: false,
        browserExtractionEnabled: true
    };

    // Load saved settings
    function loadSettings() {
        console.log('Loading settings...');
        chrome.storage.local.get([
            'apiProvider',
            'youtubeApiKey',
            'openaiApiKey',
            'openaiModel',
            'huggingfaceApiKey',
            'huggingfaceModel',
            'geminiApiKey',
            'geminiModel',
            'ollamaEndpoint',
            'ollamaModel',
            'batchSize',
            'maxComments',
            'chunkSize',
            'manualMode',
            'defaultTranscript',
            'preferredLanguages',
            'fetchAllLanguages',
            'autoTranslateCaptions',
            'browserExtractionEnabled'
        ], (result) => {
            console.log('Settings loaded:', result);
            
            // Set API provider
            if (result.apiProvider && apiProviderSelect) {
                apiProviderSelect.value = result.apiProvider;
                showProviderSettings(result.apiProvider);
            }
            
            // YouTube settings
            if (result.youtubeApiKey && youtubeApiInput) youtubeApiInput.value = result.youtubeApiKey;
            
            // OpenAI settings
            if (result.openaiApiKey) openaiApiInput.value = result.openaiApiKey;
            if (result.openaiModel) openaiModelSelect.value = result.openaiModel;
            
            // Hugging Face settings
            if (result.huggingfaceApiKey) huggingfaceApiInput.value = result.huggingfaceApiKey;
            if (result.huggingfaceModel) huggingfaceModelSelect.value = result.huggingfaceModel;
            
            // Gemini settings
            if (result.geminiApiKey) geminiApiInput.value = result.geminiApiKey;
            if (result.geminiModel) geminiModelSelect.value = result.geminiModel;
            
            // Ollama settings
            if (result.ollamaEndpoint) ollamaEndpointInput.value = result.ollamaEndpoint;
            if (result.ollamaModel) ollamaModelSelect.value = result.ollamaModel;
            
            // General settings
            if (result.batchSize && batchSizeInput) batchSizeInput.value = result.batchSize;
            if (result.maxComments && maxCommentsInput) maxCommentsInput.value = result.maxComments;
            if (result.chunkSize && chunkSizeInput) chunkSizeInput.value = result.chunkSize;
            
            if (result.manualMode && manualModeToggle && manualModeSettings) {
                manualModeToggle.checked = true;
                manualModeSettings.classList.remove('hidden');
            }
            
            if (result.defaultTranscript && defaultTranscript) {
                defaultTranscript.value = result.defaultTranscript;
            }
            
            // Language settings
            if (fetchAllLanguagesCheckbox) {
                fetchAllLanguagesCheckbox.checked = result.fetchAllLanguages || false;
                toggleLanguagePreferences();
            }
            
            if (autoTranslateCaptionsCheckbox) {
                autoTranslateCaptionsCheckbox.checked = result.autoTranslateCaptions || false;
            }
            
            if (browserExtractionEnabledCheckbox) {
                browserExtractionEnabledCheckbox.checked = result.browserExtractionEnabled !== false; // Default to true
            }
            
            // Load preferred languages
            if (languageCheckboxes && result.preferredLanguages) {
                languageCheckboxes.forEach(checkbox => {
                    checkbox.checked = result.preferredLanguages.includes(checkbox.value);
                });
            }
            
            console.log('Settings loading completed');
        });
    }

    // Save settings
    function saveSettings() {
        try {
            console.log('Saving settings...');
            
            const provider = apiProviderSelect ? apiProviderSelect.value : defaultSettings.apiProvider;
            
            const settings = {
                apiProvider: provider,
                youtubeApiKey: youtubeApiInput ? youtubeApiInput.value.trim() : '',
                openaiApiKey: openaiApiInput ? openaiApiInput.value.trim() : '',
                openaiModel: openaiModelSelect ? openaiModelSelect.value : defaultSettings.openaiModel,
                huggingfaceApiKey: huggingfaceApiInput ? huggingfaceApiInput.value.trim() : '',
                huggingfaceModel: huggingfaceModelSelect ? huggingfaceModelSelect.value : defaultSettings.huggingfaceModel,
                geminiApiKey: geminiApiInput ? geminiApiInput.value.trim() : '',
                geminiModel: geminiModelSelect ? geminiModelSelect.value : defaultSettings.geminiModel,
                ollamaEndpoint: ollamaEndpointInput ? ollamaEndpointInput.value.trim() : defaultSettings.ollamaEndpoint,
                ollamaModel: ollamaModelSelect ? ollamaModelSelect.value : defaultSettings.ollamaModel,
                batchSize: batchSizeInput ? parseInt(batchSizeInput.value) : defaultSettings.batchSize,
                maxComments: maxCommentsInput ? parseInt(maxCommentsInput.value) : defaultSettings.maxComments,
                chunkSize: chunkSizeInput ? parseInt(chunkSizeInput.value) : defaultSettings.chunkSize,
                manualMode: manualModeToggle ? manualModeToggle.checked : defaultSettings.manualMode,
                defaultTranscript: defaultTranscript ? defaultTranscript.value : '',
                fetchAllLanguages: fetchAllLanguagesCheckbox ? fetchAllLanguagesCheckbox.checked : defaultSettings.fetchAllLanguages,
                autoTranslateCaptions: autoTranslateCaptionsCheckbox ? autoTranslateCaptionsCheckbox.checked : defaultSettings.autoTranslateCaptions,
                browserExtractionEnabled: browserExtractionEnabledCheckbox ? browserExtractionEnabledCheckbox.checked : defaultSettings.browserExtractionEnabled,
                preferredLanguages: getSelectedLanguages()
            };

            console.log('Settings to save:', settings);
            
            chrome.storage.local.set(settings, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving settings:', chrome.runtime.lastError);
                    showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    console.log('Settings saved successfully');
                    showStatus('Settings saved successfully!', 'success');
                }
            });
        } catch (error) {
            console.error('Error in saveSettings:', error);
            showStatus('Error saving settings: ' + error.message, 'error');
        }
    }

    // Reset settings to defaults
    function resetSettings() {
        try {
            console.log('Resetting settings to defaults...');
            
            // Reset form elements safely
            if (apiProviderSelect) apiProviderSelect.value = defaultSettings.apiProvider;
            if (youtubeApiInput) youtubeApiInput.value = defaultSettings.youtubeApiKey;
            if (openaiApiInput) openaiApiInput.value = defaultSettings.openaiApiKey;
            if (openaiModelSelect) openaiModelSelect.value = defaultSettings.openaiModel;
            if (huggingfaceApiInput) huggingfaceApiInput.value = defaultSettings.huggingfaceApiKey;
            if (huggingfaceModelSelect) huggingfaceModelSelect.value = defaultSettings.huggingfaceModel;
            if (geminiApiInput) geminiApiInput.value = defaultSettings.geminiApiKey;
            if (geminiModelSelect) geminiModelSelect.value = defaultSettings.geminiModel;
            if (ollamaEndpointInput) ollamaEndpointInput.value = defaultSettings.ollamaEndpoint;
            if (ollamaModelSelect) ollamaModelSelect.value = defaultSettings.ollamaModel;
            if (batchSizeInput) batchSizeInput.value = defaultSettings.batchSize;
            if (maxCommentsInput) maxCommentsInput.value = defaultSettings.maxComments;
            if (chunkSizeInput) chunkSizeInput.value = defaultSettings.chunkSize;
            if (manualModeToggle) {
                manualModeToggle.checked = defaultSettings.manualMode;
                if (manualModeSettings) {
                    manualModeSettings.classList.add('hidden');
                }
            }
            if (defaultTranscript) defaultTranscript.value = defaultSettings.defaultTranscript;
            
            // Reset language settings
            if (fetchAllLanguagesCheckbox) fetchAllLanguagesCheckbox.checked = defaultSettings.fetchAllLanguages;
            if (autoTranslateCaptionsCheckbox) autoTranslateCaptionsCheckbox.checked = defaultSettings.autoTranslateCaptions;
            if (browserExtractionEnabledCheckbox) browserExtractionEnabledCheckbox.checked = defaultSettings.browserExtractionEnabled;
            
            // Reset language checkboxes
            if (languageCheckboxes) {
                languageCheckboxes.forEach(checkbox => {
                    checkbox.checked = defaultSettings.preferredLanguages.includes(checkbox.value);
                });
            }
            
            // Update language preference visibility
            toggleLanguagePreferences();
            
            // Clear storage and set defaults
            chrome.storage.local.clear(() => {
                chrome.storage.local.set(defaultSettings, () => {
                    showStatus('Settings reset to defaults!', 'success');
                    showProviderSettings(defaultSettings.apiProvider);
                });
            });
            
            // Clear all status messages
            const statusElements = [youtubeApiStatus, openaiApiStatus, huggingfaceApiStatus, geminiApiStatus, ollamaApiStatus];
            statusElements.forEach(element => {
                if (element) {
                    element.textContent = '';
                    element.className = 'api-status';
                }
            });
            
        } catch (error) {
            console.error('Error resetting settings:', error);
            showStatus('Error resetting settings: ' + error.message, 'error');
        }
    }

    // Show only the selected provider settings
    function showProviderSettings(provider) {
        // Hide all provider settings
        Object.values(providerSettings).forEach(element => {
            element.classList.add('hidden');
        });
        
        // Show selected provider settings
        if (providerSettings[provider]) {
            providerSettings[provider].classList.remove('hidden');
        }
    }

    // Show status message
    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        
        // Clear previous classes
        statusDiv.className = 'status';
        
        // Add appropriate class
        if (type === 'success') {
            statusDiv.classList.add('success');
        } else if (type === 'error') {
            statusDiv.classList.add('error');
        } else {
            statusDiv.classList.add('info');
        }
        
        // Auto-hide after delay
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 5000);
    }

    // Toggle password visibility
    function togglePasswordVisibility(inputElement) {
        if (inputElement.type === 'password') {
            inputElement.type = 'text';
        } else {
            inputElement.type = 'password';
        }
    }

    // Test YouTube API
    async function testYoutubeAPI() {
        const apiKey = youtubeApiInput.value.trim();
        if (!apiKey) {
            showAPIStatus(youtubeApiStatus, 'Please enter an API key', 'error');
            return;
        }

        showAPIStatus(youtubeApiStatus, 'Testing...', 'testing');
        
        try {
            // Test with a simple quota check using a well-known video ID
            const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll - a video that should always exist
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${testVideoId}&key=${apiKey}`
            );
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.items && data.items.length > 0) {
                    showAPIStatus(youtubeApiStatus, 'API Key is valid! ✓', 'success');
                } else {
                    showAPIStatus(youtubeApiStatus, 'API Key is valid but test video not found', 'success');
                }
            } else if (data.error) {
                if (data.error.code === 403) {
                    showAPIStatus(youtubeApiStatus, `Error: ${data.error.message}. Check API key and quota.`, 'error');
                } else if (data.error.code === 400) {
                    showAPIStatus(youtubeApiStatus, `Error: ${data.error.message}. Invalid API key format.`, 'error');
                } else {
                    showAPIStatus(youtubeApiStatus, `Error: ${data.error.message}`, 'error');
                }
            } else {
                showAPIStatus(youtubeApiStatus, 'Unknown error testing API', 'error');
            }
        } catch (error) {
            console.error('YouTube API test error:', error);
            showAPIStatus(youtubeApiStatus, `Network error: ${error.message}`, 'error');
        }
    }

    // Test OpenAI API
    async function testOpenAIAPI() {
        const apiKey = openaiApiInput.value.trim();
        const model = openaiModelSelect.value;
        
        if (!apiKey) {
            showAPIStatus(openaiApiStatus, 'Please enter an API key', 'error');
            return;
        }

        showAPIStatus(openaiApiStatus, 'Testing...', 'testing');
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant.'
                        },
                        {
                            role: 'user',
                            content: 'Say "API connection successful!"'
                        }
                    ],
                    max_tokens: 20
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.choices && data.choices.length > 0) {
                showAPIStatus(openaiApiStatus, 'API Key is valid! ✓', 'success');
            } else if (data.error) {
                showAPIStatus(openaiApiStatus, `Error: ${data.error.message}`, 'error');
            } else {
                showAPIStatus(openaiApiStatus, 'Unknown error testing API', 'error');
            }
        } catch (error) {
            showAPIStatus(openaiApiStatus, `Error: ${error.message}`, 'error');
        }
    }
    
    // Test Hugging Face API
    async function testHuggingfaceAPI() {
        const apiKey = huggingfaceApiInput.value.trim();
        const model = huggingfaceModelSelect.value;
        
        showAPIStatus(huggingfaceApiStatus, 'Testing...', 'testing');
        
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            
            const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    inputs: 'Test message to check if the API is working correctly.'
                })
            });
            
            let data;
            let isJsonResponse = false;
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                    isJsonResponse = true;
                } catch (jsonError) {
                    console.error('JSON parse error:', jsonError);
                    data = await response.text();
                }
            } else {
                data = await response.text();
            }
            
            if (response.ok) {
                if (isJsonResponse && Array.isArray(data) && data.length > 0) {
                    showAPIStatus(huggingfaceApiStatus, 'Connection successful! ✓', 'success');
                } else if (isJsonResponse && data.error) {
                    showAPIStatus(huggingfaceApiStatus, `Error: ${data.error}`, 'error');
                } else if (!isJsonResponse && data.includes('generated_text')) {
                    showAPIStatus(huggingfaceApiStatus, 'Connection successful! ✓', 'success');
                } else {
                    showAPIStatus(huggingfaceApiStatus, 'Connection successful! ✓', 'success');
                }
            } else {
                if (response.status === 404) {
                    showAPIStatus(huggingfaceApiStatus, `Error: Model "${model}" not found. Check model name.`, 'error');
                } else if (response.status === 401) {
                    showAPIStatus(huggingfaceApiStatus, 'Error: Invalid API key or unauthorized access.', 'error');
                } else if (response.status === 429) {
                    showAPIStatus(huggingfaceApiStatus, 'Error: Rate limit exceeded. Try again later.', 'error');
                } else if (isJsonResponse && data.error) {
                    showAPIStatus(huggingfaceApiStatus, `Error: ${data.error}`, 'error');
                } else {
                    showAPIStatus(huggingfaceApiStatus, `Error ${response.status}: ${data}`, 'error');
                }
            }
        } catch (error) {
            console.error('Hugging Face API test error:', error);
            showAPIStatus(huggingfaceApiStatus, `Error: ${error.message}`, 'error');
        }
    }
    
    // Test Gemini API
    async function testGeminiAPI() {
        const apiKey = geminiApiInput.value.trim();
        const model = geminiModelSelect.value;
        
        if (!apiKey) {
            showAPIStatus(geminiApiStatus, 'Please enter an API key', 'error');
            return;
        }

        showAPIStatus(geminiApiStatus, 'Testing...', 'testing');
        
        try {
            // Use the v1 API endpoint instead of v1beta for better compatibility
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: "Say 'API connection successful!' in a short response."
                            }]
                        }],
                        generationConfig: {
                            maxOutputTokens: 20,
                            temperature: 0.1
                        }
                    })
                }
            );
            
            const data = await response.json();
            
            if (response.ok && data.candidates && data.candidates.length > 0) {
                showAPIStatus(geminiApiStatus, 'API Key is valid! ✓', 'success');
            } else if (data.error) {
                // Handle specific error cases
                if (data.error.message && data.error.message.includes('not found')) {
                    showAPIStatus(geminiApiStatus, `Error: Model ${model} not found. Try updating to a newer model.`, 'error');
                } else {
                    showAPIStatus(geminiApiStatus, `Error: ${data.error.message}`, 'error');
                }
            } else {
                showAPIStatus(geminiApiStatus, 'Unknown error testing API', 'error');
            }
        } catch (error) {
            console.error('Gemini API test error:', error);
            showAPIStatus(geminiApiStatus, `Network error: ${error.message}`, 'error');
        }
    }
    
    // Test Ollama Connection
    async function testOllamaAPI() {
        const endpoint = ollamaEndpointInput.value.trim();
        const model = ollamaModelSelect.value;
        
        showAPIStatus(ollamaApiStatus, 'Testing...', 'testing');
        
        try {
            // First check if the API is reachable
            const response = await fetch(`${endpoint}/api/tags`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                showAPIStatus(ollamaApiStatus, `Error connecting to Ollama: ${response.status}`, 'error');
                return;
            }
            
            // Check if the model exists
            const modelResponse = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: 'Say "Ollama connection successful!" in one short sentence.',
                    stream: false
                })
            });
            
            const data = await modelResponse.json();
            
            if (modelResponse.ok && data.response) {
                showAPIStatus(ollamaApiStatus, 'Connection successful! ✓', 'success');
            } else if (data.error) {
                showAPIStatus(ollamaApiStatus, `Error: ${data.error}`, 'error');
            } else {
                showAPIStatus(ollamaApiStatus, 'Unknown error testing connection', 'error');
            }
        } catch (error) {
            showAPIStatus(ollamaApiStatus, `Error: ${error.message}. Is Ollama running?`, 'error');
        }
    }

    // Show API test status
    function showAPIStatus(element, message, status) {
        if (!element) {
            console.error('showAPIStatus: element is null');
            return;
        }
        
        console.log(`API Status: ${message} (${status})`);
        element.textContent = message;
        
        // Clear previous classes
        element.className = 'api-status';
        
        // Add appropriate class
        if (status) {
            element.classList.add(status);
        }
        
        // Make element visible
        element.style.display = 'block';
    }

    // Input validation
    function validateNumberInput(input, min, max) {
        const val = parseInt(input.value);
        if (isNaN(val) || val < min) input.value = min;
        if (val > max) input.value = max;
    }

    // Language settings helper functions
    function getSelectedLanguages() {
        if (!languageCheckboxes) return defaultSettings.preferredLanguages;
        
        const selected = [];
        languageCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push(checkbox.value);
            }
        });
        return selected.length > 0 ? selected : defaultSettings.preferredLanguages;
    }

    function toggleLanguagePreferences() {
        if (!fetchAllLanguagesCheckbox || !languagePreferenceGroup) return;
        
        if (fetchAllLanguagesCheckbox.checked) {
            languagePreferenceGroup.classList.add('disabled');
        } else {
            languagePreferenceGroup.classList.remove('disabled');
        }
    }

    // Event Listeners - Check if elements exist before adding listeners
    if (saveButton) saveButton.addEventListener('click', saveSettings);
    if (resetButton) resetButton.addEventListener('click', resetSettings);
    
    if (apiProviderSelect) {
        apiProviderSelect.addEventListener('change', () => {
            showProviderSettings(apiProviderSelect.value);
        });
    }
    
    if (showYoutubeKeyBtn && youtubeApiInput) {
        showYoutubeKeyBtn.addEventListener('click', () => togglePasswordVisibility(youtubeApiInput));
    }
    if (showOpenAIKeyBtn && openaiApiInput) {
        showOpenAIKeyBtn.addEventListener('click', () => togglePasswordVisibility(openaiApiInput));
    }
    if (showHuggingfaceKeyBtn && huggingfaceApiInput) {
        showHuggingfaceKeyBtn.addEventListener('click', () => togglePasswordVisibility(huggingfaceApiInput));
    }
    if (showGeminiKeyBtn && geminiApiInput) {
        showGeminiKeyBtn.addEventListener('click', () => togglePasswordVisibility(geminiApiInput));
    }
    
    if (testYoutubeApiBtn) testYoutubeApiBtn.addEventListener('click', testYoutubeAPI);
    if (testOpenAIApiBtn) testOpenAIApiBtn.addEventListener('click', testOpenAIAPI);
    if (testHuggingfaceApiBtn) testHuggingfaceApiBtn.addEventListener('click', testHuggingfaceAPI);
    if (testGeminiApiBtn) testGeminiApiBtn.addEventListener('click', testGeminiAPI);
    if (testOllamaApiBtn) testOllamaApiBtn.addEventListener('click', testOllamaAPI);
    
    if (manualModeToggle && manualModeSettings) {
        manualModeToggle.addEventListener('change', () => {
            if (manualModeToggle.checked) {
                manualModeSettings.classList.remove('hidden');
            } else {
                manualModeSettings.classList.add('hidden');
            }
        });
    }

    if (batchSizeInput) batchSizeInput.addEventListener('change', () => validateNumberInput(batchSizeInput, 10, 100));
    if (maxCommentsInput) maxCommentsInput.addEventListener('change', () => validateNumberInput(maxCommentsInput, 50, 1000));
    if (chunkSizeInput) chunkSizeInput.addEventListener('change', () => validateNumberInput(chunkSizeInput, 500, 8000));

    // Language settings event listeners
    if (fetchAllLanguagesCheckbox) {
        fetchAllLanguagesCheckbox.addEventListener('change', toggleLanguagePreferences);
    }

    // Debug: Check if all elements exist
    console.log('Checking elements...');
    console.log('youtubeApiInput:', youtubeApiInput);
    console.log('testYoutubeApiBtn:', testYoutubeApiBtn);
    console.log('youtubeApiStatus:', youtubeApiStatus);
    console.log('apiProviderSelect:', apiProviderSelect);
    
    // Check if any critical elements are missing
    const criticalElements = {
        youtubeApiInput,
        testYoutubeApiBtn,
        youtubeApiStatus,
        apiProviderSelect,
        saveButton,
        statusDiv
    };
    
    for (const [name, element] of Object.entries(criticalElements)) {
        if (!element) {
            console.error(`Critical element missing: ${name}`);
        }
    }

    // Initial load
    loadSettings();
});
