import { getPrompt } from '../scripts/prompts.js';

// Constants
const INITIAL_SYSTEM_MESSAGE = ``;

class ChatUI {
    constructor() {
        // Grab references
        this.messagesContainer     = document.getElementById('chatMessages');
        this.inputField            = document.getElementById('chatInput');
        this.sendButton            = document.getElementById('sendMessage');
        this.inspectorButton       = document.getElementById('inspectorButton');
        this.resetButton           = document.getElementById('resetChat');
        this.runTestButton         = document.getElementById('runTestButton');
        this.pushAndRunButton      = document.getElementById('pushAndRunButton');

        // Add global "Copy" button next to Inspect / Generate (hidden until code is generated)
        this.bottomButtonsContainer = document.querySelector('.chat-bottom-container .chat-input-container');
        if (this.bottomButtonsContainer) {
            this.globalCopyButton = document.createElement('button');
            this.globalCopyButton.id = 'copyLatestBtn';
            this.globalCopyButton.className = 'small-button';
            this.globalCopyButton.textContent = 'Copy';
            this.globalCopyButton.style.display = 'none';
            this.globalCopyButton.addEventListener('click', () => {
                let codeToCopy = this.generatedCode || '';
                if (!codeToCopy) {
                    const lastAssistant = this.messagesContainer.querySelector('.assistant-message:last-of-type');
                    if (lastAssistant) {
                        const codeBlocks = lastAssistant.querySelectorAll('pre code');
                        if (codeBlocks.length) {
                            codeToCopy = Array.from(codeBlocks).map(b => b.textContent.trim()).join('\n\n');
                        }
                    }
                }
                if (!codeToCopy) {
                    this.addMessage('No code available to copy', 'system');
                    return;
                }
                navigator.clipboard.writeText(codeToCopy).then(() => {
                    const orig = this.globalCopyButton.textContent;
                    this.globalCopyButton.textContent = 'Copied!';
                    setTimeout(() => { this.globalCopyButton.textContent = orig; }, 1400);
                }).catch(err => {
                    console.error('Copy failed:', err);
                    this.addMessage('Failed to copy to clipboard', 'system');
                });
            });
            this.bottomButtonsContainer.appendChild(this.globalCopyButton);
            // Bottom: Copy Feature & Copy Code buttons (operate on selected or latest assistant message)
            const copyToClipboard = (text) => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    return navigator.clipboard.writeText(text);
                }
                return new Promise((resolve, reject) => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try {
                        if (document.execCommand('copy')) resolve();
                        else reject();
                    } catch (e) { reject(e); }
                    finally { document.body.removeChild(ta); }
                });
            };

            this.copyFeatureBottomBtn = document.createElement('button');
            this.copyFeatureBottomBtn.id = 'copyFeatureBtn';
            this.copyFeatureBottomBtn.className = 'small-button';
            this.copyFeatureBottomBtn.textContent = 'Copy Feature';
            this.copyFeatureBottomBtn.style.display = 'none';
            const cleanCopyDebugMessages = () => {
                const sysMsgs = Array.from(this.messagesContainer.querySelectorAll('.system-message'));
                sysMsgs.forEach(m => {
                    const txt = (m.textContent || '').toLowerCase();
                    if (txt.includes('copyfeaturebtn') || txt.includes('copycodebtn') || txt.includes('copied (fallback)') || txt.includes('code copied') || txt.includes('feature copied')) {
                        m.remove();
                    }
                });
            };

            this.copyFeatureBottomBtn.addEventListener('click', () => {
                cleanCopyDebugMessages();
                const mdDiv = this.selectedMessageMdDiv || (() => {
                    const mds = this.messagesContainer.querySelectorAll('.markdown-content');
                    return mds.length ? mds[mds.length-1] : null;
                })();
                if (!mdDiv) { console.debug('No assistant message to copy from'); return; }
                // Try common feature code selectors
                let codes = mdDiv.querySelectorAll('pre code[class*="language-gherkin"], code[class*="language-gherkin"], pre code[class*="language-feature"], code[class*="language-feature"], pre code[class*="language-cucumber"], code[class*="language-cucumber"]');
                // Fallback: look for fenced gherkin blocks in raw markdown text
                if (!codes.length) {
                    const raw = mdDiv.textContent || '';
                    const fenceRegex = /```(?:gherkin|feature|cucumber)?\s*([\s\S]*?)```/gi;
                    const matches = [];
                    let m;
                    while ((m = fenceRegex.exec(raw)) !== null) matches.push(m[1].trim());
                        if (matches.length) {
                        const text = matches.join('\n\n');
                        copyToClipboard(text).then(() => {
                            const orig = this.copyFeatureBottomBtn.textContent;
                            this.copyFeatureBottomBtn.textContent = 'Copied!';
                            setTimeout(() => this.copyFeatureBottomBtn.textContent = orig, 1400);
                        }).catch((e) => { console.error('Copy failed', e); });
                        return;
                    }

                    // If markdown has been rendered to HTML, try heuristic detection of Gherkin-like lines
                    const gherkinLines = [];
                    const lines = raw.split(/\r?\n/);
                    const gherkinKeyword = /^(Feature:|Scenario(?: Outline)?:|Given |When |Then |And |But |Examples:)/i;
                    let collecting = false;
                    let block = [];
                    for (const line of lines) {
                        if (gherkinKeyword.test(line.trim())) {
                            collecting = true;
                            block.push(line);
                        } else if (collecting && line.trim() === '') {
                            // end of block
                            if (block.length) { gherkinLines.push(block.join('\n')); block = []; }
                            collecting = false;
                        } else if (collecting) {
                            block.push(line);
                        }
                    }
                    if (block.length) gherkinLines.push(block.join('\n'));
                    if (gherkinLines.length) {
                        const text = gherkinLines.join('\n\n');
                        copyToClipboard(text).then(() => {
                            const orig = this.copyFeatureBottomBtn.textContent;
                            this.copyFeatureBottomBtn.textContent = 'Copied!';
                            setTimeout(() => this.copyFeatureBottomBtn.textContent = orig, 1400);
                        }).catch((e) => { console.error('Copy failed', e); });
                        return;
                    }
                }
                if (!codes.length) { console.debug('No feature blocks found in selected message'); return; }
                const text = Array.from(codes).map(c => c.textContent.trim()).join('\n\n');
                console.debug('CopyFeature: extracted text length=', text.length, 'preview=', text.slice(0,120));
                copyToClipboard(text).then(() => {
                    const orig = this.copyFeatureBottomBtn.textContent;
                    this.copyFeatureBottomBtn.textContent = 'Copied!';
                    setTimeout(() => this.copyFeatureBottomBtn.textContent = orig, 1400);
                }).catch((e) => { console.error('Copy failed', e); });
            });
            this.bottomButtonsContainer.appendChild(this.copyFeatureBottomBtn);

            this.copyCodeBottomBtn = document.createElement('button');
            this.copyCodeBottomBtn.id = 'copyCodeBtn';
            this.copyCodeBottomBtn.className = 'small-button';
            this.copyCodeBottomBtn.textContent = 'Copy Code';
            this.copyCodeBottomBtn.style.display = 'none';
            this.copyCodeBottomBtn.addEventListener('click', () => {
                cleanCopyDebugMessages();
                const mdDiv = this.selectedMessageMdDiv || (() => {
                    const mds = this.messagesContainer.querySelectorAll('.markdown-content');
                    return mds.length ? mds[mds.length-1] : null;
                })();
                if (!mdDiv) { console.debug('No assistant message to copy from'); return; }
                // Try to find code blocks with language classes
                let all = mdDiv.querySelectorAll('pre code[class*="language-"] , code[class*="language-"]');
                let filtered = Array.from(all).filter(c => !/language-(gherkin|feature|cucumber)/i.test(c.className || ''));
                // Fallback: extract fenced code blocks excluding gherkin
                if (!filtered.length) {
                    const raw = mdDiv.textContent || '';
                    const fenceRegex = /```(\w+)?\s*([\s\S]*?)```/gi;
                    const matches = [];
                    let m;
                    while ((m = fenceRegex.exec(raw)) !== null) {
                        const lang = (m[1] || '').toLowerCase();
                        if (!/(gherkin|feature|cucumber)/i.test(lang)) matches.push(m[2].trim());
                    }
                    if (matches.length) {
                        const text = matches.join('\n\n');
                        copyToClipboard(text).then(() => {
                            const orig = this.copyCodeBottomBtn.textContent;
                            this.copyCodeBottomBtn.textContent = 'Copied!';
                            setTimeout(() => this.copyCodeBottomBtn.textContent = orig, 1400);
                        }).catch((e) => { console.error('Copy failed', e); this.addMessage('Failed to copy to clipboard', 'system'); });
                        return;
                    }
                }
                if (!filtered.length) { this.addMessage('No code blocks found in selected message', 'system'); return; }
                const text = filtered.map(c => c.textContent.trim()).join('\n\n');
                // Find first code-like line (prefer 'package com...' for Java)
                const lines = text.split(/\r?\n/);
                const codeStartRegex = /^\s*(package\s+[\w\.]+;|import\s+|public\s+class\b|export\s+(default\s+)?class\b|class\s+|const\s+\w+\s*=|function\s+|def\s+\w+\(|#include\s+|<\?php)/i;
                let startIndex = lines.findIndex(l => codeStartRegex.test(l));
                if (startIndex === -1) {
                    startIndex = lines.findIndex(l => /^\s*package\s+com\./i.test(l));
                }
                let toCopy;
                if (startIndex > -1) {
                    toCopy = lines.slice(startIndex).join('\n').trim();
                } else {
                    // Remove Gherkin-like lines and example table rows as fallback
                    const nonGherkin = lines.filter(l => !/^\s*(Feature:|Scenario(?: Outline)?:|Given |When |Then |And |But |Examples:|\|)/i.test(l));
                    const cleaned = nonGherkin.join('\n').trim();
                    toCopy = cleaned.length ? cleaned : text;
                }
                console.debug('CopyCode: final copy length=', (toCopy||'').length, 'preview=', (toCopy||'').slice(0,120));
                copyToClipboard(toCopy).then(() => {
                    const orig = this.copyCodeBottomBtn.textContent;
                    this.copyCodeBottomBtn.textContent = 'Copied!';
                    setTimeout(() => this.copyCodeBottomBtn.textContent = orig, 1400);
                    console.debug('Code copied to clipboard');
                }).catch((e) => { console.error('Copy failed', e); });
            });
            this.bottomButtonsContainer.appendChild(this.copyCodeBottomBtn);

            // Document-level fallback listener to catch clicks and perform copy (helps when individual handlers don't fire)
            document.addEventListener('click', (e) => {
                try {
                    const el = e.target.closest && e.target.closest('#copyFeatureBtn, #copyCodeBtn');
                    if (!el) return;
                    console.debug('Fallback listener detected click on', el.id);
                    // remove any leftover debug/system messages from previous copy attempts
                    if (typeof cleanCopyDebugMessages === 'function') cleanCopyDebugMessages();
                    const mdDiv = this.selectedMessageMdDiv || (() => {
                        const mds = this.messagesContainer.querySelectorAll('.markdown-content');
                        return mds.length ? mds[mds.length-1] : null;
                    })();
                    if (!mdDiv) { this.addMessage('No assistant message to copy from', 'system'); return; }
                    if (el.id === 'copyFeatureBtn') {
                        let codes = mdDiv.querySelectorAll('pre code[class*="language-gherkin"], code[class*="language-gherkin"], pre code[class*="language-feature"], code[class*="language-feature"], pre code[class*="language-cucumber"], code[class*="language-cucumber"]');
                        if (!codes.length) {
                            const raw = mdDiv.textContent || '';
                            const fenceRegex = /```(?:gherkin|feature|cucumber)?\s*([\s\S]*?)```/gi;
                            const matches = [];
                            let m;
                            while ((m = fenceRegex.exec(raw)) !== null) matches.push(m[1].trim());
                            if (matches.length) {
                                const text = matches.join('\n\n');
                                copyToClipboard(text).then(() => { this.addMessage('Feature copied (fallback)', 'system'); }).catch(() => { this.addMessage('Failed to copy feature (fallback)', 'system'); });
                                return;
                            }

                            // Heuristic: detect gherkin-like blocks in rendered text
                            const gherkinLines = [];
                            const lines = raw.split(/\r?\n/);
                            const gherkinKeyword = /^(Feature:|Scenario(?: Outline)?:|Given |When |Then |And |But |Examples:)/i;
                            let collecting = false;
                            let block = [];
                            for (const line of lines) {
                                if (gherkinKeyword.test(line.trim())) {
                                    collecting = true;
                                    block.push(line);
                                } else if (collecting && line.trim() === '') {
                                    if (block.length) { gherkinLines.push(block.join('\n')); block = []; }
                                    collecting = false;
                                } else if (collecting) {
                                    block.push(line);
                                }
                            }
                            if (block.length) gherkinLines.push(block.join('\n'));
                            if (gherkinLines.length) {
                                const text = gherkinLines.join('\n\n');
                                copyToClipboard(text).then(() => { console.debug('Feature copied (fallback)'); }).catch(() => { console.error('Failed to copy feature (fallback)'); });
                                return;
                            }
                        }
                        if (!codes.length) { console.debug('No feature blocks found (fallback)'); return; }
                        const text = Array.from(codes).map(c => c.textContent.trim()).join('\n\n');
                        copyToClipboard(text).then(() => { console.debug('Feature copied (fallback)'); }).catch(() => { console.error('Failed to copy feature (fallback)'); });
                    } else if (el.id === 'copyCodeBtn') {
                        let all = mdDiv.querySelectorAll('pre code[class*="language-"] , code[class*="language-"]');
                        let filtered = Array.from(all).filter(c => !/language-(gherkin|feature|cucumber)/i.test(c.className || ''));
                        if (!filtered.length) {
                            const raw = mdDiv.textContent || '';
                            const fenceRegex = /```(\w+)?\s*([\s\S]*?)```/gi;
                            const matches = [];
                            let m;
                            while ((m = fenceRegex.exec(raw)) !== null) {
                                const lang = (m[1] || '').toLowerCase();
                                if (!/(gherkin|feature|cucumber)/i.test(lang)) matches.push(m[2].trim());
                            }
                            if (matches.length) {
                                const text = matches.join('\n\n');
                                // Try to start from code-like line
                                const lines = text.split(/\r?\n/);
                                const codeStartRegex = /^\s*(package\s+[\w\.]+;|import\s+|public\s+class\b|export\s+(default\s+)?class\b|class\s+|const\s+\w+\s*=|function\s+|def\s+\w+\(|#include\s+|<\?php)/i;
                                let startIndex = lines.findIndex(l => codeStartRegex.test(l));
                                if (startIndex === -1) startIndex = lines.findIndex(l => /^\s*package\s+com\./i.test(l));
                                const toCopy = startIndex > -1 ? lines.slice(startIndex).join('\n').trim() : text;
                                copyToClipboard(toCopy).then(() => { console.debug('Code copied (fallback)'); }).catch(() => { console.error('Failed to copy code (fallback)'); });
                                return;
                            }
                        }
                        if (!filtered.length) { console.debug('No code blocks found (fallback)'); return; }
                        const text = filtered.map(c => c.textContent.trim()).join('\n\n');
                        const lines = text.split(/\r?\n/);
                        const codeStartRegex = /^\s*(package\s+[\w\.]+;|import\s+|public\s+class\b|export\s+(default\s+)?class\b|class\s+|const\s+\w+\s*=|function\s+|def\s+\w+\(|#include\s+|<\?php)/i;
                        let startIndex = lines.findIndex(l => codeStartRegex.test(l));
                        if (startIndex === -1) startIndex = lines.findIndex(l => /^\s*package\s+com\./i.test(l));
                        const toCopy = startIndex > -1 ? lines.slice(startIndex).join('\n').trim() : text;
                        copyToClipboard(toCopy).then(() => { console.debug('Code copied (fallback)'); }).catch(() => { console.error('Failed to copy code (fallback)'); });
                    }
                } catch (err) {
                    console.error('Fallback copy listener error', err);
                }
            });
        }
        // Language / Browser dropdown

        // Language / Browser dropdown
        this.languageBindingSelect = document.getElementById('languageBinding');
        this.browserEngineSelect   = document.getElementById('browserEngine');

        // Additional states
        this.selectedDomContent    = null;
        this.isInspecting          = false;
        this.markdownReady         = false;
        this.codeGeneratorType     = 'SELENIUM_JAVA_PAGE_ONLY'; // default 
        this.tokenWarningThreshold = 10000;
        this.selectedModel         = '';
        this.selectedProvider      = '';
        this.generatedCode         = '';

        // Clear existing messages + add initial system message
        this.messagesContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
            </div>
        `;
        this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');

        // Initialize everything
        this.initialize();
        this.initializeMarkdown();
        this.initializeTokenThreshold();
        this.initializeCodeGeneratorType();
    }

    initialize() {
        // Reset chat
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => {
                this.messagesContainer.innerHTML = '';
                this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');
                this.selectedDomContent = null;
                this.generatedCode = '';
                this.inspectorButton.classList.remove('has-content','active');
                this.inspectorButton.innerHTML = `
                    <i class="fas fa-mouse-pointer"></i>
                    <span>Inspect</span>
                `;
                this.isInspecting = false;
                
                // Hide all action buttons
                if (this.runTestButton) this.runTestButton.style.display = 'none';
                if (this.pushAndRunButton) this.pushAndRunButton.style.display = 'none';
                if (this.globalCopyButton) this.globalCopyButton.style.display = 'none';
                if (this.copyFeatureBottomBtn) this.copyFeatureBottomBtn.style.display = 'none';
                if (this.copyCodeBottomBtn) this.copyCodeBottomBtn.style.display = 'none';

                // Ensure only Inspect and Generate are visible
                if (this.inspectorButton) this.inspectorButton.style.display = '';
                if (this.sendButton) this.sendButton.style.display = '';
            });
        }

        // Load stored keys
        chrome.storage.sync.get(
          ['groqApiKey','openaiApiKey','AgentXApiKey','selectedModel','selectedProvider'],
          (result) => {
            if (result.groqApiKey)   this.groqAPI   = new GroqAPI(result.groqApiKey);
            if (result.openaiApiKey) this.openaiAPI = new OpenAIAPI(result.openaiApiKey);
            if (result.AgentXApiKey) this.AgentXAPI = new AgentXAPI(result.AgentXApiKey);
            this.selectedModel    = result.selectedModel    || '';
            this.selectedProvider = result.selectedProvider || '';
        });

        // Listen for changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.groqApiKey)       this.groqAPI   = new GroqAPI(changes.groqApiKey.newValue);
            if (changes.openaiApiKey)     this.openaiAPI = new OpenAIAPI(changes.openaiApiKey.newValue);
            if (changes.AgentXApiKey)   this.AgentXAPI = new AgentXAPI(changes.AgentXApiKey.newValue);
            if (changes.selectedModel)    this.selectedModel = changes.selectedModel.newValue;
            if (changes.selectedProvider) this.selectedProvider = changes.selectedProvider.newValue;
        });

        // Listen for SELECTED_DOM_CONTENT from content.js
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'SELECTED_DOM_CONTENT') {
                this.selectedDomContent = msg.content;
                this.inspectorButton.classList.add('has-content');
            }
        });

        // Send button
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Inspector button
        this.inspectorButton.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                    console.log('Cannot use inspector on this page');
                    return;
                }
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (error) {
                    if (!error.message.includes('already been injected')) {
                        throw error;
                    }
                }
                const port = chrome.tabs.connect(tab.id);
                port.postMessage({ type: 'TOGGLE_INSPECTOR', reset: true });
                this.isInspecting = !this.isInspecting;
                this.updateInspectorButtonState();
            } catch (error) {
                console.error('Inspector error:', error);
                this.addMessage('Failed to activate inspector. Please refresh and try again.', 'system');
                this.isInspecting = false;
                this.updateInspectorButtonState();
            }
        });

        // Run Test button
        if (this.runTestButton) {
            this.runTestButton.addEventListener('click', () => this.runCucumberTest());
        }

        // Push & Run button
        if (this.pushAndRunButton) {
            this.pushAndRunButton.addEventListener('click', () => this.pushToGitHubAndRun());
        }

    }

    // ===================
    // Markdown / Parsing
    // ===================
    initializeMarkdown() {
        const checkLibraries = setInterval(() => {
            if (window.marked && window.Prism) {
                
                window.marked.setOptions({
                    highlight: (code, lang) => {
                        // Normalize language name
                        let normalizedLang = lang?.toLowerCase().trim();
                        
                        // Map common language aliases
                        const languageMap = {
                            'feature': 'gherkin',
                            'cucumber': 'gherkin',
                            'bdd': 'gherkin'
                        };
                        
                        if (languageMap[normalizedLang]) {
                            normalizedLang = languageMap[normalizedLang];
                        }
                        
                        if (normalizedLang && Prism.languages[normalizedLang]) {
                            try {
                                return Prism.highlight(code, Prism.languages[normalizedLang], normalizedLang);
                            } catch (e) {
                                console.error('Prism highlight error:', e);
                                return code;
                            }
                        }
                        return code;
                    },
                    langPrefix: 'language-',
                    breaks: true,
                    gfm: true
                });
                const renderer = new marked.Renderer();
            renderer.code = (code, language) => {
                console.log('🎨 Rendering code block:', { language, codeLength: code?.length });
                
                if (typeof code === 'object') {
                    if (code.text) {
                        code = code.text;
                    } else if (code.raw) {
                        code = code.raw.replace(/^```[\\w]*\\n/, '').replace(/\\n```$/, '');
                    } else {
                        code = JSON.stringify(code, null, 2);
                    }
                }
                
                // Normalize language name
                let validLanguage = language?.toLowerCase().trim() || 'typescript';
                console.log('Original language:', language, '-> Normalized:', validLanguage);
                
                // Map common language aliases
                const languageMap = {
                    'feature': 'gherkin',
                    'cucumber': 'gherkin',
                    'bdd': 'gherkin',
                    'js': 'javascript',
                    'ts': 'typescript',
                    'py': 'python',
                    'cs': 'csharp'
                };
                
                if (languageMap[validLanguage]) {
                    console.log('Language mapped:', validLanguage, '->', languageMap[validLanguage]);
                    validLanguage = languageMap[validLanguage];
                }
                
                let highlighted = code;
                
                // Check if Prism language is available
                if (validLanguage && Prism.languages[validLanguage]) {
                    try {
                        console.log('Highlighting with Prism for language:', validLanguage);
                        highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                        console.log('✅ Highlighting successful');
                    } catch (e) {
                        console.error('❌ Highlighting failed for', validLanguage, ':', e);
                        highlighted = code;
                    }
                } else {
                    console.warn('⚠️ Language not supported by Prism:', validLanguage);
                }
                
                const result = `<pre class=\"language-${validLanguage}\"><code class=\"language-${validLanguage}\">${highlighted}</code></pre>`;
                console.log('Final HTML classes:', `language-${validLanguage}`);
                return result;
            };
                window.marked.setOptions({ renderer });
                this.markdownReady = true;
                clearInterval(checkLibraries);
            }
        }, 100);
    }



    parseMarkdown(content) {
        if (!this.markdownReady) {
            return `<pre>${content}</pre>`;
        }
        let textContent;
        if (typeof content === 'string') {
            const match = content.match(/^```(\w+)/);
            textContent = content.replace(/^```\w+/, '```');
        } else if (typeof content === 'object') {
            textContent = content.content || 
                         content.message?.content ||
                         content.choices?.[0]?.message?.content ||
                         JSON.stringify(content, null, 2);
        } else {
            textContent = String(content);
        }
        let processedContent = textContent
            .replace(/&#x60;/g, '`')
            .replace(/&grave;/g, '`')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/```(\w*)/g, '\n```$1\n')
            .replace(/```\s*$/g, '\n```\n')
            .replace(/\n{3,}/g, '\n\n');
        try {
            const renderer = new marked.Renderer();
            renderer.code = (code, language) => {
                if (typeof code === 'object') {
                    if (code.text) {
                        code = code.text;
                    } else if (code.raw) {
                        code = code.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                    } else {
                        code = JSON.stringify(code, null, 2);
                    }
                }
                const validLanguage = language?.toLowerCase().trim() || 'typescript';
                let highlighted = code;
                if (validLanguage && Prism.languages[validLanguage]) {
                    try {
                        highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                    } catch (e) {
                        console.error('Highlighting failed:', e);
                    }
                }
                return `<pre class="language-${validLanguage}"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
            };
            window.marked.setOptions({ renderer });
            const parsed = window.marked.parse(processedContent);
            
            // Apply syntax highlighting after DOM is updated
            setTimeout(() => {
                const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
                console.log('📝 Post-parse highlighting for', codeBlocks.length, 'code blocks');
                
                codeBlocks.forEach((block, index) => {
                    // Standard Prism highlighting for all languages
                    try {
                        Prism.highlightElement(block);
                    } catch (e) {
                        console.error('Prism highlighting error:', e);
                    }
                });
            }, 100);
            
            return parsed;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre>${textContent}</pre>`;
        }
    }



    // =============
    // Send Message
    // =============
    async sendMessage() {
        const userMsg = this.inputField.value.trim();
        let apiRef = null;
        this.isInspecting = false;
        this.updateInspectorButtonState();
      
        if (this.selectedProvider === 'groq') apiRef = this.groqAPI;
        else if (this.selectedProvider === 'openai') apiRef = this.openaiAPI;
        else apiRef = this.AgentXAPI;
        if (!apiRef) {
          this.addMessage(`Please set your ${this.selectedProvider} API key in the Settings tab.`, 'system');
          return;
        }

        if (!this.selectedDomContent) {
            this.addMessage('Please select some DOM on the page first.', 'system');
            return;
        }

        // --- Retain only 3 <option> elements in <select> tags to simulate real data ---
        function stripExtraOptions(selectElement) {
            const options = selectElement.querySelectorAll('option');
            if (options.length > 3) {
                for (let i = 3; i < options.length; i++) {
                    options[i].remove();
                }
            }
        }

        let domContentProcessed = this.selectedDomContent;
        if (typeof domContentProcessed === 'string') {
            // Parse string to DOM
            const parser = new DOMParser();
            const doc = parser.parseFromString(domContentProcessed, 'text/html');
            const selects = doc.querySelectorAll('select');
            selects.forEach(stripExtraOptions);
            // Serialize back to string
            domContentProcessed = doc.body.innerHTML;
        } else if (domContentProcessed instanceof HTMLElement) {
            // Directly process if it's an HTMLElement
            const selects = domContentProcessed.querySelectorAll('select');
            selects.forEach(stripExtraOptions);
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pageUrl = tab?.url || 'unknown';
            const lang = this.languageBindingSelect.value;
            const eng = this.browserEngineSelect.value;
            const promptKeys = this.getPromptKeys(lang, eng);
            // Keep lastPromptKeys for UI decisions about which buttons to show
            this.lastPromptKeys = promptKeys;

            const finalSnippet = typeof domContentProcessed === 'string'
                ? domContentProcessed
                : JSON.stringify(domContentProcessed, null, 2);

            this.sendButton.disabled = true;
            this.inputField.disabled = true;
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            this.addMessage(userMsg, 'user');
            this.inputField.value = '';

            let combinedContent = '';
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            for (const key of promptKeys) {
                const builtPrompt = getPrompt(key, {
                    domContent: finalSnippet,
                    pageUrl: pageUrl,
                    userAction: '',
                });

                const finalPrompt = builtPrompt + " Additional Instructions: " + userMsg;
                const resp = await apiRef.sendMessage(finalPrompt, this.selectedModel);
                const returned = resp?.content || resp;
                combinedContent += returned.trim() + '\n\n';

                totalInputTokens += resp.usage?.input_tokens || 0;
                totalOutputTokens += resp.usage?.output_tokens || 0;
            }

            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();

            this.addMessageWithMetadata(combinedContent.trim(), 'assistant', {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens
            });

            this.selectedDomContent = null;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.isInspecting = false;
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SELECTION' });
                } catch (err) {
                    const port = chrome.tabs.connect(tab.id);
                    port.postMessage({ type: 'CLEAR_SELECTION' });
                    port.disconnect();
                }
            }
            this.generatedCode = combinedContent.trim();
        } catch (err) {
            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();
            this.addMessage(`Error: ${err.message}`, 'system');
        } finally {
            this.sendButton.disabled = false;
            this.inputField.disabled = false;
            this.sendButton.innerHTML = 'Generate';
        }
    }
      

    // ==============
    // addMessage UI
    // ==============
    addMessage(content, type) {
        if (!content) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${type}-message`;
        if (type === 'system') {
            msgDiv.innerHTML = content;
        } else {
            const markdownDiv = document.createElement('div');
            markdownDiv.className = 'markdown-content';
            markdownDiv.innerHTML = this.parseMarkdown(content);
            msgDiv.appendChild(markdownDiv);
        }
        this.messagesContainer.appendChild(msgDiv);
        if (type === 'user') {
            const loader = document.createElement('div');
            loader.className = 'loading-indicator';
            const genType = this.codeGeneratorType.includes('PLAYWRIGHT') ? 'Playwright' : 'Selenium';
            loader.innerHTML = `
              <div class="loading-spinner"></div>
              <span class="loading-text">Generating ${genType} Code</span>
            `;
            this.messagesContainer.appendChild(loader);
            setTimeout(() => loader.classList.add('active'), 0);
        }
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        const msgCount = this.messagesContainer.querySelectorAll('.chat-message').length;
        if (msgCount > 1 && this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }

    addMessageWithMetadata(content, type, metadata) {
        if (type !== 'assistant') {
            this.addMessage(content, type);
            return;
        }
        const container = document.createElement('div');
        container.className = 'assistant-message';
        const mdDiv = document.createElement('div');
        mdDiv.className = 'markdown-content';
        mdDiv.innerHTML = this.parseMarkdown(content);
        container.appendChild(mdDiv);
        const metaContainer = document.createElement('div');
        metaContainer.className = 'message-metadata collapsed';
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'metadata-toggle';
        actions.appendChild(toggleBtn);

        // Make the assistant message selectable so bottom buttons can act on it.
        container.addEventListener('click', (e) => {
            // Avoid toggling when clicking inside metadata controls
            if (e.target && (e.target.classList && (e.target.classList.contains('metadata-toggle') || e.target.classList.contains('small-button')))) return;
            // Clear previous selection
            const prev = this.messagesContainer.querySelector('.assistant-message.selected-assistant');
            if (prev) prev.classList.remove('selected-assistant');
            container.classList.add('selected-assistant');
            this.selectedMessageMdDiv = mdDiv;
            // Show bottom copy buttons when a message is selected (decide which ones)
            this.updateBottomCopyButtons(mdDiv);
        });
        metaContainer.appendChild(actions);
        const details = document.createElement('div');
        details.className = 'metadata-content';
        details.innerHTML = `
          <div class="metadata-row"><span>Input Tokens:</span><span>${metadata.inputTokens}</span></div>
          <div class="metadata-row"><span>Output Tokens:</span><span>${metadata.outputTokens}</span></div>
        `;
        metaContainer.appendChild(details);
        container.appendChild(metaContainer);
        this.messagesContainer.appendChild(container);
        // Keep latest generated content available (global copy button intentionally hidden)
        this.generatedCode = content;
        // reveal bottom feature/code copy buttons when assistant content is present
        this.updateBottomCopyButtons(mdDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        if (this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }
    
    updateInspectorButtonState() {
        if (this.isInspecting) {
            this.inspectorButton.classList.add('active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Stop</span>
            `;
        } else {
            this.inspectorButton.classList.remove('active');
            if (!this.selectedDomContent) {
                this.inspectorButton.classList.remove('has-content');
            }
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
        }
    }

    // Decide which bottom copy buttons should be visible for a given assistant message
    updateBottomCopyButtons(mdDiv) {
        let showFeature = false;
        let showCode = false;

        // Prefer explicit information from the last prompt keys (set during sendMessage)
        if (this.lastPromptKeys && Array.isArray(this.lastPromptKeys) && this.lastPromptKeys.length) {
            const keys = this.lastPromptKeys.join(' ').toLowerCase();
            if (keys.includes('cucumber') || keys.includes('cucumber_only') || keys.includes('cucumber_with') || keys.includes('cucumber_with') || keys.includes('cucumber') || keys.includes('feature')) showFeature = true;
            if (keys.includes('page') || keys.includes('page_only') || keys.includes('selenium') || keys.includes('playwright') || keys.includes('page') || keys.includes('page_only')) showCode = true;
        } else if (mdDiv) {
            // Fallback: inspect rendered content for Gherkin or code blocks
            const hasGherkin = !!mdDiv.querySelector('pre code[class*="language-gherkin"], code[class*="language-gherkin"], pre code[class*="language-feature"], code[class*="language-feature"]') || /Feature:/i.test(mdDiv.textContent || '');
            const hasCode = !!mdDiv.querySelector('pre code[class*="language-"]') && !hasGherkin;
            showFeature = hasGherkin;
            showCode = hasCode;
        }

        if (this.copyFeatureBottomBtn) this.copyFeatureBottomBtn.style.display = showFeature ? 'inline-block' : 'none';
        if (this.copyCodeBottomBtn) this.copyCodeBottomBtn.style.display = showCode ? 'inline-block' : 'none';
    }

    getPromptKeys(language, engine) {
        const checkboxes = Array.from(document.querySelectorAll('input[name="javaGenerationMode"]:checked'));
        const promptKeys = [];
        const lang = language?.toLowerCase() || '';
        const eng = engine?.toLowerCase() || '';

    // Extract selected generation modes
    const isFeatureChecked = checkboxes.some(box => box.value === 'FEATURE');
    const isPageChecked = checkboxes.some(box => box.value === 'PAGE');
    const isTestDataChecked = checkboxes.some(box => box.value === 'TESTDATA');

        // Validate that at least one option is selected
        if (!isFeatureChecked && !isPageChecked) {
            console.warn('No generation mode selected. Defaulting to Page Object generation.');
            // If user explicitly requested only Test Data (no Page/Feature), return TEST_DATA_ONLY only
            if (isTestDataChecked) {
                promptKeys.push('TEST_DATA_ONLY');
                return promptKeys;
            }

            // Default fallback to page object generation
            if (this.isJavaSelenium(lang, eng)) {
                promptKeys.push('SELENIUM_JAVA_PAGE_ONLY');
            } else if (this.isTypeScriptPlaywright(lang, eng)) {
                promptKeys.push('PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY');
            } else {
                this.addUnsupportedLanguageMessage(lang, eng);
            }
            return promptKeys;
        }

        // Generate appropriate prompt keys based on selections and language/engine combination
        if (isFeatureChecked && isPageChecked) {
            // Both feature and page selected - generate combined output
            if (this.isJavaSelenium(lang, eng)) {
                promptKeys.push('CUCUMBER_WITH_SELENIUM_JAVA_STEPS');
            } else if (this.isTypeScriptPlaywright(lang, eng)) {
                // For Playwright/TypeScript, generate feature and page separately
                promptKeys.push('CUCUMBER_ONLY');
                promptKeys.push('PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY');
            } else {
                // For other unsupported combinations
                promptKeys.push('CUCUMBER_ONLY');
                this.addUnsupportedLanguageMessage(lang, eng);
            }
        } else if (isFeatureChecked) {
            // Feature file only
            promptKeys.push('CUCUMBER_ONLY');
            if (isTestDataChecked) {
                promptKeys.push('TEST_DATA_ONLY');
            }
        } else if (isPageChecked) {
            // Page object only
            if (this.isJavaSelenium(lang, eng)) {
                promptKeys.push('SELENIUM_JAVA_PAGE_ONLY');
            }else if (this.isTypeScriptPlaywright(lang, eng)) {
                promptKeys.push('PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY');
            }  else {
                this.addUnsupportedLanguageMessage(lang, eng);
            }
            if (isTestDataChecked) {
                promptKeys.push('TEST_DATA_ONLY');
            }
        }

        return promptKeys;
    }

    /**
     * Helper method to check if the combination is Java + Selenium
     */
    isJavaSelenium(language, engine) {
        return language === 'java' && engine === 'selenium';
    }

    isCSharpSelenium(language, engine) {
        return language === 'csharp' && engine === 'selenium';
    }

    isPythonSelenium(language, engine) {
        return language === 'python' && engine === 'selenium';
    }

    // typescript/selenium not supported by the selenium webdriver
    isTypeScriptPlaywright(language, engine){
        return language === 'ts' && engine === 'playwright';
    }


    /**
     * Helper method to show unsupported language/engine combination message
     */
    addUnsupportedLanguageMessage(language, engine) {
        const message = `⚠️ ${language}/${engine} combination is not yet supported. Only Java/Selenium and TypeScript/Playwright combinations are currently available.`;
        this.addMessage(message, 'system');
    }

    async initializeCodeGeneratorType() {
        const { codeGeneratorType } = await chrome.storage.sync.get(['codeGeneratorType']);
        if (codeGeneratorType) {
            this.codeGeneratorType = codeGeneratorType;
            const codeGenDrop = document.getElementById('codeGeneratorType');
            if (codeGenDrop) codeGenDrop.value = this.codeGeneratorType;
        }
    }

    async initializeTokenThreshold() {
        const { tokenWarningThreshold } = await chrome.storage.sync.get(['tokenWarningThreshold']);
        if (tokenWarningThreshold) {
            this.tokenWarningThreshold = tokenWarningThreshold;
        }
        const threshInput = document.getElementById('tokenThreshold');
        if (threshInput) {
            threshInput.value = this.tokenWarningThreshold;
            threshInput.addEventListener('change', async (e) => {
                const val = parseInt(e.target.value,10);
                if (val >= 100) {
                    this.tokenWarningThreshold = val;
                    await chrome.storage.sync.set({ tokenWarningThreshold: val });
                } else {
                    e.target.value = this.tokenWarningThreshold;
                }
            });
        }
    }







    async resetChat() {
        try {
            this.messagesContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                </div>
            `;
            this.selectedDomContent = null;
            this.isInspecting       = false;
            this.markdownReady      = false;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.inputField.value = '';
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Generate';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' });
                } catch (err) {
                    console.log('Cleanup error:', err);
                }
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (err) {
                    if (!err.message.includes('already been injected')) {
                        console.error('Re-inject error:', err);
                    }
                }
            }
            if (this.resetButton) {
                this.resetButton.classList.remove('visible');
            }
            // Hide auxiliary action buttons so only Inspect + Generate remain
            if (this.runTestButton) this.runTestButton.style.display = 'none';
            if (this.pushAndRunButton) this.pushAndRunButton.style.display = 'none';
            if (this.globalCopyButton) this.globalCopyButton.style.display = 'none';
            if (this.copyFeatureBottomBtn) this.copyFeatureBottomBtn.style.display = 'none';
            if (this.copyCodeBottomBtn) this.copyCodeBottomBtn.style.display = 'none';
            // Ensure Inspect and Generate buttons are visible
            if (this.inspectorButton) this.inspectorButton.style.display = '';
            if (this.sendButton) this.sendButton.style.display = '';
            this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');
        } catch (err) {
            console.error('Error resetting chat:', err);
            this.addMessage('Error resetting chat. Please close and reopen.', 'system');
        }
    }
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ChatUI();
});
