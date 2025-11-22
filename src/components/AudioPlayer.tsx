import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

interface AudioPlayerProps {
  uri: string | null;
  title: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, title }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const isSeeking = useRef(false);

  useEffect(() => {
    loadSound();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [uri]);

  const loadSound = async () => {
    if (!uri) return;
    setIsLoaded(false);
    try {
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      
      if (status.isLoaded) {
        setSound(newSound);
        setDuration(status.durationMillis || 0);
        setIsLoaded(true);
        
        newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      }
    } catch (error) {
      console.error("Error loading sound", error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (!isSeeking.current) {
        setPosition(status.positionMillis);
      }
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        sound?.setPositionAsync(0);
        setIsPlaying(false);
      }
    }
  };

  const handlePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      if (position >= duration) {
        await sound.setPositionAsync(0);
      }
      await sound.playAsync();
    }
  };

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
    }
    setPosition(value);
    isSeeking.current = false;
  };

  const formatTime = (millis: number) => {
    if (!millis || millis < 0) return '0:00';
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!uri) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.iconContainer}>
            <Ionicons name="musical-note" size={20} color="#fff" />
        </View>
        {/* BAŞLIK RENGİ BEYAZ YAPILDI */}
        <Text style={styles.title}>{title}</Text>
      </View>

      {!isLoaded ? (
         <ActivityIndicator size="small" color="#FFD740" style={{ marginVertical: 20 }} />
      ) : (
        <>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color="#fff" 
                style={{ marginLeft: isPlaying ? 0 : 3 }} 
              />
            </TouchableOpacity>
            
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={duration}
                value={position}
                onSlidingStart={() => { isSeeking.current = true; }}
                onSlidingComplete={handleSeek}
                minimumTrackTintColor="#FFD740" // Pastel Amber (Uyumlu renk)
                maximumTrackTintColor="rgba(255,255,255,0.3)" // Silik beyaz
                thumbTintColor="#FFD740"
              />
               <View style={styles.timeRow}>
                  {/* SÜRE RENGİ AÇIK GRİ YAPILDI */}
                  <Text style={styles.timeText}>{formatTime(position)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
               </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.08)', // Çok hafif şeffaf beyaz zemin
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // <-- DÜZELTİLDİ: Beyaz renk
    flex: 1,
    letterSpacing: 0.5,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 215, 64, 0.2)', // Pastel Amber'ın şeffaf hali
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 64, 0.5)',
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 30,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -5,
  },
  timeText: {
    fontSize: 12,
    color: '#B0BEC5', // <-- DÜZELTİLDİ: Açık Gri (Okunabilir)
    fontWeight: '500',
  },
});