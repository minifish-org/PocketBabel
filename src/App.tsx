import { useEffect, useRef, useState } from 'react';
import './App.css';
import { requestOpenAICompatibleSpeech } from './lib/apiSpeech';
import { translateWithOpenAICompatibleApi } from './lib/apiTranslation';
import {
  readProviderSettings,
  writeProviderSettings,
  type ProviderSettings,
} from './lib/providerSettings';
import {
  DEFAULT_DIRECTION,
  getDirectionChangeTextState,
  getDirectionDefinition,
  swapDirection,
  type Direction,
} from './lib/translation';

function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const speechRequestIdRef = useRef(0);
  const [direction, setDirection] = useState<Direction>(DEFAULT_DIRECTION);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const apiSpeechSupported =
    typeof window !== 'undefined' &&
    'Audio' in window &&
    'URL' in window &&
    typeof window.URL.createObjectURL === 'function';
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    () => !window.matchMedia('(max-width: 900px)').matches,
  );
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(() =>
    readProviderSettings(),
  );

  const canSpeakOutput = speechSupported || apiSpeechSupported;

  const definition = getDirectionDefinition(direction);
  const sourceCount = inputText.trim().length;
  const outputCount = outputText.trim().length;
  const outputPlaceholder = 'Translation appears here';

  function updateProviderSettings(nextSettings: ProviderSettings) {
    cancelSpeechPlayback();
    setProviderSettings(nextSettings);
    writeProviderSettings(nextSettings);
    setErrorMessage('');
    setOutputText('');
    setCopyState('idle');
  }

  function handleDirectionChange(nextDirection: Direction) {
    if (nextDirection === direction) {
      return;
    }

    const nextTextState = getDirectionChangeTextState(inputText, outputText);

    setDirection(nextDirection);
    setInputText(nextTextState.sourceText);
    setOutputText(nextTextState.translatedText);
    setErrorMessage('');
    setCopyState('idle');
    setIsEditingSource(false);
  }

  function handleSwap() {
    handleDirectionChange(swapDirection(direction));
  }

  function handleDirectionKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (isBusy) {
      return;
    }
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    if (!horizontal && !vertical) {
      return;
    }
    event.preventDefault();
    const next = swapDirection(direction);
    handleDirectionChange(next);
    const selector = next === 'en-zh' ? 'first-of-type' : 'last-of-type';
    event.currentTarget
      .querySelector<HTMLButtonElement>(`.direction-tab:${selector}`)
      ?.focus();
  }

  async function handleTranslate() {
    const trimmed = inputText.trim();

    if (!trimmed) {
      setErrorMessage('Enter some text before translating.');
      setOutputText('');
      return;
    }

    setIsBusy(true);
    setErrorMessage('');
    setOutputText('');

    try {
      const output = await translateWithOpenAICompatibleApi(providerSettings, direction, trimmed);
      setOutputText(output);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown API translation error.');
      setOutputText('');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCopyOutput() {
    if (!outputText.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  function isCurrentSpeechRequest(requestId: number) {
    return speechRequestIdRef.current === requestId;
  }

  function clearApiSpeechAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }

    if (audioObjectUrlRef.current) {
      window.URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  }

  function cancelSpeechPlayback() {
    speechRequestIdRef.current += 1;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    clearApiSpeechAudio();
    setIsSpeaking(false);
  }

  function describeSpeechError(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown API TTS error.';
  }

  function startBrowserSpeech(text: string, requestId: number) {
    if (!isCurrentSpeechRequest(requestId)) {
      return;
    }

    clearApiSpeechAudio();

    if (!speechSupported || typeof SpeechSynthesisUtterance === 'undefined') {
      setIsSpeaking(false);
      setErrorMessage('Browser speech is unavailable in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = direction === 'en-zh' ? 'zh-CN' : 'en-US';
    utterance.onend = () => {
      if (isCurrentSpeechRequest(requestId)) {
        setIsSpeaking(false);
      }
    };
    utterance.onerror = () => {
      if (isCurrentSpeechRequest(requestId)) {
        setIsSpeaking(false);
        setErrorMessage('Browser speech failed.');
      }
    };
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function playApiSpeechAudio(audioBlob: Blob, text: string, requestId: number) {
    if (!isCurrentSpeechRequest(requestId)) {
      return;
    }

    clearApiSpeechAudio();
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    const objectUrl = window.URL.createObjectURL(audioBlob);
    const audio = new window.Audio(objectUrl);
    audioObjectUrlRef.current = objectUrl;
    audioRef.current = audio;
    audio.onended = () => {
      if (isCurrentSpeechRequest(requestId)) {
        clearApiSpeechAudio();
        setIsSpeaking(false);
      }
    };
    audio.onerror = () => {
      if (!isCurrentSpeechRequest(requestId)) {
        return;
      }

      clearApiSpeechAudio();
      if (speechSupported) {
        setErrorMessage('API TTS audio playback failed. Falling back to browser speech.');
        startBrowserSpeech(text, requestId);
      } else {
        setIsSpeaking(false);
        setErrorMessage('API TTS audio playback failed. Browser speech fallback is unavailable.');
      }
    };

    try {
      setIsSpeaking(true);
      await audio.play();
    } catch {
      clearApiSpeechAudio();
      throw new Error('API TTS audio playback failed.');
    }
  }

  useEffect(() => {
    cancelSpeechPlayback();
    return () => {
      cancelSpeechPlayback();
    };
  }, [outputText, direction, speechSupported]);

  async function handleSpeakOutput() {
    if (!canSpeakOutput) {
      return;
    }

    if (isSpeaking) {
      cancelSpeechPlayback();
      return;
    }

    const text = outputText.trim();
    if (!text) {
      return;
    }

    const requestId = speechRequestIdRef.current + 1;
    speechRequestIdRef.current = requestId;
    setIsSpeaking(true);
    setErrorMessage('');

    if (apiSpeechSupported) {
      try {
        const audio = await requestOpenAICompatibleSpeech(providerSettings, direction, text);
        await playApiSpeechAudio(audio, text, requestId);
        return;
      } catch (error) {
        if (!isCurrentSpeechRequest(requestId)) {
          return;
        }

        clearApiSpeechAudio();
        const message = describeSpeechError(error);
        if (speechSupported) {
          setErrorMessage(`API TTS failed: ${message} Falling back to browser speech.`);
          startBrowserSpeech(text, requestId);
        } else {
          setIsSpeaking(false);
          setErrorMessage(`API TTS failed: ${message} Browser speech fallback is unavailable.`);
        }
        return;
      }
    }

    startBrowserSpeech(text, requestId);
  }

  return (
    <main className={`shell ${isEditingSource ? 'shell-editing' : ''}`}>
      <section className="app-shell">
        <header className="app-header">
          <div className="brand-block">
            <p className="eyebrow">PocketBabel</p>
          </div>
        </header>

        <section
          className="direction-bar"
          role="tablist"
          aria-label="Translation direction"
          onKeyDown={handleDirectionKeyDown}
        >
          <button
            type="button"
            role="tab"
            aria-selected={direction === 'en-zh'}
            tabIndex={direction === 'en-zh' ? 0 : -1}
            className={`direction-tab ${direction === 'en-zh' ? 'direction-tab-active' : ''}`}
            onClick={() => handleDirectionChange('en-zh')}
            disabled={isBusy}
          >
            {'English -> Chinese'}
          </button>
          <button
            className="swap-button"
            type="button"
            onClick={handleSwap}
            disabled={isBusy}
            aria-label="Swap direction"
          >
            ⇄
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={direction === 'zh-en'}
            tabIndex={direction === 'zh-en' ? 0 : -1}
            className={`direction-tab ${direction === 'zh-en' ? 'direction-tab-active' : ''}`}
            onClick={() => handleDirectionChange('zh-en')}
            disabled={isBusy}
          >
            {'Chinese -> English'}
          </button>
        </section>

        <section className="settings-card" aria-label="Settings">
          <button
            type="button"
            className="settings-toggle"
            onClick={() => setIsSettingsOpen((current) => !current)}
            aria-expanded={isSettingsOpen}
            aria-controls="api-settings"
          >
            <span>Settings</span>
            <span className="settings-summary">
              {`API · ${providerSettings.model || 'No model'} · TTS ${providerSettings.ttsModel || 'No TTS model'}`}
            </span>
          </button>

          {isSettingsOpen && (
            <div id="api-settings" className="settings-panel">
              <div className="field-group">
                <label className="field-label" htmlFor="openai-base-url">
                  OpenAI Base URL
                </label>
                <input
                  id="openai-base-url"
                  type="url"
                  value={providerSettings.baseUrl}
                  onChange={(event) =>
                    updateProviderSettings({ ...providerSettings, baseUrl: event.target.value })
                  }
                  disabled={isBusy}
                  spellCheck={false}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="api-key">
                  API Key
                </label>
                <div className="api-key-control">
                  <input
                    id="api-key"
                    type={isApiKeyVisible ? 'text' : 'password'}
                    value={providerSettings.apiKey}
                    onChange={(event) =>
                      updateProviderSettings({ ...providerSettings, apiKey: event.target.value })
                    }
                    disabled={isBusy}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="api-key-toggle"
                    onClick={() => setIsApiKeyVisible((current) => !current)}
                    disabled={isBusy}
                    aria-label={isApiKeyVisible ? 'Hide API key' : 'Show API key'}
                  >
                    {isApiKeyVisible ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10.7 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.2" />
                        <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
                        <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.6" />
                        <path d="m2 2 20 20" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="api-model">
                  Model
                </label>
                <input
                  id="api-model"
                  type="text"
                  value={providerSettings.model}
                  onChange={(event) =>
                    updateProviderSettings({ ...providerSettings, model: event.target.value })
                  }
                  disabled={isBusy}
                  spellCheck={false}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="api-tts-model">
                  TTS Model
                </label>
                <input
                  id="api-tts-model"
                  type="text"
                  value={providerSettings.ttsModel}
                  onChange={(event) =>
                    updateProviderSettings({ ...providerSettings, ttsModel: event.target.value })
                  }
                  disabled={isBusy}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </section>

        {errorMessage && (
          <div className="error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="workspace">
          <div className="editor-card">
            <div className="editor-head">
              <strong className="editor-title">{definition.sourceLabel}</strong>
              <div className="editor-actions">
                <span className="editor-stat">{sourceCount} chars</span>
              </div>
            </div>
            <textarea
              id="source-text"
              rows={8}
              value={inputText}
              onChange={(event) => {
                setInputText(event.target.value);
                setCopyState('idle');
              }}
              onFocus={() => setIsEditingSource(true)}
              onBlur={() => setIsEditingSource(false)}
              placeholder={definition.sampleInput}
            />
          </div>

          <div className="editor-card">
            <div className="editor-head">
              <strong className="editor-title">{definition.targetLabel}</strong>
              <div className="editor-actions">
                <span className="editor-stat">{outputCount} chars</span>
                {canSpeakOutput && (
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={handleSpeakOutput}
                    disabled={!outputText.trim()}
                  >
                    {isSpeaking ? 'Stop' : 'Speak'}
                  </button>
                )}
                <button type="button" className="ghost-chip" onClick={handleCopyOutput} disabled={!outputText.trim()}>
                  {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
                </button>
              </div>
            </div>
            <textarea
              id="translated-text"
              rows={8}
              value={outputText}
              readOnly
              placeholder={outputPlaceholder}
            />
          </div>
        </section>

        <section className="actions actions-single">
          <button type="button" className="primary-action" onClick={handleTranslate} disabled={isBusy}>
            Translate
          </button>
        </section>
      </section>
    </main>
  );
}

export default App;
