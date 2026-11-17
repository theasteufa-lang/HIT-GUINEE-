import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Database,
  Edit3,
  Lock,
  Plus,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { apiRequest, formatFcfa } from '../lib/api';
import {
  FinancialTransaction,
  MediaItem,
  PaymentMethod,
  PlatformPricing,
  UserProfile,
} from '../types';

interface CeoOverviewPayload {
  config: PlatformPricing & { id: number; treasuryBalance: number; updatedAt: string };
  vaultMetadata: { vaultTitle?: string; clearanceLevel?: string; auditNotes?: string };
  media: MediaItem[];
  users: UserProfile[];
  paymentMethods: PaymentMethod[];
  transactions: FinancialTransaction[];
}

interface CatalogsPdgViewProps {
  onRefreshPublic: () => void;
}

export const CatalogsPdgView: React.FC<CatalogsPdgViewProps> = ({ onRefreshPublic }) => {
  const [data, setData] = useState<CeoOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'treasury' | 'methods' | 'catalog' | 'rules' | 'users'>(
    'treasury'
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // CEO Treasury Deposit/Withdrawal form
  const [ceoTxType, setCeoTxType] = useState<'deposit' | 'withdrawal'>('withdrawal');
  const [ceoAmount, setCeoAmount] = useState('150000');
  const [ceoMethodCode, setCeoMethodCode] = useState('ceo_treasury_wire');
  const [ceoAccountRef, setCeoAccountRef] = useState('');
  const [ceoNotes, setCeoNotes] = useState('');

  // New Payment Method form (PDG & Artistes)
  const [pmName, setPmName] = useState('');
  const [pmCode, setPmCode] = useState('');
  const [pmScope, setPmScope] = useState<'both' | 'artist' | 'ceo'>('both');
  const [pmDeposit, setPmDeposit] = useState(true);
  const [pmWithdraw, setPmWithdraw] = useState(true);
  const [pmFee, setPmFee] = useState('0');
  const [pmInstructions, setPmInstructions] = useState('');

  // Platform Rules Editor
  const [platformPct, setPlatformPct] = useState('65');
  const [packPrice, setPackPrice] = useState('200000');
  const [streamRate, setStreamRate] = useState('50');
  const [videoRate, setVideoRate] = useState('100');
  const [dlRate, setDlRate] = useState('250');
  const [auditNotes, setAuditNotes] = useState('');

  // New Exclusive CEO Media form
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('Steufa Executive Archive');
  const [newType, setNewType] = useState<'audio' | 'video'>('audio');
  const [newPrice, setNewPrice] = useState('1500');
  const [newPrivate, setNewPrivate] = useState(true);

  const loadCeoVault = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<CeoOverviewPayload>('/api/catalogspdg/overview');
      setData(res);
      setPlatformPct(String(res.config.platformSharePercent));
      setPackPrice(String(res.config.distributionPackPrice));
      setStreamRate(String(res.config.streamRateFcfa));
      setVideoRate(String(res.config.videoViewRateFcfa));
      setDlRate(String(res.config.downloadRateFcfa));
      setAuditNotes(res.vaultMetadata.auditNotes || '');
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Accès refusé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCeoVault();
  }, []);

  const handleCeoTreasuryTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await apiRequest('/api/catalogspdg/treasury/transaction', {
        method: 'POST',
        body: JSON.stringify({
          txType: ceoTxType,
          amountFcfa: Number(ceoAmount),
          paymentMethodCode: ceoMethodCode,
          accountReference: ceoAccountRef || 'Trésorerie Direction PDG',
          notes: ceoNotes || undefined,
        }),
      });
      setCeoAccountRef('');
      setCeoNotes('');
      setStatusMsg('Opération trésorerie PDG enregistrée.');
      await loadCeoVault();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Erreur trésorerie.');
    }
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await apiRequest('/api/catalogspdg/payment-methods', {
        method: 'POST',
        body: JSON.stringify({
          name: pmName,
          code: pmCode || pmName,
          ownerScope: pmScope,
          supportsDeposit: pmDeposit,
          supportsWithdrawal: pmWithdraw,
          feePercent: Number(pmFee),
          instructions: pmInstructions,
        }),
      });
      setPmName('');
      setPmCode('');
      setPmInstructions('');
      setStatusMsg('Nouveau moyen de dépôt/retrait ajouté et actif.');
      await loadCeoVault();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Impossible d’ajouter ce moyen.');
    }
  };

  const handleToggleMethod = async (m: PaymentMethod) => {
    await apiRequest(`/api/catalogspdg/payment-methods/${m.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    await loadCeoVault();
  };

  const handleDeleteMethod = async (id: number) => {
    await apiRequest(`/api/catalogspdg/payment-methods/${id}`, { method: 'DELETE' });
    await loadCeoVault();
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await apiRequest('/api/catalogspdg/config', {
        method: 'PATCH',
        body: JSON.stringify({
          platformSharePercent: Number(platformPct),
          distributionPackPrice: Number(packPrice),
          streamRateFcfa: Number(streamRate),
          videoViewRateFcfa: Number(videoRate),
          downloadRateFcfa: Number(dlRate),
          auditNotes,
        }),
      });
      setStatusMsg('Règles de monétisation et coffre chiffré mis à jour.');
      await loadCeoVault();
      onRefreshPublic();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Erreur de sauvegarde.');
    }
  };

  const handleAddCeoMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await apiRequest('/api/catalogspdg/media', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          artistDisplay: newArtist,
          mediaType: newType,
          priceFcfa: Number(newPrice),
          isPrivateVault: newPrivate,
          isFeatured: !newPrivate,
        }),
      });
      setNewTitle('');
      setStatusMsg('Élément ajouté au catalogue.');
      await loadCeoVault();
      onRefreshPublic();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Erreur ajout média.');
    }
  };

  const handleToggleMediaFlag = async (
    item: MediaItem,
    field: 'isPublished' | 'isFeatured' | 'isPrivateVault' | 'monetized'
  ) => {
    await apiRequest(`/api/catalogspdg/media/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: !item[field] }),
    });
    await loadCeoVault();
    onRefreshPublic();
  };

  const handleEditMediaPrice = async (item: MediaItem) => {
    const nextPrice = window.prompt(`Nouveau tarif (FCFA) pour "${item.title}" :`, String(item.priceFcfa));
    if (!nextPrice) return;
    await apiRequest(`/api/catalogspdg/media/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priceFcfa: Number(nextPrice) }),
    });
    await loadCeoVault();
    onRefreshPublic();
  };

  const handleDeleteMedia = async (id: number) => {
    await apiRequest(`/api/catalogspdg/media/${id}`, { method: 'DELETE' });
    await loadCeoVault();
    onRefreshPublic();
  };

  const handleAdjustUser = async (u: UserProfile, delta: number) => {
    await apiRequest(`/api/catalogspdg/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ walletAdjustment: delta }),
    });
    await loadCeoVault();
  };

  const handleToggleUserActive = async (u: UserProfile) => {
    await apiRequest(`/api/catalogspdg/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    await loadCeoVault();
  };

  if (loading || !data) {
    return (
      <div className="rounded-2xl bg-[#13161E] border border-white/10 p-8 text-sm text-slate-400">
        Déchiffrement du coffre-fort Direction Générale en cours...
      </div>
    );
  }

  const ceoMethods = data.paymentMethods.filter(
    (m) => m.isActive && (m.ownerScope === 'ceo' || m.ownerScope === 'both')
  );

  return (
    <div className="space-y-8">
      {/* Executive Header */}
      <div className="rounded-2xl bg-[#13161E] border border-amber-500/30 p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
            <Lock className="w-4 h-4" />
            <span>Coffre-Fort Privé Direction Générale · Accès Restreint Chiffré</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            CatalogsPDG — Administration & Trésorerie Totale
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Contrôle complet des catalogues privés et publics, répartition {data.config.platformSharePercent}% /{' '}
            {data.config.artistSharePercent}%, moyens de dépôt/retrait PDG & Artistes.
          </p>
        </div>

        <div className="rounded-2xl bg-[#0B0D12] border border-white/10 px-6 py-4 shrink-0">
          <div className="text-xs text-slate-400">Trésorerie Plateforme ({data.config.platformSharePercent}%)</div>
          <div className="text-2xl md:text-3xl font-bold text-amber-400 font-mono-tabular mt-1">
            {formatFcfa(data.config.treasuryBalance)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#13161E] rounded-2xl border border-white/10">
        {[
          { id: 'treasury' as const, label: 'Trésorerie & Dépôt/Retrait PDG', icon: Database },
          { id: 'methods' as const, label: 'Moyens Paiement (PDG & Artistes)', icon: CreditCard },
          { id: 'catalog' as const, label: 'Catalogue Global & Coffre Privé', icon: Edit3 },
          { id: 'rules' as const, label: 'Règles 65/35 & Tarifs', icon: Settings },
          { id: 'users' as const, label: 'Artistes & Comptes', icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {statusMsg && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-200">
          {statusMsg}
        </div>
      )}

      {/* TAB 1: CEO TREASURY & TRANSACTIONS */}
      {tab === 'treasury' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCeoTreasuryTx}
            className="lg:col-span-5 rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-white">
              Dépôt & Retrait Trésorerie PDG
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCeoTxType('withdrawal')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold ${
                  ceoTxType === 'withdrawal'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#0B0D12] text-slate-400'
                }`}
              >
                Retrait PDG
              </button>
              <button
                type="button"
                onClick={() => setCeoTxType('deposit')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold ${
                  ceoTxType === 'deposit'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#0B0D12] text-slate-400'
                }`}
              >
                Injection / Dépôt PDG
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Moyen de paiement PDG</label>
              <select
                value={ceoMethodCode}
                onChange={(e) => setCeoMethodCode(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white"
              >
                {ceoMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.ownerScope})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Montant (FCFA)</label>
              <input
                type="number"
                required
                min={1000}
                value={ceoAmount}
                onChange={(e) => setCeoAmount(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-sm text-white font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Référence compte / IBAN / Mobile Money PDG
              </label>
              <input
                type="text"
                required
                value={ceoAccountRef}
                onChange={(e) => setCeoAccountRef(e.target.value)}
                placeholder="Compte Direction Steufa"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Note interne (chiffrée)</label>
              <input
                type="text"
                value={ceoNotes}
                onChange={(e) => setCeoNotes(e.target.value)}
                placeholder="Ex: Prélèvement dividendes mensuels"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm"
            >
              Exécuter l'opération PDG
            </button>
          </form>

          <div className="lg:col-span-7 rounded-2xl bg-[#13161E] border border-white/10 p-6">
            <h2 className="text-base font-semibold text-white mb-4">
              Grand Livre Global (Plateforme 65% · Artistes 35% · PDG)
            </h2>
            <div className="overflow-x-auto max-h-[440px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-2.5">Description</th>
                    <th className="pb-2.5">Scope</th>
                    <th className="pb-2.5 text-right">Brut</th>
                    <th className="pb-2.5 text-right">Part Steufa</th>
                    <th className="pb-2.5 text-right">Part Artiste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-3">
                        <div className="text-white font-medium">{tx.description}</div>
                        <div className="text-slate-500">{tx.accountReference}</div>
                      </td>
                      <td className="py-2.5 text-slate-300">{tx.scope}</td>
                      <td className="py-2.5 text-right font-mono-tabular text-white">
                        {formatFcfa(tx.grossAmountFcfa)}
                      </td>
                      <td className="py-2.5 text-right font-mono-tabular text-amber-400">
                        {formatFcfa(tx.platformShareFcfa)}
                      </td>
                      <td className="py-2.5 text-right font-mono-tabular text-emerald-400">
                        {formatFcfa(tx.artistShareFcfa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT METHODS (PDG & ARTISTS) */}
      {tab === 'methods' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddPaymentMethod}
            className="lg:col-span-5 rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Ajouter un Moyen de Dépôt / Retrait</span>
            </h2>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Nom du canal</label>
              <input
                type="text"
                required
                value={pmName}
                onChange={(e) => setPmName(e.target.value)}
                placeholder="Ex: Moov Money / PayPal / USDT TRC20"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Code unique</label>
                <input
                  type="text"
                  required
                  value={pmCode}
                  onChange={(e) => setPmCode(e.target.value)}
                  placeholder="moov_money"
                  className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Destinataire</label>
                <select
                  value={pmScope}
                  onChange={(e) => setPmScope(e.target.value as 'both' | 'artist' | 'ceo')}
                  className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white"
                >
                  <option value="both">PDG & Artistes</option>
                  <option value="artist">Artistes uniquement</option>
                  <option value="ceo">PDG uniquement</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={pmDeposit}
                  onChange={(e) => setPmDeposit(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Dépôt</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={pmWithdraw}
                  onChange={(e) => setPmWithdraw(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Retrait</span>
              </label>
              <div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={pmFee}
                  onChange={(e) => setPmFee(e.target.value)}
                  placeholder="Frais %"
                  className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-2.5 py-2 text-xs text-white font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Instructions affichées</label>
              <input
                type="text"
                value={pmInstructions}
                onChange={(e) => setPmInstructions(e.target.value)}
                placeholder="Délai et coordonnées requises"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm"
            >
              Enregistrer ce moyen de paiement
            </button>
          </form>

          <div className="lg:col-span-7 rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-3">
            <h2 className="text-base font-semibold text-white mb-2">
              Moyens de Dépôt & Retrait Configurés ({data.paymentMethods.length})
            </h2>
            {data.paymentMethods.map((m) => (
              <div
                key={m.id}
                className="rounded-xl bg-[#0B0D12] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    {m.name}{' '}
                    <span className="text-xs font-normal text-amber-400">· Scope: {m.ownerScope}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {m.supportsDeposit ? 'Dépôt Oui' : 'Dépôt Non'} ·{' '}
                    {m.supportsWithdrawal ? 'Retrait Oui' : 'Retrait Non'} · Frais {m.feePercent}%
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleMethod(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      m.isActive
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {m.isActive ? 'Actif' : 'Désactivé'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMethod(m.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL & PRIVATE VAULT CATALOG */}
      {tab === 'catalog' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddCeoMedia}
            className="rounded-2xl bg-[#13161E] border border-white/10 p-6 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Nouveau titre / archive</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Master Secret Studio"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Artiste</label>
              <input
                type="text"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Format</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'audio' | 'video')}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2 text-xs text-white"
              >
                <option value="audio">Audio HD</option>
                <option value="video">Clip Vidéo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Prix (FCFA)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3 py-2 text-xs text-white font-mono-tabular"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={newPrivate}
                  onChange={(e) => setNewPrivate(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Privé PDG</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs whitespace-nowrap"
              >
                Ajouter
              </button>
            </div>
          </form>

          <div className="rounded-2xl bg-[#13161E] border border-white/10 p-6 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-3">Titre</th>
                  <th className="pb-3">Visibilité</th>
                  <th className="pb-3 text-right">Prix</th>
                  <th className="pb-3 text-right">Lectures</th>
                  <th className="pb-3 text-right">Revenu Brut</th>
                  <th className="pb-3 text-right">Contrôles PDG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.media.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-white">{m.title}</div>
                      <div className="text-slate-400">
                        {m.artistDisplay} · {m.mediaType}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={m.isPrivateVault ? 'text-amber-400' : 'text-emerald-400'}>
                        {m.isPrivateVault ? 'Coffre Privé PDG' : m.isPublished ? 'Public' : 'Masqué'}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono-tabular">
                      <button
                        type="button"
                        onClick={() => handleEditMediaPrice(m)}
                        className="text-white hover:text-amber-400 underline decoration-dotted"
                      >
                        {formatFcfa(m.priceFcfa)}
                      </button>
                    </td>
                    <td className="py-3 text-right font-mono-tabular text-slate-300">
                      {m.playsCount}
                    </td>
                    <td className="py-3 text-right font-mono-tabular text-amber-400">
                      {formatFcfa(m.grossRevenueFcfa)}
                    </td>
                    <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleMediaFlag(m, 'isPrivateVault')}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                      >
                        {m.isPrivateVault ? 'Rendre Public' : 'Mettre Privé'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMediaFlag(m, 'isFeatured')}
                        className={`px-2.5 py-1 rounded-lg ${
                          m.isFeatured
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        Vedette
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMedia(m.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 align-middle"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MONETIZATION 65/35 & DISTRIBUTOR PRICING */}
      {tab === 'rules' && (
        <form
          onSubmit={handleSaveRules}
          className="rounded-2xl bg-[#13161E] border border-white/10 p-6 md:p-8 max-w-3xl space-y-5"
        >
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4" />
            <span>Configuration Chiffrée des Revenus & Packs Distributeur</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">
                Part Plateforme Steufa (%) — Défaut 65%
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={platformPct}
                onChange={(e) => setPlatformPct(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white font-mono-tabular"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Part Artiste automatique : {100 - Number(platformPct || 0)}%
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">
                Prix Pack Distributeur (2 Sons / 1+1 / 2+2)
              </label>
              <input
                type="number"
                min={1000}
                value={packPrice}
                onChange={(e) => setPackPrice(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">
                Monétisation / Stream Audio (FCFA)
              </label>
              <input
                type="number"
                value={streamRate}
                onChange={(e) => setStreamRate(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">
                Monétisation / Vue Clip 4K (FCFA)
              </label>
              <input
                type="number"
                value={videoRate}
                onChange={(e) => setVideoRate(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">
                Tarif minimum Téléchargement HD (FCFA)
              </label>
              <input
                type="number"
                value={dlRate}
                onChange={(e) => setDlRate(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">
              Notes de gouvernance (chiffrées AES-256-GCM en base PostgreSQL)
            </label>
            <textarea
              rows={3}
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm"
          >
            Sauvegarder les règles globales
          </button>
        </form>
      )}

      {/* TAB 5: USERS & ARTISTS */}
      {tab === 'users' && (
        <div className="rounded-2xl bg-[#13161E] border border-white/10 p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-3">Utilisateur / Artiste</th>
                <th className="pb-3">Rôle</th>
                <th className="pb-3">Biométrie</th>
                <th className="pb-3 text-right">Solde</th>
                <th className="pb-3 text-right">Actions PDG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-white">{u.displayName}</div>
                    <div className="text-slate-400">{u.email}</div>
                  </td>
                  <td className="py-3 text-slate-300">{u.role}</td>
                  <td className="py-3 text-slate-300">
                    {u.biometricEnabled ? 'Activée' : 'Non activée'}
                  </td>
                  <td className="py-3 text-right font-mono-tabular text-amber-400">
                    {formatFcfa(u.walletBalance)}
                  </td>
                  <td className="py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleAdjustUser(u, 50000)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300"
                    >
                      +50 000
                    </button>
                    {u.role !== 'ceo' && (
                      <button
                        type="button"
                        onClick={() => handleToggleUserActive(u)}
                        className={`px-2.5 py-1 rounded-lg ${
                          u.isActive
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {u.isActive ? 'Suspendre' : 'Réactiver'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
