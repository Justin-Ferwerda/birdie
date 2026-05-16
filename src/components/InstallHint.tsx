import { useEffect, useState } from 'react';

const DISMISS_KEY = 'birdie.installHint.dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export default function InstallHint() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [standalone, setStandalone] = useState<boolean>(false);
  const [ios, setIos] = useState<boolean>(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());
  }, []);

  if (dismissed || standalone) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-300">
      <div className="mb-1 font-semibold text-slate-100">
        📲 Add to home screen
      </div>
      <p className="leading-snug text-slate-400">
        {ios
          ? 'Tap the Share button at the bottom of Safari, then "Add to Home Screen". Launching from the icon hides the address bar and feels more like an app.'
          : 'Tap your browser menu, then "Install app" or "Add to Home Screen". Launching from the icon hides the address bar and feels more like an app.'}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 text-[11px] text-slate-500 underline-offset-2 hover:underline"
      >
        Don't show again
      </button>
    </div>
  );
}
