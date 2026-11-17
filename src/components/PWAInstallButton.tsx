import React, { useState } from 'react';
import { Check, Copy, Laptop, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'primary' | 'subtle' }> = ({
  variant = 'subtle',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className={
          variant === 'primary'
            ? 'px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0'
            : 'px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Smartphone className="w-4 h-4 text-amber-400" />
        <span>Installer sur l’écran</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#13161E] border border-white/10 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Installer Steufa Stream sur votre écran
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Application PWA autonome · Compatible Android, iPhone et Ordinateur
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="rounded-xl bg-[#0B0D12] border border-white/10 p-4 space-y-2.5 text-xs text-slate-300">
                <div className="font-semibold text-amber-400 flex items-center gap-2">
                  <Share className="w-4 h-4" />
                  <span>Sur iPhone / iPad (Safari)</span>
                </div>
                <p>1. Ouvrez l’application directement dans Safari (hors aperçu intégré).</p>
                <p>
                  2. Touchez le bouton <strong>Partager</strong> (carré avec flèche vers le haut).
                </p>
                <p>
                  3. Faites défiler et sélectionnez <strong>Sur l’écran d’accueil</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="rounded-xl bg-[#0B0D12] border border-white/10 p-4 space-y-2">
                  <div className="font-semibold text-amber-400 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Sur Android (Chrome / Edge)</span>
                  </div>
                  <p>
                    1. Ouvrez le lien de l’application dans Chrome (pas dans l’aperçu intégré).
                  </p>
                  <p>
                    2. Touchez le menu <strong>⋮</strong> en haut à droite puis{' '}
                    <strong>Installer l’application</strong> ou{' '}
                    <strong>Ajouter à l’écran d’accueil</strong>.
                  </p>
                </div>

                <div className="rounded-xl bg-[#0B0D12] border border-white/10 p-4 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-amber-400" />
                    <span>Sur Ordinateur (Windows / Mac)</span>
                  </div>
                  <p>
                    Cliquez sur l’icône d’installation dans la barre d’adresse de Chrome/Edge
                    (à droite de l’URL) pour épingler Steufa Stream sur votre bureau.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Lien copié' : 'Copier le lien pour navigateur'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-16 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg">
      <WifiOff className="w-4 h-4" />
      <span>Mode hors-ligne actif — Médias en cache disponibles</span>
    </div>
  );
};
