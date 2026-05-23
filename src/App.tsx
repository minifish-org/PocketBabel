import { useEffect, useRef, useState } from 'react';
import './App.css';
import { translateWithOpenAICompatibleApi } from './lib/apiTranslation';
import { clearManagedModelCaches } from './lib/cache';
import { getOfflineActionError, getRuntimeSupport } from './lib/runtime';
import {
  readProviderSettings,
  writeProviderSettings,
  type ProviderSettings,
} from './lib/providerSettings';
import {
  DEFAULT_DIRECTION,
  DIRECTIONS,
  createEmptyOfflineAvailability,
  getDirectionChangeTextState,
  getDirectionDefinition,
  swapDirection,
  type Direction,
  type ModelStatus,
} from './lib/translation';
import { clearModelMetadata, readOfflineAvailability, writeModelReady } from './lib/modelMetadata';

type WorkerMessage =
  | { status: 'status'; phase: 'downloading' | 'ready' | 'checking'; direction: Direction }
  | {
      status: 'progress';
      direction: Direction;
      file: string;
      progress: number;
      loaded: number;
      total: number;
    }
  | { status: 'translated'; direction: Direction; output: string }
  | { status: 'error'; direction: Direction; message: string };

function App() {
  const workerRef = useRef<Worker | null>(null);
  const [direction, setDirection] = useState<Direction>(DEFAULT_DIRECTION);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [modelStatus, setModelStatus] = useState<ModelStatus>('checking');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [offlineAvailability, setOfflineAvailability] = useState(createEmptyOfflineAvailability());
  const [isBusy, setIsBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const [runtimeError, setRuntimeError] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    () => !window.matchMedia('(max-width: 900px)').matches,
  );
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(() =>
    readProviderSettings(),
  );

  const isApiMode = providerSettings.mode === 'api';

  useEffect(() => {
    if (isApiMode) {
      setRuntimeError('');
      setModelStatus(providerSettings.apiKey.trim() ? 'ready' : 'not_downloaded');
      setIsBusy(false);
      return;
    }

    const support = getRuntimeSupport();

    if (!support.supported) {
      setRuntimeError(
        `This browser is missing required features: ${support.missing.join(', ')}.`,
      );
      setModelStatus('error');
      return;
    }

    setRuntimeError('');
  }, [isApiMode, providerSettings.apiKey]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (isApiMode || runtimeError) {
      return;
    }

    workerRef.current ??= new Worker(new URL('./workers/translator.worker.ts', import.meta.url), {
      type: 'module',
    });

    const onMessage = async (event: MessageEvent<WorkerMessage>) => {
      const payload = event.data;

      if (payload.direction !== direction) {
        if (payload.status === 'status' && payload.phase === 'ready') {
          await writeModelReady(payload.direction, true);
          setOfflineAvailability((current) => ({
            ...current,
            [payload.direction]: true,
          }));
        }
        return;
      }

      switch (payload.status) {
        case 'status':
          setErrorMessage('');
          setProgress(0);
          setProgressLabel('');

          if (payload.phase === 'checking') {
            setModelStatus('checking');
            setIsBusy(true);
          } else if (payload.phase === 'downloading') {
            setModelStatus('downloading');
            setIsBusy(true);
          } else {
            setModelStatus('ready');
            setIsBusy(false);
            await writeModelReady(payload.direction, true);
            setOfflineAvailability((current) => ({
              ...current,
              [payload.direction]: true,
            }));
          }
          break;
        case 'progress':
          setModelStatus('downloading');
          setIsBusy(true);
          setProgress(payload.progress);
          setProgressLabel(payload.file);
          break;
        case 'translated':
          setOutputText(payload.output);
          setModelStatus('ready');
          setIsBusy(false);
          setErrorMessage('');
          await writeModelReady(payload.direction, true);
          setOfflineAvailability((current) => ({
            ...current,
            [payload.direction]: true,
          }));
          break;
        case 'error':
          setModelStatus('error');
          setIsBusy(false);
          setErrorMessage(payload.message);
          setOutputText('');
          await writeModelReady(payload.direction, false);
          setOfflineAvailability((current) => ({
            ...current,
            [payload.direction]: false,
          }));
          break;
      }
    };

    workerRef.current.addEventListener('message', onMessage);
    return () => workerRef.current?.removeEventListener('message', onMessage);
  }, [direction, runtimeError, isApiMode]);

  useEffect(() => {
    if (isApiMode) {
      setProgress(0);
      setProgressLabel('');
      setErrorMessage('');
      setModelStatus(providerSettings.apiKey.trim() ? 'ready' : 'not_downloaded');
      setIsBusy(false);
      return;
    }

    if (runtimeError) {
      return;
    }

    let cancelled = false;

    async function loadMetadata() {
      try {
        const availability = await readOfflineAvailability();
        if (!cancelled) {
          setOfflineAvailability(availability);
          if (availability[direction]) {
            setModelStatus('checking');
            setIsBusy(true);
            workerRef.current?.postMessage({ type: 'preload', direction });
          } else {
            setModelStatus('not_downloaded');
            setIsBusy(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setModelStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to read offline model metadata.',
          );
        }
      }
    }

    void loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [direction, runtimeError, isApiMode, providerSettings.apiKey]);

  const definition = getDirectionDefinition(direction);
  const sourceCount = inputText.trim().length;
  const outputCount = outputText.trim().length;
  const outputPlaceholder =
    isApiMode
      ? 'Translation appears here'
      : !offlineAvailability[direction] && !isOnline
        ? 'Go online once to download this direction.'
        : !offlineAvailability[direction]
          ? 'First translation will download this model.'
          : 'Translation appears here';

  function updateProviderSettings(nextSettings: ProviderSettings) {
    setProviderSettings(nextSettings);
    writeProviderSettings(nextSettings);
    setErrorMessage('');
    setOutputText('');
    setProgress(0);
    setProgressLabel('');
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
    setProgress(0);
    setProgressLabel('');
    setCopyState('idle');
    setIsEditingSource(false);
  }

  function handleSwap() {
    handleDirectionChange(swapDirection(direction));
  }

  async function handleTranslate() {
    const trimmed = inputText.trim();

    if (!isApiMode && runtimeError) {
      setModelStatus('error');
      setErrorMessage(runtimeError);
      setOutputText('');
      return;
    }

    if (!trimmed) {
      setModelStatus('error');
      setErrorMessage('Enter some text before translating.');
      setOutputText('');
      return;
    }

    if (isApiMode) {
      setIsBusy(true);
      setModelStatus('translating');
      setErrorMessage('');
      setOutputText('');

      try {
        const output = await translateWithOpenAICompatibleApi(providerSettings, direction, trimmed);
        setOutputText(output);
        setModelStatus('ready');
      } catch (error) {
        setModelStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown API translation error.');
        setOutputText('');
      } finally {
        setIsBusy(false);
      }
      return;
    }

    const offlineError = getOfflineActionError(offlineAvailability[direction], isOnline);

    if (offlineError) {
      setModelStatus('error');
      setErrorMessage(offlineError);
      setOutputText('');
      return;
    }

    setIsBusy(true);
    setModelStatus(offlineAvailability[direction] ? 'translating' : 'downloading');
    setErrorMessage('');
    setOutputText('');
    workerRef.current?.postMessage({
      type: 'translate',
      direction,
      text: trimmed,
    });
  }

  async function handleClearModels() {
    setModelStatus('clearing');
    setIsBusy(true);
    setErrorMessage('');
    setOutputText('');

    try {
      workerRef.current?.postMessage({ type: 'reset' });
      await clearManagedModelCaches();
      await clearModelMetadata();
      setOfflineAvailability(createEmptyOfflineAvailability());
      setModelStatus('not_downloaded');
      setProgress(0);
      setProgressLabel('');
    } catch (error) {
      setModelStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to clear downloaded models.',
      );
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

  return (
    <main className={`shell ${isEditingSource ? 'shell-editing' : ''}`}>
      <section className="app-shell">
        <header className="app-header">
          <div className="brand-block">
            <p className="eyebrow">PocketBabel</p>
          </div>
        </header>

        <section className="direction-bar" aria-label="Translation direction">
          <button
            type="button"
            role="tab"
            aria-selected={direction === 'en-zh'}
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
            aria-controls="provider-settings"
          >
            <span>Settings</span>
            <span className="settings-summary">
              {isApiMode ? `API · ${providerSettings.model || 'No model'}` : 'Browser built-in'}
            </span>
          </button>

          {isSettingsOpen && (
            <div
              id="provider-settings"
              className={`settings-panel ${isApiMode ? 'settings-panel-api' : 'settings-panel-browser'}`}
            >
              <div className="field-group mode-group">
                <span className="field-label">Provider mode</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segment-button ${isApiMode ? 'segment-button-active' : ''}`}
                    aria-pressed={isApiMode}
                    onClick={() => updateProviderSettings({ ...providerSettings, mode: 'api' })}
                    disabled={isBusy}
                  >
                    API
                  </button>
                  <button
                    type="button"
                    className={`segment-button ${!isApiMode ? 'segment-button-active' : ''}`}
                    aria-pressed={!isApiMode}
                    onClick={() => updateProviderSettings({ ...providerSettings, mode: 'browser' })}
                    disabled={isBusy}
                  >
                    Browser built-in
                  </button>
                </div>
              </div>

              {isApiMode ? (
                <>
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
                </>
              ) : (
                <>
                  {DIRECTIONS.map((item) => (
                    <span
                      key={item}
                      className={`settings-cache-chip cache-chip ${offlineAvailability[item] ? 'cache-chip-ready' : 'cache-chip-idle'} ${item === direction ? 'cache-chip-current' : ''}`}
                    >
                      {item === 'en-zh' ? 'EN -> ZH' : 'ZH -> EN'}
                    </span>
                  ))}
                  <button
                    type="button"
                    className="ghost-button manage-button settings-clear-button"
                    onClick={handleClearModels}
                    disabled={isBusy}
                  >
                    Clear models
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {!isApiMode && !runtimeError && !errorMessage && !offlineAvailability[direction] && !isOnline && (
          <div className="inline-status" aria-live="polite">
            Go online once to download this direction.
          </div>
        )}

        {(runtimeError || errorMessage) && (
          <div className="error-banner" role="alert">
            {runtimeError || errorMessage}
          </div>
        )}

        {modelStatus === 'downloading' && (
          <div className="progress-block" aria-live="polite">
            <div className="progress-heading">
              <span>{progressLabel || 'Downloading model'}</span>
              <strong>{progress.toFixed(0)}%</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
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
