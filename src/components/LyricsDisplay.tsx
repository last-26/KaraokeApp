import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LyricLine } from '../utils/srtParser';

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

export const LyricsDisplay: React.FC<Props> = ({ lyrics, currentTime }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  const activeIndex = lyrics.findIndex(
    l => currentTime >= l.startTime && currentTime <= l.endTime
  );

  // If no active line found but we are past the last line, index is -1.
  // If we haven't started, index is -1. 
  // We need to handle "upcoming" lines correctly.
  
  // Filter lyrics to only show active and future lines
  // We keep the active line (or the first upcoming line if between lines)
  
  // Let's find the first line that hasn't ended yet
  const firstVisibleIndex = lyrics.findIndex(l => l.endTime > currentTime);
  
  const visibleLyrics = firstVisibleIndex >= 0 ? lyrics.slice(firstVisibleIndex) : [];

  // Since we are removing items, scrolling is less needed, but we might want to keep the current line at the top.
  // Actually, if we just render the list, the "current" line will naturally be at the top (index 0 of visibleLyrics).
  
  // However, to prevent jumpiness, we might want to keep 1 previous line or just smooth the transition.
  // User asked to "remove" read parts.

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        ref={scrollViewRef} 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 50 }} /> 
        {visibleLyrics.map((line, index) => {
          // The first item in visibleLyrics is the "current" or "next" line.
          // Check if it is actively being sung (currentTime is within its range)
          const isActive = currentTime >= line.startTime && currentTime <= line.endTime;
          
          return (
            <View key={line.id} style={styles.line}>
              <Text style={[styles.text, isActive && styles.activeText]}>
                {line.text}
              </Text>
            </View>
          );
        })}
        <View style={{ height: 200 }} /> 
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fafafa',
  },
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    paddingHorizontal: 20,
  },
  line: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  text: {
    fontSize: 20,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E91E63',
    textShadowColor: 'rgba(233, 30, 99, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
