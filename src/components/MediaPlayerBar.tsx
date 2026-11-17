import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import { formatDuration } from '../lib/api';
import { MediaItem } from '../types';

interface MediaPlayerBarProps {
  currentTrack: MediaItem | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onOpenDownload: (item: MediaItem) => void;
  cinemaMode: boolean;
  onSetCinemaMode: (open: boolean) => void;
}

export const MediaPlayerBar: React.FC<MediaPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onOpenDownload,
  cinemaMode,
  onSetCinemaMode,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(18);
  const [volume, setVolume] = useState(0.85);
  const [videoQuality, setVideoQuality] = useState<'4K' | '1080p' | '720p'>('1080p');

  const isNativeVideoFile =
    currentTrack?.mediaType === 'video' && currentTrack.mimeType?.startsWith('video/');

  useEffect(() => {
    if (!currentTrack) return;
    setCurrentTime(0);

    const mediaEl = isNativeVideoFile ? videoRef.current : audioRef.current;
    if (!mediaEl) return;

    mediaEl.volume = volume;
    if (isPlaying) {
      mediaEl.play().catch(() => {});
    } else {
      mediaEl.pause();
    }
  }, [currentTrack?.id, isPlaying, isNativeVideoFile]);

  useEffect(() => {
    const mediaEl = isNativeVideoFile ? videoRef.current : audioRef.current;
    if (mediaEl) {
      mediaEl.volume = volume;
    }
  }, [volume, isNativeVideoFile]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    const mediaEl = isNativeVideoFile ? videoRef.current : audioRef.current;
    if (mediaEl) {
      mediaEl.currentTime = nextTime;
    }
  };

  if (!currentTrack) return null;

  return (
    <>
      {!isNativeVideoFile && (
        <audio
          ref={audioRef}
          src={currentTrack.streamUrl}
          preload="metadata"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 18)}
          onEnded={onNext}
        />
      )}

      {/* Cinema 4K / YouTube Theatre Stage Modal */}
      {cinemaMode && (
        <div className="fixed inset-0 z-40 bg-[#0B0D12]/95 backdrop-blur-md flex flex-col p-4 md:p-8 overflow-y-auto">
          <div className="max-w-5xl w-full mx-auto flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-white">
                {currentTrack.title}
              </h2>
              <p className="text-xs text-slate-400">
                {currentTrack.artistDisplay} · {currentTrack.genre} · Diffusion Haute Vitesse
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-[#13161E] rounded-lg border border-white/10">
                {(['4K', '1080p', '720p'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setVideoQuality(q)}
                    className={`px-2.5 py-1 text-xs font-mono-tabular rounded-md transition-colors ${
                      videoQuality === q
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onSetCinemaMode(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white"
                aria-label="Réduire"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="max-w-5xl w-full mx-auto aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 relative">
            {isNativeVideoFile ? (
              <video
                ref={videoRef}
                src={currentTrack.streamUrl}
                poster={currentTrack.coverUrl}
                controls
                autoPlay={isPlaying}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 18)}
                onEnded={onNext}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full relative flex items-center justify-center">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover transition-transform duration-700 ${
                    isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <button
                    onClick={onTogglePlay}
                    className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl transition-transform active:scale-95"
                    aria-label={isPlaying ? 'Pause' : 'Lecture'}
                  >
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                  </button>
                  <div className="flex items-end gap-1 h-8">
                    {[18, 28, 14, 32, 22, 26, 16, 30, 20].map((bar, idx) => (
                      <span
                        key={idx}
                        style={{
                          height: isPlaying ? `${bar}px` : '6px',
                          transition: 'height 180ms ease',
                        }}
                        className="w-1.5 rounded-full bg-amber-400"
                      />
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{currentTrack.title}</div>
                    <div className="text-xs text-slate-300">
                      Flux Studio {videoQuality} · {currentTrack.qualityAudio}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenDownload(currentTrack)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-2 backdrop-blur-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger ({videoQuality})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Spotify-style Bottom Control Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-[#13161E]/95 backdrop-blur-md border-t border-white/10 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:w-72">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg object-cover shrink-0 bg-slate-800"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{currentTrack.title}</div>
              <div className="text-xs text-slate-400 truncate">{currentTrack.artistDisplay}</div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 flex-1 max-w-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={onPrev}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                aria-label="Précédent"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={onTogglePlay}
                className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={onNext}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                aria-label="Suivant"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2.5 w-full">
              <span className="text-[11px] font-mono-tabular text-slate-400 w-9 text-right">
                {formatDuration(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 18}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-amber-500 h-1 bg-white/15 rounded-lg cursor-pointer"
                aria-label="Progression"
              />
              <span className="text-[11px] font-mono-tabular text-slate-400 w-9">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 w-64 justify-end">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 accent-amber-500 h-1 bg-white/15 rounded-lg cursor-pointer"
                aria-label="Volume"
              />
            </div>
            <button
              onClick={() => onOpenDownload(currentTrack)}
              className="p-2 rounded-lg text-slate-300 hover:text-amber-400 hover:bg-white/5 transition-colors"
              title="Télécharger (VidMate HD)"
              aria-label="Télécharger"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSetCinemaMode(!cinemaMode)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              title="Mode Cinéma 4K"
              aria-label="Mode Cinéma"
            >
              {cinemaMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
