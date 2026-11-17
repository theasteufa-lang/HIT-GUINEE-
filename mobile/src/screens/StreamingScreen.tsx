import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { formatFcfaMobile, mobileApi } from '../services/api';

interface MediaRow {
  id: number;
  title: string;
  artistDisplay: string;
  mediaType: 'audio' | 'video';
  genre: string;
  playsCount: number;
  streamUrl: string;
  priceFcfa: number;
}

export const StreamingScreen: React.FC = () => {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [soundObj, setSoundObj] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    mobileApi<{ items: MediaRow[] }>('/api/catalog')
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));

    return () => {
      if (soundObj) {
        soundObj.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const handlePlay = async (item: MediaRow) => {
    try {
      if (soundObj) {
        await soundObj.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: `https://ais-dev-k4ssi6rmnpnzpzt7qm4wvp-227196533962.europe-west2.run.app${item.streamUrl}` },
        { shouldPlay: true }
      );
      setSoundObj(sound);
      setActiveId(item.id);
      await mobileApi(`/api/media/${item.id}/play`, { method: 'POST' });
    } catch {
      // fallback gracefully
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F59E0B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Steufa Stream — Audio & Clips 4K</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const playing = activeId === item.id;
          return (
            <View style={[styles.card, playing && styles.cardActive]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.sub}>
                  {item.artistDisplay} · {item.mediaType === 'video' ? 'Clip 4K' : 'Audio FLAC'} ·{' '}
                  {item.playsCount} lectures
                </Text>
                <Text style={styles.price}>{formatFcfaMobile(item.priceFcfa)} (Téléchargement HD)</Text>
              </View>
              <TouchableOpacity style={styles.playBtn} onPress={() => handlePlay(item)}>
                <Text style={styles.playBtnText}>{playing ? 'En cours' : 'Lire'}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D12', padding: 16 },
  center: { flex: 1, backgroundColor: '#0B0D12', justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#F3F4F6', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  card: {
    backgroundColor: '#13161E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardActive: { borderColor: '#F59E0B' },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  sub: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  price: { color: '#F59E0B', fontSize: 12, marginTop: 4, fontWeight: '600' },
  playBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  playBtnText: { color: '#0B0D12', fontWeight: '700', fontSize: 12 },
});
