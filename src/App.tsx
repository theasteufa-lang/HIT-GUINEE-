import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Download,
  Film,
  Fingerprint,
  FolderLock,
  LogOut,
  Mic2,
  Music,
  Play,
  Search,
  Wallet,
} from 'lucide-react';
import { apiRequest, formatDuration, formatFcfa, setSessionToken } from './lib/api';
import {
  AppSection,
  MediaItem,
  OfflineVaultEntry,
  PlatformPricing,
  UserProfile,
} from './types';
import { AuthModal } from './components/AuthModal';
import { VidMateModal } from './components/VidMateModal';
import { MediaPlayerBar } from './components/MediaPlayerBar';
import { ArtistStudioView } from './components/ArtistStudioView';
import { WalletTransactionsView } from './components/WalletTransactionsView';
import { CatalogsPdgView } from './components/CatalogsPdgView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  const [section, setSection] = useState<AppSection>('discover');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);

  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [pricing, setPricing] = useState<PlatformPricing>({
    platformSharePercent: 65,
    artistSharePercent: 35,
    distributionPackPrice: 200000,
    streamRateFcfa: 50,
    videoViewRateFcfa: 100,
    downloadRateFcfa: 250,
  });
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [offlineVault, setOfflineVault] = useState<OfflineVaultEntry[]>([]);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'audio' | 'video'>('all');

  // Player state
  const [currentTrack, setCurrentTrack] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [downloadModalItem, setDownloadModalItem] = useState<MediaItem | null>(null);

  // Auth modal
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'biometric' | null>(
    null
  );

  const loadCatalog = async () => {
    try {
      const res = await apiRequest<{ items: MediaItem[]; pricing: PlatformPricing }>(
        '/api/catalog'
      );
      setCatalog(res.items);
      setPricing(res.pricing);
    } catch {
      // handled gracefully
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadOfflineVault = async () => {
    if (!user) {
      setOfflineVault([]);
      return;
    }
    try {
      const res = await apiRequest<{ items: OfflineVaultEntry[] }>('/api/vault/offline');
      setOfflineVault(res.items);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    loadOfflineVault();
  }, [user?.id]);

  const handlePlayMedia = async (item: MediaItem, openCinema = false) => {
    setCurrentTrack(item);
    setIsPlaying(true);
    if (openCinema || item.mediaType === 'video') {
      setCinemaMode(true);
    }

    try {
      await apiRequest(`/api/media/${item.id}/play`, { method: 'POST' });
      setCatalog((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, playsCount: m.playsCount + 1 } : m))
      );
    } catch {
      // keep playback smooth
    }
  };

  const handleNextTrack = () => {
    if (!currentTrack || catalog.length === 0) return;
    const idx = catalog.findIndex((m) => m.id === currentTrack.id);
    const next = catalog[(idx + 1) % catalog.length];
    if (next) handlePlayMedia(next, cinemaMode);
  };

  const handlePrevTrack = () => {
    if (!currentTrack || catalog.length === 0) return;
    const idx = catalog.findIndex((m) => m.id === currentTrack.id);
    const prev = catalog[(idx - 1 + catalog.length) % catalog.length];
    if (prev) handlePlayMedia(prev, cinemaMode);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setSessionToken(null);
    setUser(null);
    setBiometricVerified(false);
    if (section === 'catalogspdg' || section === 'wallet') {
      setSection('discover');
    }
  };

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchesType = mediaFilter === 'all' || item.mediaType === mediaFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.artistDisplay.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [catalog, mediaFilter, searchQuery]);

  const audioItems = filteredCatalog.filter((m) => m.mediaType === 'audio');
  const videoItems = filteredCatalog.filter((m) => m.mediaType === 'video');
  const featuredHero = catalog.find((m) => m.isFeatured) || catalog[0];

  const handleNavClick = (target: AppSection) => {
    if ((target === 'artist' || target === 'wallet') && !user) {
      setAuthModalMode('login');
      return;
    }
    setSection(target);
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F3F4F6] flex flex-col">
      {/* Top Bar Contract: 3 zones, single-line controls */}
      <header className="sticky top-0 z-30 bg-[#0B0D12]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setSection('discover')}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
          >
            Steufa Stream
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              type="button"
              onClick={() => setSection('discover')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                section === 'discover' ? 'text-white underline underline-offset-8 decoration-amber-500' : ''
              }`}
            >
              Découvrir
            </button>
            <button
              type="button"
              onClick={() => setSection('videos')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                section === 'videos' ? 'text-white underline underline-offset-8 decoration-amber-500' : ''
              }`}
            >
              Vidéos 4K
            </button>
            <button
              type="button"
              onClick={() => setSection('downloads')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                section === 'downloads' ? 'text-white underline underline-offset-8 decoration-amber-500' : ''
              }`}
            >
              Téléchargements
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('artist')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                section === 'artist' ? 'text-white underline underline-offset-8 decoration-amber-500' : ''
              }`}
            >
              Espace Artiste
            </button>
            {user && (
              <button
                type="button"
                onClick={() => handleNavClick('wallet')}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  section === 'wallet' ? 'text-white underline underline-offset-8 decoration-amber-500' : ''
                }`}
              >
                Transactions
              </button>
            )}
            {/* Strictly invisible unless authenticated as CEO */}
            {user?.role === 'ceo' && (
              <button
                type="button"
                onClick={() => setSection('catalogspdg')}
                className={`flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 ${
                  section === 'catalogspdg' ? 'underline underline-offset-8' : ''
                }`}
              >
                <FolderLock className="w-3.5 h-3.5" />
                <span>CatalogsPDG</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {!user ? (
              <>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('register')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Inscription
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalMode('biometric')}
                  className={`p-2 rounded-xl border transition-colors ${
                    biometricVerified
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/10 bg-[#13161E] text-slate-300 hover:text-white'
                  }`}
                  title="Sécurité Biométrique"
                  aria-label="Biométrie"
                >
                  <Fingerprint className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSection('wallet')}
                  className="px-3.5 py-2 rounded-xl bg-[#13161E] border border-white/10 hover:border-amber-500/40 text-xs font-medium text-white flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span className="truncate max-w-[110px]">{user.displayName}</span>
                  <span className="text-amber-400 font-mono-tabular">
                    {formatFcfa(user.walletBalance)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 pt-6 pb-36 md:pb-28">
        {/* DISCOVER VIEW: Spotify + YouTube + VidMate Hybrid */}
        {section === 'discover' && (
          <div className="space-y-10">
            {/* Hero Spotlight */}
            {featuredHero && (
              <section className="rounded-2xl overflow-hidden bg-[#13161E] border border-white/10">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-6 p-6 md:p-10 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-medium text-amber-400 mb-3">
                        Streaming Audio FLAC · Clips 4K · Téléchargement Haute Vitesse
                      </p>
                      <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                        Écoutez, visionnez et distribuez vos œuvres sans limite.
                      </h1>
                      <p className="text-sm text-slate-400 mt-3 max-w-lg leading-relaxed">
                        Un écosystème unifié réunissant lecture musicale sans perte, streaming vidéo
                        4K, extraction hors-ligne rapide et distribution artiste complète dès{' '}
                        <span className="text-white font-semibold font-mono-tabular">
                          {formatFcfa(pricing.distributionPackPrice)}
                        </span>
                        .
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-8">
                      <button
                        type="button"
                        onClick={() => handlePlayMedia(featuredHero)}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Écouter : {featuredHero.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('artist')}
                        className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        Distribuer 2 objets ({formatFcfa(pricing.distributionPackPrice)})
                      </button>
                      <PWAInstallButton variant="primary" />
                    </div>
                  </div>

                  <div className="lg:col-span-6 relative min-h-[260px]">
                    <img
                      src={featuredHero.coverUrl}
                      alt={featuredHero.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-xs text-amber-400 font-medium">
                          {featuredHero.artistDisplay} · {featuredHero.genre}
                        </div>
                        <div className="text-xl font-bold text-white mt-0.5">
                          {featuredHero.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDownloadModalItem(featuredHero)}
                        className="px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 backdrop-blur-md whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>HD</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Search & Media Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un titre, un artiste ou un genre..."
                  className="w-full rounded-xl bg-[#13161E] border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#13161E] rounded-xl border border-white/10 self-start">
                {[
                  { id: 'all' as const, label: 'Tout' },
                  { id: 'audio' as const, label: 'Audio HD' },
                  { id: 'video' as const, label: 'Clips 4K' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMediaFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      mediaFilter === f.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingCatalog ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="h-56 rounded-2xl bg-[#13161E]" />
                ))}
              </div>
            ) : (
              <>
                {/* Audio Section (Spotify-style) */}
                {audioItems.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">Titres Audio Lossless</h2>
                      <span className="text-xs text-slate-400 font-mono-tabular">
                        {audioItems.length} morceaux
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {audioItems.map((item) => {
                        const active = currentTrack?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl bg-[#13161E] border transition-colors p-4 flex gap-4 items-center ${
                              active ? 'border-amber-500/60' : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-800 group">
                              <img
                                src={item.coverUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handlePlayMedia(item)}
                                className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
                                aria-label={`Lire ${item.title}`}
                              >
                                <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg">
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                </div>
                              </button>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold text-white truncate">
                                {item.title}
                              </h3>
                              <p className="text-xs text-slate-400 truncate mt-0.5">
                                {item.artistDisplay}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1.5">
                                <span>{item.genre}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular">
                                  {formatDuration(item.durationSec)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular">
                                  {new Intl.NumberFormat('fr-FR').format(item.playsCount)} écoutes
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setDownloadModalItem(item)}
                              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors shrink-0"
                              title="Télécharger HD"
                              aria-label="Télécharger"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 4K Video Clips Section (YouTube-style) */}
                {videoItems.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">Clips Vidéo & Sessions 4K</h2>
                      <span className="text-xs text-slate-400 font-mono-tabular">
                        {videoItems.length} vidéos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {videoItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl bg-[#13161E] border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
                        >
                          <div className="relative aspect-video bg-black group">
                            <img
                              src={item.coverUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <button
                              type="button"
                              onClick={() => handlePlayMedia(item, true)}
                              className="absolute inset-0 flex items-center justify-center"
                              aria-label={`Lire le clip ${item.title}`}
                            >
                              <div className="w-14 h-14 rounded-full bg-amber-500/95 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                                <Play className="w-6 h-6 fill-current ml-0.5" />
                              </div>
                            </button>
                            <div className="absolute bottom-3 right-3 text-xs font-mono-tabular text-white bg-black/70 px-2 py-0.5 rounded-md">
                              {formatDuration(item.durationSec)}
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-white truncate">
                                {item.title}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <span>{item.artistDisplay}</span>
                                <span aria-hidden="true">·</span>
                                <span>{item.qualityVideo || '4K UHD'}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular">
                                  {new Intl.NumberFormat('fr-FR').format(item.playsCount)} vues
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setDownloadModalItem(item)}
                              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>VidMate HD</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* VIDEOS 4K VIEW */}
        {section === 'videos' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Chaîne Vidéo & Clips 4K</h1>
              <p className="text-sm text-slate-400 mt-1">
                Streaming adaptatif haute vitesse et extraction MP4/MP3 instantanée.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {catalog
                .filter((m) => m.mediaType === 'video')
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-[#13161E] border border-white/10 overflow-hidden"
                  >
                    <div className="relative aspect-video bg-black">
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <button
                        type="button"
                        onClick={() => handlePlayMedia(item, true)}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="w-14 h-14 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-white">{item.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.artistDisplay} · {item.qualityVideo || '4K UHD'} ·{' '}
                          {new Intl.NumberFormat('fr-FR').format(item.playsCount)} vues
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDownloadModalItem(item)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* VIDMATE OFFLINE DOWNLOADS VIEW */}
        {section === 'downloads' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Gestionnaire de Téléchargements Haute Vitesse
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Téléchargez n’importe quel titre audio (FLAC / MP3 320kbps) ou clip (MP4 4K /
                  1080p) pour une lecture hors-ligne.
                </p>
              </div>
              <PWAInstallButton />
            </div>

            {offlineVault.length > 0 && (
              <div className="rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-4">
                <h2 className="text-base font-semibold text-white">
                  Vos Téléchargements Enregistrés ({offlineVault.length})
                </h2>
                <div className="divide-y divide-white/5">
                  {offlineVault.map((entry) => (
                    <div
                      key={entry.id}
                      className="py-3 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={entry.coverUrl}
                          alt={entry.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{entry.title}</div>
                          <div className="text-xs text-slate-400">
                            {entry.artistDisplay} · {entry.format} · {entry.fileSizeMb} Mo
                          </div>
                        </div>
                      </div>
                      <a
                        href={`/api/download/${entry.mediaId}?format=${encodeURIComponent(entry.format)}`}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white font-medium whitespace-nowrap"
                      >
                        Enregistrer fichier
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-4">
              <h2 className="text-base font-semibold text-white">
                Catalogue Disponible en Extraction Rapide
              </h2>
              <div className="divide-y divide-white/5">
                {catalog.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{item.title}</div>
                        <div className="text-xs text-slate-400">
                          {item.artistDisplay} ·{' '}
                          {item.mediaType === 'video' ? item.qualityVideo : item.qualityAudio}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDownloadModalItem(item)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Choisir qualité</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ARTIST STUDIO & DISTRIBUTOR */}
        {section === 'artist' && user && (
          <ArtistStudioView
            user={user}
            onRefreshGlobal={loadCatalog}
            onPlayMedia={(m) => handlePlayMedia(m, m.mediaType === 'video')}
            onGoToWallet={() => setSection('wallet')}
          />
        )}

        {/* SECURE FINANCIAL TRANSACTIONS & BIOMETRICS */}
        {section === 'wallet' && user && (
          <WalletTransactionsView
            user={user}
            biometricVerified={biometricVerified}
            onRequireBiometric={() => setAuthModalMode('biometric')}
            onUserUpdated={(updated) => setUser(updated)}
          />
        )}

        {/* PRIVATE INVISIBLE CEO VAULT */}
        {section === 'catalogspdg' && user?.role === 'ceo' && (
          <CatalogsPdgView onRefreshPublic={loadCatalog} />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (Thumb Zone <= 15% viewport height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#13161E]/95 backdrop-blur-md border-t border-white/10 h-16 grid grid-cols-5 items-center">
        {[
          { id: 'discover' as const, label: 'Découvrir', icon: Compass },
          { id: 'videos' as const, label: 'Vidéos', icon: Film },
          { id: 'downloads' as const, label: 'Offline', icon: Download },
          { id: 'artist' as const, label: 'Artiste', icon: Mic2 },
          { id: 'wallet' as const, label: 'Finances', icon: Wallet },
        ].map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center h-full transition-colors ${
                active ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Persistent Spotify / YouTube Cinema Player */}
      <MediaPlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onOpenDownload={(item) => setDownloadModalItem(item)}
        cinemaMode={cinemaMode}
        onSetCinemaMode={setCinemaMode}
      />

      {/* VidMate Quality Download Modal */}
      {downloadModalItem && (
        <VidMateModal
          item={downloadModalItem}
          pricing={pricing}
          onClose={() => setDownloadModalItem(null)}
          onDownloaded={() => {
            loadCatalog();
            loadOfflineVault();
          }}
        />
      )}

      {/* Auth / Biometric Modal */}
      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          currentUser={user}
          onClose={() => setAuthModalMode(null)}
          onAuthenticated={(authUser, bioOk) => {
            setUser(authUser);
            setBiometricVerified(bioOk);
            if (authUser.role === 'ceo') {
              setSection('catalogspdg');
            }
          }}
        />
      )}
      <OfflineIndicator />
    </div>
  );
}
