import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { apiRequest, formatFcfa } from '../lib/api';
import { FinancialTransaction, PaymentMethod, UserProfile } from '../types';

interface WalletTransactionsViewProps {
  user: UserProfile;
  biometricVerified: boolean;
  onRequireBiometric: () => void;
  onUserUpdated: (user: UserProfile) => void;
}

interface SessionInfo {
  sessionId: string;
  biometricVerified: boolean;
  expiresAt: string;
  createdAt: string;
}

export const WalletTransactionsView: React.FC<WalletTransactionsViewProps> = ({
  user,
  biometricVerified,
  onRequireBiometric,
  onUserUpdated,
}) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [txMode, setTxMode] = useState<'deposit' | 'withdrawal'>('withdrawal');
  const [selectedCode, setSelectedCode] = useState('');
  const [amount, setAmount] = useState('25000');
  const [accountRef, setAccountRef] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const [dash, meth, me] = await Promise.all([
        apiRequest<{ transactions: FinancialTransaction[]; user: UserProfile }>(
          '/api/artist/dashboard'
        ),
        apiRequest<{ methods: PaymentMethod[] }>('/api/wallet/methods'),
        apiRequest<{ activeSessions: SessionInfo[]; user: UserProfile }>('/api/auth/me'),
      ]);
      setTransactions(dash.transactions);
      setMethods(meth.methods);
      setSessions(me.activeSessions);
      onUserUpdated(me.user);
      if (meth.methods.length > 0 && !selectedCode) {
        setSelectedCode(meth.methods[0].code);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [user.id, biometricVerified]);

  const availableMethods = methods.filter((m) =>
    txMode === 'deposit' ? m.supportsDeposit : m.supportsWithdrawal
  );

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.some((m) => m.code === selectedCode)) {
      setSelectedCode(availableMethods[0].code);
    }
  }, [txMode, methods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const endpoint = txMode === 'deposit' ? '/api/wallet/deposit' : '/api/wallet/withdraw';
      const res = await apiRequest<{ user: UserProfile }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          amountFcfa: Number(amount),
          paymentMethodCode: selectedCode,
          accountReference: accountRef,
        }),
      });
      onUserUpdated(res.user);
      setAccountRef('');
      setFeedback({
        type: 'ok',
        text:
          txMode === 'deposit'
            ? `Dépôt de ${formatFcfa(Number(amount))} crédité et signé.`
            : `Retrait de ${formatFcfa(Number(amount))} exécuté avec signature chiffrée.`,
      });
      await loadWallet();
    } catch (err: unknown) {
      const typedErr = err as Error & { requiresBiometric?: boolean };
      if (typedErr.requiresBiometric) {
        onRequireBiometric();
      }
      setFeedback({
        type: 'err',
        text: typedErr.message || 'Opération financière refusée.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiRequest(`/api/auth/sessions/${sessionId}/revoke`, { method: 'POST' });
      await loadWallet();
    } catch {
      // ignore
    }
  };

  const activeMethodObj = availableMethods.find((m) => m.code === selectedCode);

  return (
    <div className="space-y-8">
      {/* Top Financial Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl bg-[#13161E] border border-white/10 p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-400">Portefeuille Sécurisé</p>
            <div className="text-3xl font-bold text-white font-mono-tabular mt-2">
              {formatFcfa(user.walletBalance)}
            </div>
            <div className="text-xs text-emerald-400 mt-1 font-mono-tabular">
              Revenus cumulés : {formatFcfa(user.totalEarned)}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  user.biometricEnabled
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {user.biometricEnabled
                    ? biometricVerified
                      ? 'Biométrie activée et vérifiée'
                      : 'Biométrie activée (verrouillée)'
                    : 'Biométrie non activée'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Protège chaque retrait financier
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onRequireBiometric}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white whitespace-nowrap"
            >
              {user.biometricEnabled ? 'Vérifier' : 'Activer'}
            </button>
          </div>
        </div>

        {/* Deposit / Withdrawal Intuitive Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 rounded-2xl bg-[#13161E] border border-white/10 p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-white">
              Transactions Financières Sécurisées
            </h2>
            <div className="flex items-center gap-1 p-1 bg-[#0B0D12] rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setTxMode('withdrawal');
                  setFeedback(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  txMode === 'withdrawal'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Retrait</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxMode('deposit');
                  setFeedback(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  txMode === 'deposit'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Dépôt</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Canal de {txMode === 'deposit' ? 'dépôt' : 'retrait'}
              </label>
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {availableMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.feePercent}% frais)
                  </option>
                ))}
              </select>
              {activeMethodObj && (
                <p className="text-[11px] text-slate-400 mt-1.5">{activeMethodObj.instructions}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Montant (FCFA)
              </label>
              <input
                type="number"
                required
                min={activeMethodObj?.minAmount || 500}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-3.5 py-2.5 text-sm text-white font-mono-tabular focus:outline-none focus:border-amber-500"
              />
              {activeMethodObj && (
                <p className="text-[11px] text-slate-400 mt-1.5 font-mono-tabular">
                  Min {formatFcfa(activeMethodObj.minAmount)} · Max{' '}
                  {formatFcfa(activeMethodObj.maxAmount)}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Compte bénéficiaire / Numéro Mobile Money ou IBAN
            </label>
            <input
              type="text"
              required
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder="Ex: +225 07 12 34 56 78 ou CI93..."
              className="w-full rounded-xl bg-[#0B0D12] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {feedback && (
            <div
              className={`rounded-xl px-4 py-2.5 text-xs border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || availableMethods.length === 0}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting
                ? 'Signature en cours...'
                : txMode === 'deposit'
                ? 'Confirmer le dépôt'
                : 'Autoriser le retrait'}
            </button>
          </div>
        </form>
      </div>

      {/* Signed Ledger & Encrypted Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl bg-[#13161E] border border-white/10 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">
              Historique des Transactions Signées (HMAC-SHA256)
            </h3>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>

          {loading ? (
            <div className="h-32 animate-pulse bg-[#0B0D12] rounded-xl" />
          ) : transactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Aucune transaction financière enregistrée.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-slate-400">
                    <th className="pb-3 font-medium">Opération</th>
                    <th className="pb-3 font-medium">Canal</th>
                    <th className="pb-3 font-medium text-right">Brut</th>
                    <th className="pb-3 font-medium text-right">Part Plateforme</th>
                    <th className="pb-3 font-medium text-right">Net Artiste</th>
                    <th className="pb-3 font-medium text-right">Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-white">{tx.description}</div>
                        <div className="text-slate-500 mt-0.5">
                          {new Date(tx.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </td>
                      <td className="py-3 text-slate-300">{tx.accountReference || '-'}</td>
                      <td className="py-3 text-right font-mono-tabular text-white">
                        {formatFcfa(tx.grossAmountFcfa)}
                      </td>
                      <td className="py-3 text-right font-mono-tabular text-slate-400">
                        {formatFcfa(tx.platformShareFcfa)}
                      </td>
                      <td className="py-3 text-right font-mono-tabular text-emerald-400">
                        {formatFcfa(tx.artistShareFcfa)}
                      </td>
                      <td className="py-3 text-right font-mono-tabular text-slate-500">
                        {tx.signatureHash.slice(0, 10)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 rounded-2xl bg-[#13161E] border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Sessions Chiffrées Actives</h3>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="rounded-xl bg-[#0B0D12] border border-white/5 p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono-tabular text-white truncate">
                    AES-256 · {s.sessionId.slice(0, 12)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {s.biometricVerified ? 'Biométrie validée' : 'Session standard'} · Expire le{' '}
                    {new Date(s.expiresAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSession(s.sessionId)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  title="Révoquer cette session"
                  aria-label="Révoquer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
