import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Maximize2,
  Menu,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

type TickerMessage = { id: string; text: string; enabled: boolean };
type Preferences = { interval: number; soundEnabled: boolean; volume: number };
type StoredState = { messages: TickerMessage[]; preferences: Preferences };

const STORAGE_KEY = 'message-ticker-v1';
const DEFAULT_STATE: StoredState = {
  messages: [
    { id: 'm1', text: 'Welcome to the Riverside Community Open House. Make yourself at home.', enabled: true },
    { id: 'm2', text: 'The garden tour begins at 2:30 pm. Meet your guide beside the east entrance.', enabled: true },
    { id: 'm3', text: 'Refreshments are available in the courtyard. Please bring your cup back when finished.', enabled: true },
    { id: 'm4', text: 'A quiet room is available on the second floor if you need a moment to reset.', enabled: false },
  ],
  preferences: { interval: 12, soundEnabled: true, volume: 42 },
};

function SplitFlapText({ text, announcementId }: { text: string; announcementId: string }) {
  let tileIndex = 0;

  return (
    <span className="flap-copy" aria-hidden="true">
      {text.trim().split(/\s+/).filter(Boolean).map((word, wordIndex) => (
        <span className="flap-word" key={`${announcementId}-word-${wordIndex}`}>
          {Array.from(word).map((character) => {
            const index = tileIndex++;
            return (
              <span
                className="flap-tile"
                key={`${announcementId}-${index}-${character}`}
                style={{ animationDelay: `${Math.min(index * 6, 360)}ms` }}
              >
                <span>{character}</span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : DEFAULT_STATE.messages,
      preferences: { ...DEFAULT_STATE.preferences, ...parsed.preferences },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function Home() {
  const [saved, setSaved] = useState<StoredState>(loadState);
  const { messages, preferences } = saved;
  const [activeId, setActiveId] = useState(() => loadState().messages.find((item) => item.enabled)?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const appRef = useRef<HTMLElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastActiveId = useRef(activeId);

  const enabledMessages = useMemo(() => messages.filter((message) => message.enabled), [messages]);
  const activeMessage = enabledMessages.find((message) => message.id === activeId) ?? enabledMessages[0];
  const currentNumber = Math.max(0, enabledMessages.findIndex((message) => message.id === activeMessage?.id)) + 1;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // The ticker remains usable when browser storage is unavailable.
    }
  }, [saved]);

  useEffect(() => {
    if (!activeId && enabledMessages[0]) setActiveId(enabledMessages[0].id);
    if (activeId && !enabledMessages.some((message) => message.id === activeId)) {
      setActiveId(enabledMessages[0]?.id ?? '');
    }
  }, [activeId, enabledMessages]);

  const updatePreferences = (patch: Partial<Preferences>) => {
    setSaved((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  };

  const playChime = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return false;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      if (context.state === 'suspended') await context.resume();
      setAudioReady(true);
      const now = context.currentTime;
      const volume = preferences.volume / 100;
      const noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.085), context.sampleRate);
      const samples = noise.getChannelData(0);
      let previousNoise = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const white = Math.random() * 2 - 1;
        previousNoise = white * 0.72 + previousNoise * 0.28;
        samples[i] = previousNoise;
      }

      const addFlap = (start: number, strength: number) => {
        const snap = context.createBufferSource();
        const snapFilter = context.createBiquadFilter();
        const snapGain = context.createGain();
        snap.buffer = noise;
        snapFilter.type = 'bandpass';
        snapFilter.frequency.setValueAtTime(1150 + Math.random() * 1050, start);
        snapFilter.Q.setValueAtTime(0.75 + Math.random() * 0.7, start);
        snapGain.gain.setValueAtTime(0.0001, start);
        snapGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.12 * strength), start + 0.002);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.025);
        snap.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(context.destination);
        snap.start(start, Math.random() * 0.035, 0.026);
        snap.stop(start + 0.028);

        const body = context.createOscillator();
        const bodyGain = context.createGain();
        body.type = 'triangle';
        body.frequency.setValueAtTime(175 + Math.random() * 75, start);
        body.frequency.exponentialRampToValueAtTime(58 + Math.random() * 18, start + 0.048);
        bodyGain.gain.setValueAtTime(0.0001, start);
        bodyGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.085 * strength), start + 0.003);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.052);
        body.connect(bodyGain);
        bodyGain.connect(context.destination);
        body.start(start);
        body.stop(start + 0.055);
      };

      const motor = context.createOscillator();
      const motorFilter = context.createBiquadFilter();
      const motorGain = context.createGain();
      const motorEnd = 0.92;
      motor.type = 'sawtooth';
      motor.frequency.setValueAtTime(58, now);
      motor.frequency.exponentialRampToValueAtTime(43, now + motorEnd);
      motorFilter.type = 'lowpass';
      motorFilter.frequency.setValueAtTime(170, now);
      motorGain.gain.setValueAtTime(0.0001, now);
      motorGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.012), now + 0.08);
      motorGain.gain.setValueAtTime(Math.max(0.0002, volume * 0.012), now + 0.68);
      motorGain.gain.exponentialRampToValueAtTime(0.0001, now + motorEnd);
      motor.connect(motorFilter);
      motorFilter.connect(motorGain);
      motorGain.connect(context.destination);
      motor.start(now);
      motor.stop(now + motorEnd + 0.01);

      let elapsed = 0.018;
      for (let index = 0; index < 18; index += 1) {
        const strength = 0.72 + Math.random() * 0.42;
        addFlap(now + elapsed, strength);
        if (index % 3 === 1 || index === 16) addFlap(now + elapsed + 0.021, strength * 0.58);
        elapsed += 0.052 - Math.min(index, 12) * 0.0012 + Math.random() * 0.012;
      }
      addFlap(now + elapsed + 0.045, 1.18);
      return true;
    } catch {
      return false;
    }
  }, [preferences.volume]);

  const moveActive = useCallback((direction: number) => {
    if (!enabledMessages.length) return;
    const currentIndex = enabledMessages.findIndex((message) => message.id === activeId);
    const base = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (base + direction + enabledMessages.length) % enabledMessages.length;
    setActiveId(enabledMessages[nextIndex].id);
  }, [activeId, enabledMessages]);

  const moveActiveRef = useRef(moveActive);
  moveActiveRef.current = moveActive;

  useEffect(() => {
    if (!isPlaying || enabledMessages.length < 2) return;
    const timer = window.setInterval(() => moveActiveRef.current(1), preferences.interval * 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, preferences.interval, enabledMessages.length]);

  useEffect(() => {
    if (activeMessage?.id && activeMessage.id !== lastActiveId.current && preferences.soundEnabled && audioRef.current?.state === 'running') {
      void playChime();
    }
    lastActiveId.current = activeMessage?.id ?? '';
  }, [activeMessage?.id, playChime, preferences.soundEnabled]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => () => { void audioRef.current?.close(); }, []);

  const addMessage = () => {
    const message = { id: `msg-${Date.now()}`, text: 'Write your announcement here.', enabled: true };
    setSaved((current) => ({ ...current, messages: [...current.messages, message] }));
    setEditingId(message.id);
    setEditText(message.text);
  };

  const saveMessageEdit = (id: string) => {
    const text = editText.trim();
    if (!text) return;
    setSaved((current) => ({
      ...current,
      messages: current.messages.map((message) => message.id === id ? { ...message, text } : message),
    }));
    setEditingId(null);
  };

  const deleteMessage = (id: string) => {
    const message = messages.find((item) => item.id === id);
    if (!message || !window.confirm('Delete this announcement?')) return;
    setSaved((current) => ({ ...current, messages: current.messages.filter((item) => item.id !== id) }));
    if (activeId === id) setActiveId(enabledMessages.find((item) => item.id !== id)?.id ?? '');
    if (editingId === id) setEditingId(null);
  };

  const toggleMessage = (id: string) => {
    const target = messages.find((item) => item.id === id);
    if (!target) return;
    setSaved((current) => ({
      ...current,
      messages: current.messages.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item),
    }));
    if (target.enabled && activeId === id) {
      setActiveId(enabledMessages.find((item) => item.id !== id)?.id ?? '');
    }
  };

  const reorderMessage = (id: string, delta: number) => {
    setSaved((current) => {
      const index = current.messages.findIndex((message) => message.id === id);
      const targetIndex = index + delta;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.messages.length) return current;
      const next = [...current.messages];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...current, messages: next };
    });
  };

  const togglePlayback = async () => {
    if (!isPlaying) {
      if (!activeMessage && enabledMessages.length) setActiveId(enabledMessages[0].id);
      if (preferences.soundEnabled) {
        try {
          const Context = window.AudioContext;
          if (Context) {
            audioRef.current ??= new Context();
            if (audioRef.current.state === 'suspended') await audioRef.current.resume();
            setAudioReady(true);
          }
        } catch {
          setAudioReady(false);
        }
      }
      setIsPlaying(true);
    } else setIsPlaying(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await appRef.current?.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  const resetQueue = () => {
    if (!window.confirm('Restore the sample announcements and default settings? Your current queue will be replaced.')) return;
    setSaved(DEFAULT_STATE);
    setActiveId(DEFAULT_STATE.messages[0].id);
    setIsPlaying(false);
  };

  return (
    <main className={`ticker-shell${isFullscreen ? ' fullscreen' : ''}`} ref={appRef}>
      <header className="topbar">
        <button
          className="admin-menu-button"
          onClick={() => setAdminOpen((open) => !open)}
          aria-label={adminOpen ? 'Close admin console' : 'Open admin console'}
          aria-expanded={adminOpen}
          aria-controls="admin-console"
          data-testid="button-admin-menu"
        >
          {adminOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="top-actions">
          <div className="top-status" role="status" data-testid="status-playback">
            <span className={`status-dot${isPlaying ? ' live' : ''}`} />
            {isPlaying ? 'ON AIR' : 'STANDING BY'}
          </div>
          <button className="icon-button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} data-testid="button-fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="display-column" aria-label="Live ticker display">
          <section className="screen" aria-live="polite" aria-label="Announcement preview">
            <div className="announcement-wrap" key={activeMessage?.id ?? 'empty'}>
              {activeMessage ? (
                <>
                  <div className="announcement-number">ANNOUNCEMENT {String(currentNumber).padStart(2, '0')} <span style={{ color: '#78818c' }}>/ {String(enabledMessages.length).padStart(2, '0')}</span></div>
                  <h2 className="announcement" aria-label={activeMessage.text}><SplitFlapText text={activeMessage.text} announcementId={activeMessage.id} /></h2>
                  <div className="screen-subline">Thank you for being here.</div>
                </>
              ) : (
                <>
                  <div className="announcement-number">READY WHEN YOU ARE</div>
                  <h2 className="announcement" aria-label="Your next announcement starts here."><SplitFlapText text="Your next announcement starts here." announcementId="empty" /></h2>
                  <div className="screen-subline">Add a message to bring your display to life.</div>
                </>
              )}
            </div>
          </section>
        </section>
      </div>

      {adminOpen && (
        <section className="admin-console" id="admin-console" aria-label="Admin console">
          <div className="admin-console-header">
            <div className="admin-console-title"><Settings2 size={15} /> Admin console</div>
            <button className="secondary-button" onClick={resetQueue} aria-label="Restore sample queue" data-testid="button-reset">
              <RotateCcw size={13} /> <span>Reset</span>
            </button>
          </div>
          <div className="admin-transport">
            <button className="icon-button" onClick={() => moveActive(-1)} disabled={!enabledMessages.length} aria-label="Previous announcement" data-testid="button-previous"><ChevronLeft size={19} /></button>
            <button className="icon-button play-button" onClick={() => void togglePlayback()} disabled={!enabledMessages.length} aria-label={isPlaying ? 'Pause ticker' : 'Play ticker'} data-testid="button-play-pause">
              {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
            </button>
            <button className="icon-button" onClick={() => moveActive(1)} disabled={!enabledMessages.length} aria-label="Next announcement" data-testid="button-next"><ChevronRight size={19} /></button>
            <span className="admin-playing-label">{isPlaying ? 'Ticker is rotating' : 'Ticker is paused'}</span>
          </div>
        <aside className="control-column" aria-label="Ticker controls">
          <section className="panel">
            <div className="panel-header">
              <div className="panel-title"><AlignLeft size={15} /> Message queue</div>
              <span className="count-label">{messages.length} {messages.length === 1 ? 'MESSAGE' : 'MESSAGES'}</span>
            </div>
            {messages.length === 0 ? (
              <div className="empty-queue"><strong>A clear board.</strong>Add your first announcement and it will appear in the live display.</div>
            ) : (
              <div className="queue-list">
                {messages.map((message, index) => (
                  <div className="queue-item" key={message.id} data-testid={`row-message-${message.id}`}>
                    <span className="queue-index">{String(index + 1).padStart(2, '0')}</span>
                    {editingId === message.id ? (
                      <form className="edit-form" onSubmit={(event) => { event.preventDefault(); saveMessageEdit(message.id); }}>
                        <input
                          aria-label="Edit announcement text"
                          value={editText}
                          autoFocus
                          maxLength={220}
                          onChange={(event) => setEditText(event.target.value)}
                          data-testid={`input-message-${message.id}`}
                        />
                        <button className="mini-button" type="submit" aria-label="Save announcement" data-testid={`button-save-${message.id}`}><Check size={15} /></button>
                        <button className="mini-button" type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing"><X size={15} /></button>
                      </form>
                    ) : (
                      <button
                        className={`queue-message${message.enabled ? '' : ' disabled'}`}
                        onClick={() => { setEditingId(message.id); setEditText(message.text); }}
                        aria-label={`Edit announcement: ${message.text}`}
                        data-testid={`button-edit-${message.id}`}
                      >
                        {message.text}
                      </button>
                    )}
                    <div className="queue-actions">
                      <button className="mini-button" onClick={() => reorderMessage(message.id, -1)} disabled={index === 0} aria-label="Move announcement up" data-testid={`button-up-${message.id}`}><ArrowUp size={13} /></button>
                      <button className="mini-button" onClick={() => reorderMessage(message.id, 1)} disabled={index === messages.length - 1} aria-label="Move announcement down" data-testid={`button-down-${message.id}`}><ArrowDown size={13} /></button>
                      <button className={`toggle${message.enabled ? ' on' : ''}`} onClick={() => toggleMessage(message.id)} role="switch" aria-checked={message.enabled} aria-label={`${message.enabled ? 'Disable' : 'Enable'} announcement`} data-testid={`toggle-message-${message.id}`} />
                      <button className="mini-button" onClick={() => deleteMessage(message.id)} aria-label="Delete announcement" data-testid={`button-delete-${message.id}`}><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="add-row">
              <button className="add-button" onClick={addMessage} data-testid="button-add-message"><Plus size={15} /> Add an announcement</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="panel-title"><Settings2 size={15} /> Playback settings</div>
              <span className="count-label">AUTO-SAVED</span>
            </div>
            <div className="settings-body">
              <div className="setting-row">
                <div>
                  <div className="setting-label">Rotation interval</div>
                  <div className="setting-help">Time each message stays on screen</div>
                </div>
                <div className="interval-control">
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={preferences.interval}
                    aria-label="Rotation interval in seconds"
                    onChange={(event) => updatePreferences({ interval: Math.max(3, Math.min(300, Number(event.target.value) || 3)) })}
                    data-testid="input-interval"
                  />
                  <span className="unit-label">SEC</span>
                </div>
              </div>

              <div className="setting-row sound-row">
                <div>
                  <div className="setting-label">Announcement sound</div>
                  <div className="setting-help">A quiet mechanical click-clack on change</div>
                </div>
                <button
                  className={`toggle${preferences.soundEnabled ? ' on' : ''}`}
                  onClick={() => updatePreferences({ soundEnabled: !preferences.soundEnabled })}
                  role="switch"
                  aria-checked={preferences.soundEnabled}
                  aria-label="Enable announcement sound"
                  data-testid="toggle-sound"
                />
              </div>
              <div className="volume-wrap">
                <div className="volume-head"><span>VOLUME</span><span>{preferences.volume}%</span></div>
                <input type="range" min="0" max="100" value={preferences.volume} aria-label="Sound volume"
                  onChange={(event) => updatePreferences({ volume: Number(event.target.value) })} data-testid="input-volume" />
              </div>
              <div className="sound-foot">
                <span className={`audio-status${audioReady ? ' ready' : ''}`} role="status">
                  {audioReady ? <Check size={12} /> : <CircleHelp size={12} />}
                  {audioReady ? 'Audio is ready on this device' : 'Tap preview to enable browser audio'}
                </span>
                <button className="preview-button" onClick={() => void playChime()} data-testid="button-preview-sound">
                  {preferences.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />} Preview sound
                </button>
              </div>
            </div>
          </section>
        </aside>
        </section>
      )}
    </main>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

export default App;
