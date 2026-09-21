// Web Audio & Browser Notification Utilities for Z-Messenger

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Plays a pleasant two-tone notification chime (C5 -> G5) using Web Audio API
 */
export function playMessageChime() {
  if (typeof window === "undefined") return;

  // Check if sound is disabled by user in settings
  const soundEnabled = localStorage.getItem("zmsg_sound_enabled") !== "false";
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2: 880.00 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.48);

    // Subtle vibration on supported mobile devices
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  } catch (err) {
    // AudioContext autoplay restrictions are handled gracefully
  }
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  try {
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Show native desktop notification
 */
export function showDesktopNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notifEnabled = localStorage.getItem("zmsg_notifications_enabled") !== "false";
  if (!notifEnabled) return;

  try {
    const notif = new Notification(title, {
      body: options?.body || "New message received",
      icon: options?.icon || "/favicon.ico",
      tag: options?.tag || "zmsg-notification",
    });

    notif.onclick = () => {
      window.focus();
      if (options?.onClick) {
        options.onClick();
      }
      notif.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => {
      try {
        notif.close();
      } catch (e) {}
    }, 5000);
  } catch (err) {
    // Ignored in restricted environments
  }
}
