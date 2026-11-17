import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Disc3,
  Download,
  Film,
  Globe,
  Music,
  Play,
  Upload,
} from 'lucide-react';
import { apiRequest, formatFcfa } from '../lib/api';
import {
  DistributionOrder,
  MediaItem,
  PaymentMethod,
  PlatformPricing,
  UserProfile,
} from '../types';

interface ArtistStudioViewProps {
  user: UserProfile;
  onRefreshGlobal: () => void;
  onPlayMedia: (item: MediaItem) => void;
  onGoToWallet: () => void;
}

interface ArtistDashboardPayload {
  user: UserProfile;
  config: PlatformPricing;
  stats: {
    totalPlays: number;
    totalDownloads: number;
    totalGross: number;
    artistNetEarned: number;
    platformCutEarned: number;
    walletBalance: number;
    releasesCount: number;
  };
  media: MediaItem[];
  distributions: DistributionOrder[];
  paymentMethods: PaymentMethod[];
}

const DSP_LIST = [
  'Steufa Stream',
  'Spotify',
  'YouTube Music',
  'Apple Music',
  'Boomplay',
  'Audiomack',
];

export const ArtistStudioView: React.FC<ArtistStudioViewProps> = ({
  user,
  onRefreshGlobal,
  onPlayMedia,
  onGoToWallet,
}) => {
  const [data, setData] = useState<ArtistDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'distributor' | 'upload'>('overview');

  // Direct single upload state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<'audio' | 'video'>('audio');
  const [uploadGenre, setUploadGenre] = useState('Afro-Fusion');
  const [uploadPrice, setUploadPrice] = useState('500');
  const [uploadFile, setUploadFile] = useState<{
    base64: string;
    name: string;
    mime: string;
  } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Distributor 200 000 FCFA state
  const [packType, setPackType] = useState<'2_sons' | '1_son_1_clip' | '2_sons_2_clips'>(
    '1_son_1_clip'
  );
  const [paymentSource, setPaymentSource] = useState<'wallet' | 'direct_payment'>('wallet');
  const [selectedPayCode, setSelectedPayCode] = useState('orange_money');
  const [accountRef, setAccountRef] = useState('');
  const [selectedDsps, setSelectedDsps] = useState<string[]>(DSP_LIST);
  const [distItems, setDistItems] = useState<
    Array<{ title: string; mediaType: 'audio' | 'video'; genre: string }>
  >([
    { title: '', mediaType: 'audio', genre: 'Afro-Fusion' },
    { title: '', mediaType: 'video', genre: 'Clip Officiel' },
  ]);
  const [distMessage, setDistMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ArtistDashboardPayload>('/api/artist/dashboard');
      setData(res);
      if (res.paymentMethods.length > 0) {
        setSelectedPayCode(res.paymentMethods[0].code);
      }
    } catch {
      // handled cleanly
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user.id]);

  const handlePackSwitch = (nextPack: '2_sons' | '1_son_1_clip' | '2_sons_2_clips') => {
    setPackType(nextPack);
    if (nextPack === '2_sons') {
      setDistItems([
        { title: '', mediaType: 'audio', genre: 'Afro-Fusion' },
        { title: '', mediaType: 'audio', genre: 'Afro-Pop' },
      ]);
    } else if (nextPack === '1_son_1_clip') {
      setDistItems([
        { title: '', mediaType: 'audio', genre: 'Afro-Fusion' },
        { title: '', mediaType: 'video', genre: 'Clip Officiel' },
      ]);
    } else {
      setDistItems([
        { title: '', mediaType: 'audio', genre: 'Afro-Fusion' },
        { title: '', mediaType: 'audio', genre: 'Afro-Pop' },
        { title: '', mediaType: 'video', genre: 'Clip Officiel' },
        { title: '', mediaType: 'video', genre: 'Live Studio' },
      ]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadFile({ base64: reader.result, name: file.name, mime: file.type });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSingleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setUploadStatus(null);
    try {
      await apiRequest('/api/artist/upload', {
        method: 'POST',
        body: JSON.stringify({
          title: uploadTitle,
          mediaType: uploadType,
          genre: uploadGenre,
          priceFcfa: Number(uploadPrice),
          fileBase64: uploadFile?.base64,
          fileName: uploadFile?.name,
          mimeType: uploadFile?.mime,
        }),
      });
      setUploadTitle('');
      setUploadFile(null);
      setUploadStatus('Production publiée avec succès sur Steufa Stream.');
      await loadDashboard();
      onRefreshGlobal();
    } catch (err: unknown) {
      setUploadStatus(err instanceof Error ? err.message : 'Échec de publication.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    setDistMessage(null);
    if (distItems.some((i) => !i.title.trim())) {
      setDistMessage({ type: 'err', text: 'Veuillez renseigner le titre de chaque objet.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ publishedItems: MediaItem[] }>('/api/distributor/launch', {
        method: 'POST',
        body: JSON.stringify({
          packageType: packType,
          paymentSource,
          paymentMethodCode: paymentSource === 'direct_payment' ? selectedPayCode : 'wallet_steufa',
          accountReference: accountRef || 'Portefeuille Artiste',
          dspTargets: selectedDsps,
          items: distItems,
        }),
      });
      setDistMessage({
        type: 'ok',
        text: `Distribution lancée : ${res.publishedItems.length} objets publiés vers ${selectedDsps.length} plateformes.`,
      });
      handlePackSwitch(packType);
      await loadDashboard();
      onRefreshGlobal();
    } catch (err: unknown) {
      setDistMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur de distribution.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-44 rounded-2xl bg-[#13161E]" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="h-24 rounded-2xl bg-[#13161E]" />
          ))}
        </div>
      </div>
    );
  }

  const maxPlay = Math.max(1, ...data.media.map((m) => m.playsCount));

  return (
    <div className="space-y-8">
      {/* Studio Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#13161E]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-amber-400 mb-2">
                Espace Créateur · {user.artistName || user.displayName}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                Studio Artiste & Distributeur International
              </h1>
              <p className="text-sm text-slate-400 mt-2 max-w-xl">
                Pilotez vos sons et clips vidéo 4K, suivez vos performances en temps réel et
                lancez votre distribution multi-plateformes (Pack {formatFcfa(data.config.distributionPackPrice)}).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Tableau de bord
              </button>
              <button
                onClick={() => setActiveTab('distributor')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'distributor'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Distributeur ({formatFcfa(data.config.distributionPackPrice)})
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'upload'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Publier Son / Clip
              </button>
              <button
                onClick={onGoToWallet}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
              >
                Retraits & Dépôts
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[200px]">
            <img
              src="/src/assets/images/banner_artist_studio_1794947042295.jpg"
              alt="Console mastering studio Steufa"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#13161E] via-[#13161E]/40 to-transparent" />
          </div>
        </div>
      </div>

      {/* 4 Tabular KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#13161E] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Solde Portefeuille Disponible</div>
          <div className="text-2xl font-bold text-white font-mono-tabular mt-1.5">
            {formatFcfa(data.stats.walletBalance)}
          </div>
          <div className="text-xs text-emerald-400 mt-1">
            Part Artiste : {data.config.artistSharePercent}% net
          </div>
        </div>

        <div className="rounded-2xl bg-[#13161E] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Lectures Audio & Vues 4K</div>
          <div className="text-2xl font-bold text-white font-mono-tabular mt-1.5">
            {new Intl.NumberFormat('fr-FR').format(data.stats.totalPlays)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {data.stats.releasesCount} productions actives
          </div>
        </div>

        <div className="rounded-2xl bg-[#13161E] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Téléchargements Haute Vitesse</div>
          <div className="text-2xl font-bold text-white font-mono-tabular mt-1.5">
            {new Intl.NumberFormat('fr-FR').format(data.stats.totalDownloads)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Formats FLAC / MP3 / MP4</div>
        </div>

        <div className="rounded-2xl bg-[#13161E] border border-white/10 p-5">
          <div className="text-xs text-slate-400">
            Revenus Bruts ({data.config.platformSharePercent}% Plateforme)
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono-tabular mt-1.5">
            {formatFcfa(data.stats.totalGross)}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono-tabular">
            Commission Steufa : {formatFcfa(data.stats.platformCutEarned)}
          </div>
        </div>
      </div>

      {/* Tab 1: Overview & Performance Analytics */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-2xl bg-[#13161E] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Vos Productions & Performances</h2>
              <span className="text-xs text-slate-400 font-mono-tabular">
                {data.media.length} titres / clips
              </span>
            </div>

            {data.media.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400 mb-4">
                  Aucune production publiée sur votre compte pour le moment.
                </p>
                <button
                  onClick={() => setActiveTab('distributor')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold"
                >
                  Lancer un pack Distribution ({formatFcfa(data.config.distributionPackPrice)})
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-slate-400">
                      <th className="pb-3 font-medium">Titre</th>
                      <th className="pb-3 font-medium">Format</th>
                      <th className="pb-3 font-medium text-right">Lectures</th>
                      <th className="pb-3 font-medium text-right">Téléchargements</th>
                      <th className="pb-3 font-medium text-right">Brut</th>
                      <th className="pb-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {data.media.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={item.coverUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                            <div>
                              <div className="font-medium text-white">{item.title}</div>
                              <div className="text-xs text-slate-400">{item.genre}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-xs text-slate-300">
                          {item.mediaType === 'video' ? 'Clip Vidéo 4K' : 'Audio HD'}
                        </td>
                        <td className="py-3 text-right font-mono-tabular text-slate-200">
                          {new Intl.NumberFormat('fr-FR').format(item.playsCount)}
                        </td>
                        <td className="py-3 text-right font-mono-tabular text-slate-200">
                          {new Intl.NumberFormat('fr-FR').format(item.downloadsCount)}
                        </td>
                        <td className="py-3 text-right font-mono-tabular text-amber-400">
                          {formatFcfa(item.grossRevenueFcfa)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => onPlayMedia(item)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-200 transition-colors"
                            aria-label="Lire"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-5">
            <h2 className="text-base font-semibold text-white">Audience par Titre</h2>
            <div className="space-y-3">
              {data.media.slice(0, 5).map((item) => {
                const pct = Math.max(8, Math.round((item.playsCount / maxPlay) * 100));
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-200 truncate max-w-[180px]">{item.title}</span>
                      <span className="font-mono-tabular text-slate-400">
                        {new Intl.NumberFormat('fr-FR').format(item.playsCount)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0B0D12] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {data.media.length === 0 && (
                <p className="text-xs text-slate-500">
                  Les graphiques d'audience s'afficheront dès votre première sortie.
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="text-xs font-semibold text-slate-300 mb-2">
                Dernières Distributions DSP
              </h3>
              <div className="space-y-2">
                {data.distributions.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl bg-[#0B0D12] border border-white/5 p-3 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-white">
                        Pack {d.packageType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-400 mt-0.5">{d.status}</div>
                    </div>
                    <span className="font-mono-tabular text-amber-400">
                      {formatFcfa(d.amountPaidFcfa)}
                    </span>
                  </div>
                ))}
                {data.distributions.length === 0 && (
                  <p className="text-xs text-slate-500">Aucun envoi DSP enregistré.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Official 200 000 FCFA Distributor */}
      {activeTab === 'distributor' && (
        <form
          onSubmit={handleLaunchDistribution}
          className="rounded-2xl bg-[#13161E] border border-white/10 p-6 md:p-8 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <h2 className="text-xl font-bold text-white">
                Distributeur Officiel Steufa — Lancement Multi-Plateformes
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Choisissez votre configuration de lancement pour{' '}
                <span className="text-amber-400 font-semibold font-mono-tabular">
                  {formatFcfa(data.config.distributionPackPrice)}
                </span>{' '}
                (65% Plateforme / 35% Allocation Artiste).
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Tarif unique du pack</div>
              <div className="text-2xl font-bold text-amber-400 font-mono-tabular">
                {formatFcfa(data.config.distributionPackPrice)}
              </div>
            </div>
          </div>

          {/* 3 Package Choices */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: '2_sons' as const,
                title: '2 Sons Audio HD',
                desc: 'Lancement de 2 titres audio masterisés (FLAC / 320kbps)',
                icon: Music,
              },
              {
                id: '1_son_1_clip' as const,
                title: '1 Son + 1 Clip Vidéo',
                desc: 'Lancement hybride : 1 single audio + 1 clip vidéo 4K',
                icon: Disc3,
              },
              {
                id: '2_sons_2_clips' as const,
                title: '2 Sons + 2 Clips Vidéo',
                desc: 'Pack complet au choix de l’artiste : 2 audios + 2 clips 4K',
                icon: Film,
              },
            ].map((option) => {
              const Icon = option.icon;
              const selected = packType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handlePackSwitch(option.id)}
                  className={`p-5 rounded-2xl border text-left transition-colors ${
                    selected
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-white/10 bg-[#0B0D12] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={`w-5 h-5 ${selected ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-mono-tabular text-amber-400">
                      {formatFcfa(data.config.distributionPackPrice)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">{option.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{option.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Dynamic Item Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {distItems.map((entry, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-[#0B0D12] border border-white/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400">
                    Objet #{idx + 1} · {entry.mediaType === 'video' ? 'Clip Vidéo 4K' : 'Son Audio HD'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={entry.title}
                  onChange={(e) => {
                    const copy = [...distItems];
                    copy[idx] = { ...copy[idx], title: e.target.value };
                    setDistItems(copy);
                  }}
                  placeholder={`Titre du ${entry.mediaType === 'video' ? 'clip vidéo' : 'morceau'}`}
                  className="w-full rounded-xl bg-[#13161E] border border-white/10 px-3.5 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={entry.genre}
                  onChange={(e) => {
                    const copy = [...distItems];
                    copy[idx] = { ...copy[idx], genre: e.target.value };
                    setDistItems(copy);
                  }}
                  placeholder="Genre musical (Afro-Pop, Rap, Soul...)"
                  className="w-full rounded-xl bg-[#13161E] border border-white/10 px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>

          {/* DSP Distribution Targets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Plateformes cibles (DSP)
            </label>
            <div className="flex flex-wrap gap-2">
              {DSP_LIST.map((dsp) => {
                const active = selectedDsps.includes(dsp);
                return (
                  <button
                    key={dsp}
                    type="button"
                    onClick={() =>
                      setSelectedDsps((prev) =>
                        prev.includes(dsp) ? prev.filter((d) => d !== dsp) : [...prev, dsp]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                      active
                        ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                        : 'border-white/10 bg-[#0B0D12] text-slate-400'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{dsp}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Mode de règlement
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource('wallet')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-medium ${
                    paymentSource === 'wallet'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-white/10 bg-[#0B0D12] text-slate-400'
                  }`}
                >
                  Portefeuille ({formatFcfa(data.stats.walletBalance)})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource('direct_payment')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-medium ${
                    paymentSource === 'direct_payment'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-white/10 bg-[#0B0D12] text-slate-400'
                  }`}
                >
                  Paiement Direct (Mobile/Carte)
                </button>
              </div>
            </div>

            {paymentSource === 'direct_payment' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Moyen de paiement
                  </label>
                  <select
                    value={selectedPayCode}
                    onChange={(e) => setSelectedPayCode(e.target.value)}
                    className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {data.paymentMethods.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Numéro / Référence
                  </label>
                  <input
                    type="text"
                    required
                    value={accountRef}
                    onChange={(e) => setAccountRef(e.target.value)}
                    placeholder="+225 07 00 00 00"
                    className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {distMessage && (
            <div
              className={`rounded-xl px-4 py-3 text-xs border flex items-center gap-2 ${
                distMessage.type === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{distMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting
                ? 'Déploiement DSP en cours...'
                : `Lancer la distribution (${formatFcfa(data.config.distributionPackPrice)})`}
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Direct Single Upload */}
      {activeTab === 'upload' && (
        <form
          onSubmit={handleSingleUpload}
          className="rounded-2xl bg-[#13161E] border border-white/10 p-6 md:p-8 max-w-2xl space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">
              Publication Directe sur Steufa Stream
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Importez un fichier MP3/WAV ou MP4 HD, ou publiez un flux studio monétisé (65%
              plateforme / 35% artiste).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setUploadType('audio')}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                uploadType === 'audio'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                  : 'border-white/10 bg-[#0B0D12] text-slate-400'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Son Audio HD</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadType('video')}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                uploadType === 'video'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                  : 'border-white/10 bg-[#0B0D12] text-slate-400'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Clip Vidéo 4K</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Titre de la production
            </label>
            <input
              type="text"
              required
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Ex: Lumière d'Abidjan"
              className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Genre</label>
              <input
                type="text"
                value={uploadGenre}
                onChange={(e) => setUploadGenre(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tarif téléchargement (FCFA)
              </label>
              <input
                type="number"
                min={250}
                value={uploadPrice}
                onChange={(e) => setUploadPrice(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white font-mono-tabular focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Fichier source audio/vidéo (optionnel, sinon flux haute vitesse généré)
            </label>
            <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#0B0D12] py-5 px-4 cursor-pointer hover:border-amber-500/50 transition-colors">
              <Upload className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-300">
                {uploadFile ? uploadFile.name : 'Sélectionner un fichier MP3, WAV ou MP4'}
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {uploadStatus && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-300">
              {uploadStatus}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? 'Publication...' : 'Publier maintenant'}
          </button>
        </form>
      )}
    </div>
  );
};
