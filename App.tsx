import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { Asset, useAssets } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';

import { useKaraoke } from './src/hooks/useKaraoke';
import { parseSRT, LyricLine } from './src/utils/srtParser';
import { LyricsDisplay } from './src/components/LyricsDisplay';
import { AudioMixer } from './src/components/AudioMixer';

// Modern Segmentli Ses Göstergesi Bileşeni
const VolumeVisualizer = ({ metering }: { metering: number }) => {
  // Metering genelde -160 (sessiz) ile 0 (maks) arasındadır.
  // Bunu 0-100 arasına normalize ediyoruz.
  // -60db altını sessiz kabul edip filtreliyoruz.
  const normalizedLevel = Math.min(100, Math.max(0, (metering + 60) * (100 / 60)));
  
  // 10 adet segment oluşturuyoruz
  const segments = Array.from({ length: 15 });

  return (
    <View style={styles.vizContainer}>
      {segments.map((_, index) => {
        // Her segmentin temsil ettiği eşik değeri
        const threshold = (index + 1) * (100 / segments.length);
        const isActive = normalizedLevel >= threshold;
        
        // Renk skalası (Yeşil -> Sarı -> Kırmızı)
        let backgroundColor = '#e0e0e0'; // Pasif renk
        if (isActive) {
          if (index < 8) backgroundColor = '#4CAF50'; // Yeşil
          else if (index < 12) backgroundColor = '#FFC107'; // Sarı
          else backgroundColor = '#F44336'; // Kırmızı
        }

        return (
          <View 
            key={index} 
            style={[
              styles.vizSegment, 
              { 
                backgroundColor,
                height: isActive ? 20 + (index * 2) : 10, // Aktifse biraz büyüsün
                opacity: isActive ? 1 : 0.3 
              }
            ]} 
          />
        );
      })}
    </View>
  );
};

export default function App() {
  const [assets] = useAssets([require('./assets/lyrics.srt'), require('./assets/song.mp3')]);
  
  const {
    startSession,
    stopSession,
    handleMixComplete,
    handleMixError,
    isRecording,
    processing,
    mixedFileUri,
    voiceFileUri,
    error,
    songBase64,
    voiceBase64,
    requestPermission,
    metering,
    positionMillis
  } = useKaraoke();

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoaded, setLyricsLoaded] = useState(false);
  
  // Preview Player State
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  useEffect(() => {
    if (assets) {
      loadLyrics(assets[0]);
    }
    requestPermission();
  }, [assets]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const loadLyrics = async (lyricAsset: Asset) => {
    try {
      if (!lyricAsset.localUri) {
        await lyricAsset.downloadAsync();
      }
      
      const uri = lyricAsset.localUri || lyricAsset.uri;
      const response = await fetch(uri);
      const content = await response.text();
      
      const parsed = parseSRT(content);
      setLyrics(parsed);
      setLyricsLoaded(true);
    } catch (e: any) {
      console.log('Error loading lyrics:', e);
      Alert.alert('Warning', 'Could not load lyrics.');
    }
  };

  // Play/Pause Toggle Mantığı
  const togglePreview = async () => {
    if (!mixedFileUri) return;

    try {
      // Eğer ses zaten yüklü ise
      if (previewSound) {
        const status = await previewSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await previewSound.pauseAsync();
            setIsPreviewPlaying(false);
          } else {
            // Eğer şarkı bitmişse başa sar
            if (status.positionMillis >= (status.durationMillis || 0)) {
              await previewSound.replayAsync();
            } else {
              await previewSound.playAsync();
            }
            setIsPreviewPlaying(true);
          }
          return;
        }
      }

      // Ses yüklü değilse yeni oluştur
      const { sound } = await Audio.Sound.createAsync(
        { uri: mixedFileUri },
        { shouldPlay: true }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setIsPreviewPlaying(false);
            sound.setPositionAsync(0); // Başa sar
          } else {
            setIsPreviewPlaying(status.isPlaying);
          }
        }
      });

      setPreviewSound(sound);
      setIsPreviewPlaying(true);

    } catch (e) {
      Alert.alert('Error', 'Failed to play preview');
    }
  };

  const handleShare = async () => {
    if (!mixedFileUri) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Error', 'Sharing is not available on this platform');
      return;
    }
    await Sharing.shareAsync(mixedFileUri);
  };

  // Yeni kayıt başlatırken eski player'ı temizle
  const handleNewRecording = async () => {
    if (previewSound) {
      await previewSound.unloadAsync();
      setPreviewSound(null);
      setIsPreviewPlaying(false);
    }
    startSession();
  };

  if (!assets) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E91E63" />
        <Text style={{marginTop: 10}}>Loading Assets...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Karaoke App</Text>
      </View>

      <AudioMixer 
        songBase64={songBase64} 
        voiceBase64={voiceBase64} 
        onMixComplete={handleMixComplete}
        onError={handleMixError}
      />

      <View style={styles.content}>
        {processing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#E91E63" />
            <Text style={styles.statusText}>Mixing Audio...</Text>
            <Text style={styles.subStatus}>High quality mix in progress...</Text>
          </View>
        ) : isRecording ? (
          <View style={{ flex: 1 }}>
            <View style={styles.lyricsContainer}>
               <LyricsDisplay lyrics={lyrics} currentTime={positionMillis} />
            </View>
            
            <View style={styles.recordingControls}>
              <Text style={styles.recordingLabel}>RECORDING</Text>
              
              {/* Yeni Dinamik Visualizer */}
              <VolumeVisualizer metering={metering} />

              <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopSession}>
                <View style={styles.stopIcon} />
                <Text style={styles.buttonText}>Stop Recording</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : mixedFileUri ? (
          <View style={styles.center}>
            <Text style={styles.successTitle}>🎉 Mix Ready!</Text>
            <Text style={styles.successSub}>Your performance has been processed.</Text>
            
            <View style={styles.resultCard}>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.actionBtn, isPreviewPlaying ? styles.playingBtn : styles.playBtn]} 
                  onPress={togglePreview}
                >
                  <Text style={styles.actionBtnText}>
                    {isPreviewPlaying ? "⏸ Stop" : "▶ Play Mix"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare}>
                  <Text style={styles.actionBtnText}>📤 Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={handleNewRecording}
            >
              <Text style={styles.secondaryButtonText}>🎙 Start New Recording</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}>
            <View style={styles.heroIcon}>
              <Text style={{fontSize: 60}}>🎧</Text>
            </View>
            <Text style={styles.instructionTitle}>Ready to Sing?</Text>
            <Text style={styles.instruction}>
              Please use headphones for the best quality and synchronization.
            </Text>
            <TouchableOpacity style={[styles.button, styles.startButton]} onPress={startSession}>
              <Text style={styles.buttonText}>Start Karaoke</Text>
            </TouchableOpacity>
            {!lyricsLoaded && <Text style={styles.warning}>Lyrics loading...</Text>}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 30,
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  lyricsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  recordingControls: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#222', // Koyu tema kayıt alanı
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  recordingLabel: {
    color: '#ff4444',
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 15,
    fontSize: 12,
  },
  
  // Visualizer Styles
  vizContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 50,
    gap: 4,
    marginBottom: 30,
  },
  vizSegment: {
    width: 8,
    borderRadius: 4,
  },

  button: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  startButton: {
    backgroundColor: '#E91E63',
    width: '100%',
  },
  stopButton: {
    backgroundColor: '#fff', // Stop butonu beyaz olsun
    width: '100%',
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#D32F2F',
    borderRadius: 2,
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Stop butonu içindeki yazı rengi için override
  stopButtonText: {
    color: '#D32F2F', 
  },
  
  // Result Screen Styles
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  successSub: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    backgroundColor: '#4CAF50',
  },
  playingBtn: {
    backgroundColor: '#FF9800',
  },
  shareBtn: {
    backgroundColor: '#2196F3',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  secondaryButton: {
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#666', // Artık görünür renk
    fontSize: 16,
    fontWeight: '600',
  },

  // Status Styles
  statusText: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subStatus: {
    marginTop: 8,
    color: '#888',
  },
  
  // Hero / Start Styles
  heroIcon: {
    width: 120,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  instructionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  warning: {
    color: '#FF9800',
    marginTop: 15,
    fontWeight: '500',
  },
});