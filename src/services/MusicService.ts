const STORAGE_KEY = "rogue-piece-audio";

export type MusicMode = "ambient" | "combat" | "none";

export type AudioSettings = {
  muted: boolean;
  /** 0–1 master music volume */
  volume: number;
};

const AMBIENT_TRACKS = [
  "/audio/music/beyond-the-blue.mp3",
  "/audio/music/beyond-the-blue-2.mp3",
] as const;

const COMBAT_TRACKS = [
  "/audio/music/captains-duel.mp3",
  "/audio/music/uncertain-victory.mp3",
] as const;

/** Outgoing fades longer; incoming rises into the tail so the bed never drops dead. */
const CROSSFADE_OUT_MS = 1100;
const CROSSFADE_IN_MS = 900;
/** How much the fades overlap at the end of the out. */
const CROSSFADE_OVERLAP_MS = 380;
const STOP_FADE_MS = 500;
const FADE_TICK_MS = 40;

type Listener = (settings: AudioSettings) => void;

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { muted: false, volume: 0.55 };
    }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: Boolean(parsed.muted),
      volume: clampVolume(typeof parsed.volume === "number" ? parsed.volume : 0.55),
    };
  } catch {
    return { muted: false, volume: 0.55 };
  }
}

function clampVolume(value: number): number {
  if (Number.isNaN(value)) return 0.55;
  return Math.min(1, Math.max(0, value));
}

function saveSettings(next: AudioSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function pickTrack(pool: readonly string[], exclude?: string | null): string {
  if (pool.length === 1) return pool[0]!;
  const choices = exclude ? pool.filter((track) => track !== exclude) : [...pool];
  const list = choices.length ? choices : [...pool];
  return list[Math.floor(Math.random() * list.length)]!;
}

function poolFor(next: MusicMode): readonly string[] {
  return next === "combat" ? COMBAT_TRACKS : AMBIENT_TRACKS;
}

let settings = loadSettings();
let mode: MusicMode = "none";
let unlocked = false;
let currentTrack: string | null = null;
/** Channel currently meant to be the playing bed. */
let active: HTMLAudioElement | null = null;
/** Spare channel for crossfades. */
let spare: HTMLAudioElement | null = null;
const fadeTimers = new Set<number>();
const pendingTimeouts = new Set<number>();
let crossfadeToken = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(getSettings());
  }
}

function getSettings(): AudioSettings {
  return { ...settings };
}

function effectiveVolume(): number {
  return settings.muted ? 0 : settings.volume;
}

function clearAllFades(): void {
  for (const id of fadeTimers) {
    window.clearInterval(id);
  }
  fadeTimers.clear();
}

function clearPendingTimeouts(): void {
  for (const id of pendingTimeouts) {
    window.clearTimeout(id);
  }
  pendingTimeouts.clear();
}

function scheduleTimeout(fn: () => void, ms: number): void {
  const id = window.setTimeout(() => {
    pendingTimeouts.delete(id);
    fn();
  }, ms);
  pendingTimeouts.add(id);
}

function fadeElement(el: HTMLAudioElement, target: number, ms: number, onDone?: () => void): void {
  const start = el.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.01 || ms <= 0) {
    el.volume = target;
    onDone?.();
    return;
  }
  const steps = Math.max(6, Math.round(ms / FADE_TICK_MS));
  let step = 0;
  const timer = window.setInterval(() => {
    step += 1;
    el.volume = Math.min(1, Math.max(0, start + (delta * step) / steps));
    if (step >= steps) {
      window.clearInterval(timer);
      fadeTimers.delete(timer);
      el.volume = target;
      onDone?.();
    }
  }, FADE_TICK_MS);
  fadeTimers.add(timer);
}

function onTrackEnded(el: HTMLAudioElement): void {
  if (el !== active || mode === "none") return;
  const next = pickTrack(poolFor(mode), currentTrack);
  void startTrack(next, { crossfade: false });
}

function createChannel(): HTMLAudioElement {
  const el = new Audio();
  el.preload = "auto";
  el.addEventListener("ended", () => onTrackEnded(el));
  return el;
}

function ensureChannels(): void {
  if (!active) active = createChannel();
  if (!spare) spare = createChannel();
}

function stopElement(el: HTMLAudioElement | null): void {
  if (!el) return;
  el.pause();
  el.removeAttribute("src");
  try {
    el.load();
  } catch {
    // Ignore reset errors from empty media.
  }
}

function isPlaying(el: HTMLAudioElement | null): boolean {
  return Boolean(el && !el.paused && el.getAttribute("src"));
}

function applyVolumeImmediate(): void {
  const master = effectiveVolume();
  if (settings.muted) {
    if (active) active.volume = 0;
    if (spare) spare.volume = 0;
    return;
  }
  // Only snap the active bed when no fade is in progress.
  if (active && fadeTimers.size === 0) {
    active.volume = master;
  }
}

async function startTrack(
  src: string,
  options: { crossfade: boolean },
): Promise<void> {
  if (!unlocked || mode === "none") return;

  const token = ++crossfadeToken;
  clearAllFades();
  clearPendingTimeouts();
  ensureChannels();

  const master = effectiveVolume();
  const outgoing = active!;
  const incoming = spare!;
  const canCrossfade = options.crossfade && isPlaying(outgoing);

  currentTrack = src;
  incoming.src = src;
  incoming.loop = false;
  incoming.volume = 0;

  const promoteIncoming = () => {
    // Swap: incoming becomes the bed; old active becomes the spare.
    spare = outgoing;
    active = incoming;
  };

  if (!canCrossfade) {
    stopElement(outgoing);
    try {
      await incoming.play();
    } catch {
      return;
    }
    if (token !== crossfadeToken) return;
    promoteIncoming();
    fadeElement(incoming, master, 500);
    return;
  }

  // 1) Fade out the current bed.
  fadeElement(outgoing, 0, CROSSFADE_OUT_MS, () => {
    if (token !== crossfadeToken) return;
    stopElement(outgoing);
  });

  // 2) Near the end of the out, start the new track and fade it in.
  const overlapDelay = Math.max(0, CROSSFADE_OUT_MS - CROSSFADE_OVERLAP_MS);
  scheduleTimeout(() => {
    if (token !== crossfadeToken) return;
    void (async () => {
      try {
        await incoming.play();
      } catch {
        return;
      }
      if (token !== crossfadeToken) return;
      promoteIncoming();
      fadeElement(incoming, master, CROSSFADE_IN_MS);
    })();
  }, overlapDelay);
}

function stopPlayback(fade = true): void {
  const token = ++crossfadeToken;
  clearAllFades();
  clearPendingTimeouts();
  if (!active) return;
  if (!fade || active.paused) {
    stopElement(active);
    stopElement(spare);
    return;
  }
  const el = active;
  fadeElement(el, 0, STOP_FADE_MS, () => {
    if (token !== crossfadeToken) return;
    stopElement(el);
    stopElement(spare);
  });
}

export const MusicService = {
  getSettings,
  getMode(): MusicMode {
    return mode;
  },
  isUnlocked(): boolean {
    return unlocked;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(getSettings());
    return () => listeners.delete(listener);
  },

  unlock(): void {
    if (unlocked) return;
    unlocked = true;
    if (mode !== "none") {
      void startTrack(pickTrack(poolFor(mode), currentTrack), { crossfade: false });
    }
  },

  setMuted(muted: boolean): void {
    settings = { ...settings, muted };
    saveSettings(settings);
    applyVolumeImmediate();
    notify();
  },

  setVolume(volume: number): void {
    settings = { ...settings, volume: clampVolume(volume) };
    saveSettings(settings);
    applyVolumeImmediate();
    notify();
  },

  setMode(next: MusicMode): void {
    if (mode === next && isPlaying(active)) {
      return;
    }
    const previous = mode;
    mode = next;
    if (next === "none") {
      stopPlayback(true);
      return;
    }
    const track = pickTrack(poolFor(next), previous !== next ? currentTrack : null);
    const shouldCrossfade = previous !== "none" && previous !== next;
    void startTrack(track, { crossfade: shouldCrossfade });
  },
};

/** Call once from the app root to unlock audio after a user gesture. */
export function installMusicUnlock(): () => void {
  const unlock = () => MusicService.unlock();
  const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
  for (const event of events) {
    window.addEventListener(event, unlock, { once: true, passive: true });
  }
  return () => {
    for (const event of events) {
      window.removeEventListener(event, unlock);
    }
  };
}
