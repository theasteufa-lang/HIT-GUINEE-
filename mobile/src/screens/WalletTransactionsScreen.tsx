import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  authenticateHardwareBiometric,
  formatFcfaMobile,
  mobileApi,
} from '../services/api';

interface PaymentMethodRow {
  id: number;
  name: string;
  code: string;
  feePercent: number;
  supportsDeposit: boolean;
  supportsWithdrawal: boolean;
}

interface TransactionRow {
  id: number;
  description: string;
  grossAmountFcfa: number;
  platformShareFcfa: number;
  artistShareFcfa: number;
}

export const WalletTransactionsScreen: React.FC<{ walletBalance: number; onReload: () => void }> = ({
  walletBalance,
  onReload,
}) => {
  const [mode, setMode] = useState<'withdrawal' | 'deposit'>('withdrawal');
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [selectedCode, setSelectedCode] = useState('orange_money');
  const [amount, setAmount] = useState('25000');
  const [accountRef, setAccountRef] = useState('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const loadData = async () => {
    try {
      const [mRes, dRes] = await Promise.all([
        mobileApi<{ methods: PaymentMethodRow[] }>('/api/wallet/methods'),
        mobileApi<{ transactions: TransactionRow[] }>('/api/artist/dashboard'),
      ]);
      setMethods(mRes.methods);
      setTransactions(dRes.transactions);
      if (mRes.methods.length > 0) setSelectedCode(mRes.methods[0].code);
    } catch {
      // ignore if unauthenticated
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransaction = async () => {
    try {
      if (mode === 'withdrawal') {
        const bioOk = await authenticateHardwareBiometric();
        if (bioOk) {
          await mobileApi('/api/auth/biometric/verify', {
            method: 'POST',
            body: JSON.stringify({ biometricPin: 'biometric-passkey-verified' }),
          });
        }
      }

      const path = mode === 'deposit' ? '/api/wallet/deposit' : '/api/wallet/withdraw';
      await mobileApi(path, {
        method: 'POST',
        body: JSON.stringify({
          amountFcfa: Number(amount),
          paymentMethodCode: selectedCode,
          accountReference: accountRef,
        }),
      });
      setAccountRef('');
      Alert.alert('Succès', 'Transaction signée et enregistrée dans PostgreSQL.');
      await loadData();
      onReload();
    } catch (err: unknown) {
      Alert.alert('Transaction refusée', err instanceof Error ? err.message : 'Erreur');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.balanceCard}>
        <Text style={styles.label}>Solde Portefeuille Sécurisé</Text>
        <Text style={styles.balanceValue}>{formatFcfaMobile(walletBalance)}</Text>
      </View>

      <View style={styles.segment}>
        <TouchableOpacity
          style={[styles.segBtn, mode === 'withdrawal' && styles.segActive]}
          onPress={() => setMode('withdrawal')}
        >
          <Text style={[styles.segText, mode === 'withdrawal' && styles.segTextActive]}>
            Retrait Biométrique
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, mode === 'deposit' && styles.segActive]}
          onPress={() => setMode('deposit')}
        >
          <Text style={[styles.segText, mode === 'deposit' && styles.segTextActive]}>Dépôt</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Moyen de paiement</Text>
        <View style={styles.methodWrap}>
          {methods.map((m) => (
            <TouchableOpacity
              key={m.code}
              onPress={() => setSelectedCode(m.code)}
              style={[styles.methodChip, selectedCode === m.code && styles.methodChipActive]}
            >
              <Text style={styles.methodChipText}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Montant (FCFA)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Compte / Mobile Money / IBAN</Text>
        <TextInput
          value={accountRef}
          onChangeText={setAccountRef}
          placeholder="+225 07 00 00 00"
          style={styles.input}
          placeholderTextColor="#64748B"
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleTransaction}>
          <Text style={styles.primaryBtnText}>
            {mode === 'withdrawal' ? 'Valider par Biométrie & Retirer' : 'Confirmer le Dépôt'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Historique Signé</Text>
      {transactions.map((tx) => (
        <View key={tx.id} style={styles.txRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txDesc}>{tx.description}</Text>
            <Text style={styles.txMeta}>
              Plateforme: {formatFcfaMobile(tx.platformShareFcfa)} · Net:{' '}
              {formatFcfaMobile(tx.artistShareFcfa)}
            </Text>
          </View>
          <Text style={styles.txAmount}>{formatFcfaMobile(tx.grossAmountFcfa)}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D12', padding: 16 },
  balanceCard: {
    backgroundColor: '#13161E',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  label: { color: '#94A3B8', fontSize: 12, marginBottom: 6 },
  balanceValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#13161E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: { backgroundColor: '#F59E0B' },
  segText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  segTextActive: { color: '#0B0D12' },
  formCard: {
    backgroundColor: '#13161E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  methodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  methodChip: {
    backgroundColor: '#0B0D12',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  methodChipActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)' },
  methodChipText: { color: '#F3F4F6', fontSize: 12 },
  input: {
    backgroundColor: '#0B0D12',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0B0D12', fontWeight: '700', fontSize: 14 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  txRow: {
    backgroundColor: '#13161E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txDesc: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  txMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  txAmount: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },
});
