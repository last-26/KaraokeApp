import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutChangeEvent, Animated } from 'react-native';
import { LyricLine } from '../utils/srtParser';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

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
      🎵 Enstrümantal Ara 🎵
    </Animated.Text>
  );
};

export const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  
  const itemsLayout = useRef<{ [key: string]: { y: number; height: number } }>({});

  const activeIndex = lyrics.findIndex(
    l => currentTime >= l.startTime && currentTime <= l.endTime
  );

  useEffect(() => {
    if (activeIndex !== -1 && scrollViewRef.current && containerHeight > 0) {
      const activeId = lyrics[activeIndex].id;
      const currentItem = itemsLayout.current[activeId];
      
      if (currentItem) {
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
    marginBottom: 20,
    width: '100%',
  },
  text: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.6)', 
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // GÜNCELLENDİ: Altın Sarısı (Gold) Rengi Geri Geldi
  activeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFD700', // <-- Gold
    textShadowColor: 'rgba(255, 215, 0, 0.6)', // Hafif altın parlaması
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    transform: [{ scale: 1.1 }], 
  },
  instrumentalIcon: {
    fontSize: 18,
    color: '#FFCCBC', 
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  instrumentalText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 'bold',
  }
});