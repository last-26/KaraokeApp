import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LyricLine } from '../utils/srtParser';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

export const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Hangi satırın aktif olduğunu bul
  const activeIndex = lyrics.findIndex(
    l => currentTime >= l.startTime && currentTime <= l.endTime
  );

  // Otomatik Kaydırma Efekti
  useEffect(() => {
    if (activeIndex !== -1 && scrollViewRef.current) {
      // Her satır yaklaşık 60-80px. Aktif satırı ortaya getirmek için hesaplama:
      // (activeIndex * SatırYüksekliği) - (EkranYarısı)
      scrollViewRef.current.scrollTo({ y: activeIndex * 60, animated: true });
    }
  }, [activeIndex]);

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        ref={scrollViewRef} 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 200 }} /> 
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          // Eğer henüz şarkı o satıra gelmediyse veya geçtiyse daha soluk göster
          
          return (
            <View key={line.id} style={styles.line}>
              <Text style={[styles.text, isActive && styles.activeText]}>
                {line.text}
              </Text>
            </View>
          );
        })}
        <View style={{ height: 400 }} /> 
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    // Arka planı şeffaf yapıyoruz ki App.tsx'teki gradient görünsün
    backgroundColor: 'transparent', 
  },
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    paddingHorizontal: 20,
  },
  line: {
    minHeight: 60, // Satır yüksekliği
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  text: {
    fontSize: 22,
    color: '#ffffff', // Koyu arka plan için beyaz metin
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.4, // Pasif satırlar soluk
  },
  activeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700', // Altın sarısı aktif renk
    opacity: 1,       // Aktif satır tam görünür
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    transform: [{ scale: 1.1 }], // Hafif büyütme efekti
  },
});