import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  clearEncryptedSession,
  mobileApi,
  saveEncryptedSession,
} from './src/services/api';
import { StreamingScreen } from './src/screens/StreamingScreen';
import { WalletTransactionsScreen } from './src/screens/WalletTransactionsScreen';

interface MobileUser {
  id: number;
  email: string;
  displayName: string;
  role: 'listener' | 'artist' | 'ceo';
  walletBalance: number;
}

export default function App() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [tab, setTab] = useState<'stream' | 'wallet' | 'auth'>('stream');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await mobileApi<{ token: string; user: MobileUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await saveEncryptedSession(res.token);
      setUser(res.user);
      setTab('wallet');
    } catch (err: unknown) {
      Alert.alert('Connexion refusée', err instanceof Error ? err.message : 'Erreur');
    }
  };

  const refreshMe = async () => {
    try {
      const res = await mobileApi<{ user: MobileUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    await clearEncryptedSession();
    setUser(null);
    setTab('stream');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>Steufa Stream Mobile</Text>
        {user ? (
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.link}>Déconnexion</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setTab('auth')}>
            <Text style={styles.link}>Connexion</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'stream' && <StreamingScreen />}
        {tab === 'wallet' && user && (
          <WalletTransactionsScreen walletBalance={user.walletBalance} onReload={refreshMe} />
        )}
        {(tab === 'auth' || (tab === 'wallet' && !user)) && (
          <View style={styles.authBox}>
            <Text style={styles.authTitle}>Connexion Sécurisée</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Adresse email"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor="#64748B"
              secureTextEntry
              style={styles.input}
            />
            <TouchableOpacity style={styles.btn} onPress={handleLogin}>
              <Text style={styles.btnText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('stream')}>
          <Text style={[styles.tabText, tab === 'stream' && styles.tabActive]}>Streaming</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab(user ? 'wallet' : 'auth')}>
          <Text style={[styles.tabText, tab === 'wallet' && styles.tabActive]}>Transactions</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D12' },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brand: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  link: { color: '#F59E0B', fontSize: 13, fontWeight: '600' },
  authBox: { flex: 1, padding: 20, justifyContent: 'center' },
  authTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: '#13161E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  btn: { backgroundColor: '#F59E0B', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#0B0D12', fontWeight: '700', fontSize: 15 },
  tabBar: {
    height: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#13161E',
  },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  tabActive: { color: '#F59E0B' },
});
