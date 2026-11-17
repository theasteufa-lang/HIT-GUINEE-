import React, { useState } from 'react';
import { Download, Film, Music, X } from 'lucide-react';
import { apiRequest, formatFcfa } from '../lib/api';
import { MediaItem, PlatformPricing } from '../types';

interface VidMateModalProps {
  item: MediaItem;
  pricing: PlatformPricing;
  onClose: () => void;
  onDownloaded: () => void;
}

export const VidMateModal: React.FC<VidMateModalProps> = ({
  item,
  pricing,
  onClose,
  onDownloaded,
}) => {
  const formats =
    item.mediaType === 'video'
      ? [
          { label: 'MP4 4K Ultra HD', size: '84 Mo', quality: '2160p · 60fps' },
          { label: 'MP4 1080p Full HD', size: '42 Mo', quality: '1080p · H.264' },
          { label: 'MP3 320kbps Audio Seul', size: '8 Mo', quality: 'Extraction Audio HD' },
        ]
      : [
          { label: 'FLAC Lossless 24-bit', size: '28 Mo', quality: 'Qualité Studio Master' },
          { label: 'MP3 320kbps Haute Vitesse', size: '9 Mo', quality: 'Compression HD' },
          { label: 'AAC 192kbps Léger', size: '5 Mo', quality: 'Économie Données' },
        ];

  const [selectedFormat, setSelectedFormat] = useState(formats[0].label);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const downloadCost = Math.max(pricing.downloadRateFcfa, item.priceFcfa);
  const platformCut = Math.round((downloadCost * pricing.platformSharePercent) / 100);
  const artistCut = downloadCost - platformCut;

  const handleDownload = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ downloadUrl: string }>(`/api/media/${item.id}/download`, {
        method: 'POST',
        body: JSON.stringify({ format: selectedFormat }),
      });

      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.download = `${item.title.replace(/\s+/g, '_')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setMessage('Téléchargement haute vitesse terminé et ajouté au coffre hors-ligne.');
      onDownloaded();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Erreur de téléchargement.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#13161E] border border-white/10 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <img
              src={item.coverUrl}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover bg-slate-800"
            />
            <div>
              <h3 className="text-base font-semibold text-white line-clamp-1">{item.title}</h3>
              <p className="text-xs text-slate-400">
                {item.artistDisplay} · Moteur Haute Vitesse
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {formats.map((fmt) => (
            <button
              key={fmt.label}
              type="button"
              onClick={() => setSelectedFormat(fmt.label)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                selectedFormat === fmt.label
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-white/10 bg-[#0B0D12] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.mediaType === 'video' ? (
                  <Film className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Music className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-medium text-white">{fmt.label}</div>
                  <div className="text-xs text-slate-400">{fmt.quality}</div>
                </div>
              </div>
              <span className="text-xs font-mono-tabular text-slate-300">{fmt.size}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-[#0B0D12] border border-white/10 p-3.5 mb-5 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span>Valeur monétisation téléchargement</span>
            <span className="font-mono-tabular font-semibold text-white">
              {formatFcfa(downloadCost)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Part plateforme ({pricing.platformSharePercent}%)</span>
            <span className="font-mono-tabular">{formatFcfa(platformCut)}</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Revenu net artiste ({pricing.artistSharePercent}%)</span>
            <span className="font-mono-tabular">{formatFcfa(artistCut)}</span>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-300">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Transfert en cours...' : `Télécharger (${selectedFormat})`}</span>
        </button>
      </div>
    </div>
  );
};
