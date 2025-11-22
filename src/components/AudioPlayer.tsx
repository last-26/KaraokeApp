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
      // Şarkı sonundaysa başa sarıp oynat
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
        <Text style={styles.title}>{title}</Text>
      </View>

      {!isLoaded ? (
         <ActivityIndicator size="small" color="#E91E63" style={{ marginVertical: 20 }} />
      ) : (
        <>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={28} 
                color="#fff" 
                style={{ marginLeft: isPlaying ? 0 : 4 }} // Play ikonunu ortalamak için ufak kaydırma
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
                minimumTrackTintColor="#E91E63"
                maximumTrackTintColor="#ccc"
                thumbTintColor="#E91E63"
              />
               <View style={styles.timeRow}>
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
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: '#E91E63',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    backgroundColor: '#333',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
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
    marginTop: -8, // Slider'a yaklaştırmak için
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
});