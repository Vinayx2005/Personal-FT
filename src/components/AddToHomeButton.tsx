'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, PlusSquare, X, Menu as MenuIcon } from 'lucide-react';

// The Chromium `beforeinstallprompt` event. Not in stock TS DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';

const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'desktop';
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && 'ontouchend' in document);
  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
};

// Always-visible "Add to Home Screen" pill. Behaviour by browser:
// - Chromium (Android/desktop) with a valid manifest + registered SW → fires
//   the native install dialog directly on click (no modal).
// - Everywhere else (iOS Safari, Firefox, etc.) → opens a small overlay with
//   platform-specific instructions since no API exists to auto-install.
// Hidden only when the app is already running as an installed PWA.
export default function AddToHomeButton() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(standalone);

    const bip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', bip);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', bip);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (isInstalled) return null;

  const handleClick = async () => {
    // Prefer the native install dialog whenever the browser has offered one.
    if (installEvent && platform !== 'ios') {
      try {
        await installEvent.prompt();
        const { outcome } = await installEvent.userChoice;
        if (outcome === 'accepted') setInstallEvent(null);
        return;
      } catch {
        /* fall through to instructions */
      }
    }
    setShowInstructions(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Add to home screen"
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-full bg-18-orange/15 border border-18-orange/40 text-18-orange hover:bg-18-orange/25 transition-colors shadow-[0_0_20px_-8px_rgba(243,115,53,0.5)] shrink-0"
        title="Install Personal FT to your home screen"
      >
        <Download size={12} />
        {/* Full label on ≥sm; icon-only on phones so the chat header fits. */}
        <span className="hidden sm:inline">Add to Home Screen</span>
      </button>
      {showInstructions && (
        <InstructionsModal
          platform={platform}
          onClose={() => setShowInstructions(false)}
        />
      )}
    </>
  );
}

function InstructionsModal({
  platform,
  onClose,
}: {
  platform: Platform;
  onClose: () => void;
}) {
  const steps =
    platform === 'ios'
      ? [
          {
            icon: <Share2 size={14} className="text-18-orange" />,
            text: (
              <>
                Tap the <strong className="text-white">Share</strong> button
                (bottom of Safari, top-right in Chrome)
              </>
            ),
          },
          {
            icon: <PlusSquare size={14} className="text-18-orange" />,
            text: (
              <>
                Scroll down and tap{' '}
                <strong className="text-white">Add to Home Screen</strong>
              </>
            ),
          },
          {
            icon: null,
            text: (
              <>
                Tap <strong className="text-white">Add</strong> — Personal FT
                lands on your home screen
              </>
            ),
          },
        ]
      : platform === 'android'
      ? [
          {
            icon: <MenuIcon size={14} className="text-18-orange" />,
            text: (
              <>
                Tap the <strong className="text-white">⋮</strong> menu in Chrome
                (top-right)
              </>
            ),
          },
          {
            icon: <PlusSquare size={14} className="text-18-orange" />,
            text: (
              <>
                Tap <strong className="text-white">Add to Home screen</strong>{' '}
                (or <strong className="text-white">Install app</strong>)
              </>
            ),
          },
          {
            icon: null,
            text: <>Confirm — the icon appears on your home screen</>,
          },
        ]
      : [
          {
            icon: <MenuIcon size={14} className="text-18-orange" />,
            text: (
              <>
                Look for the install icon in the browser&apos;s address bar
              </>
            ),
          },
          {
            icon: <PlusSquare size={14} className="text-18-orange" />,
            text: (
              <>
                Choose{' '}
                <strong className="text-white">Install Personal FT</strong>
              </>
            ),
          },
          {
            icon: null,
            text: <>The app installs as a desktop shortcut</>,
          },
        ];

  const heading =
    platform === 'ios'
      ? 'Install on iPhone / iPad'
      : platform === 'android'
      ? 'Install on Android'
      : 'Install on desktop';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-18-surface border border-18-border rounded-2xl max-w-sm w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <h3 className="text-lg font-bold text-white">{heading}</h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <ol className="space-y-4 text-sm text-white/80">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-18-orange/20 border border-18-orange/40 text-18-orange text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1">
                {s.icon && (
                  <span className="inline-flex mr-1.5 align-middle">
                    {s.icon}
                  </span>
                )}
                {s.text}
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-white/40 mt-6 leading-relaxed border-t border-18-border/60 pt-4">
          Once installed, Quick Add loads in one tap and works even when you&apos;re offline for a moment.
        </p>
      </div>
    </div>
  );
}
