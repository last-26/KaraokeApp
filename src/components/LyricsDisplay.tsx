import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutChangeEvent, Animated } from 'react-native';
import { LyricLine } from '../utils/srtParser';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

// Yanıp sönen nokta animasyonu için ufak bir bileşen
const PulseIcon = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.Text style={[styles.instrumentalIcon, { opacity }]}>
      🎵 Ara Müzik 🎵
    </Animated.Text>
  );
};

export const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Her satırın Y pozisyonunu ve yüksekliğini saklamak için ref
  const itemsLayout = useRef<{ [key: string]: { y: number; height: number } }>({});

  // Hangi satırın aktif olduğunu bul
  const activeIndex = lyrics.findIndex(
    l => currentTime >= l.startTime && currentTime <= l.endTime
  );

  // Otomatik Kaydırma Efekti
  useEffect(() => {
    if (activeIndex !== -1 && scrollViewRef.current && containerHeight > 0) {
      const activeId = lyrics[activeIndex].id;
      const currentItem = itemsLayout.current[activeId];
      
      if (currentItem) {
        // Hedef Scroll Noktası = (Satırın Y konumu) + (Satır Yüksekliği / 2) - (Ekran Yüksekliği / 2)
        const scrollToY = currentItem.y + (currentItem.height / 2) - (containerHeight / 2);
        
        scrollViewRef.current.scrollTo({ 
          y: scrollToY, 
          animated: true 
        });
      }
    }
  }, [activeIndex, containerHeight]);

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        ref={scrollViewRef} 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e: LayoutChangeEvent) => {
          setContainerHeight(e.nativeEvent.layout.height);
        }}
      >
        {/* Üst kısımdaki boşluk */}
        <View style={{ height: containerHeight / 2 - 40 }} /> 
        
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          
          return (
            <View 
              key={line.id} 
              style={styles.line}
              onLayout={(e: LayoutChangeEvent) => {
                const layout = e.nativeEvent.layout;
                itemsLayout.current[line.id] = {
                  y: layout.y,
                  height: layout.height
                };
              }}
            >
              {line.isInstrumental ? (
                isActive ? <PulseIcon /> : <Text style={styles.instrumentalText}>• • •</Text>
              ) : (
                <Text style={[styles.text, isActive && styles.activeText]}>
                  {line.text}
                </Text>
              )}
            </View>
          );
        })}
        
        {/* Alt kısımdaki boşluk */}
        <View style={{ height: containerHeight / 2 }} /> 
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
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
    minHeight: 60, 
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24, // Biraz daha ferah aralık
    width: '100%',
  },
  // PASİF SATIRLAR: Daha yumuşak, mavimsi beyaz
  text: {
    fontSize: 22,
    color: '#E1F5FE', // Hafif mavimsi beyaz (Pastel)
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.5, // Biraz daha görünür ama hala pasif
    letterSpacing: 0.5,
  },
  // AKTİF SATIR: Pastel Amber (Yumuşak Altın)
  activeText: {
    fontSize: 30, // Biraz daha büyük
    fontWeight: '800',
    color: '#FFD54F', // Pastel Amber rengi (Gözü yormayan tatlı sarı)
    opacity: 1,       
    // Glow Efekti (Daha yumuşak gölge)
    textShadowColor: 'rgba(255, 213, 79, 0.5)', 
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    transform: [{ scale: 1.15 }], // Vurguyu artırdık
  },
  // ARA MÜZİK: Pastel Teal (Su Yeşili)
  instrumentalIcon: {
    fontSize: 20,
    color: '#4DB6AC', // Pastel Teal
    fontWeight: 'bold',
    letterSpacing: 4, // Harf aralığı ile modern görünüm
    textTransform: 'uppercase',
  },
  instrumentalText: {
    fontSize: 20,
    color: '#80CBC4', // Daha soluk teal
    opacity: 0.3,
    fontWeight: 'bold',
  }
});