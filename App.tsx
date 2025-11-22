import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Platform, Animated, Easing } from 'react-native';
import { Asset, useAssets } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const { StorageAccessFramework } = FileSystem;

import { useKaraoke } from './src/hooks/useKaraoke';
import { parseSRT, LyricLine } from './src/utils/srtParser';
import { LyricsDisplay } from './src/components/LyricsDisplay';
import { AudioMixer } from './src/components/AudioMixer';

// ... (VolumeVisualizer bileşeni AYNI KALSIN) ...
const VolumeVisualizer = ({ metering }: { metering: number }) => {
  const normalizedLevel = Math.min(100, Math.max(0, (metering + 60) * (100 / 60)));
  const segments = Array.from({ length: 15 });

  return (
    <View style={styles.vizContainer}>
      {segments.map((_, index) => {
        const threshold = (index + 1) * (100 / segments.length);
        const isActive = normalizedLevel >= threshold;
        let backgroundColor = '#e0e0e0';
        if (isActive) {
          if (index < 8) backgroundColor = '#4CAF50';
          else if (index < 12) backgroundColor = '#FFC107';
          else backgroundColor = '#F44336';
        }
        return (
          <View 
            key={index} 
            style={[
              styles.vizSegment, 
              { 
                backgroundColor,
                height: isActive ? 20 + (index * 2) : 10,
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
    reset, // <-- Hook'tan reset'i çektik
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
  
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Animasyon Değerleri
  const pulseAnim = useRef(new Animated.Value(1)).current; // Kayıt butonu için
  
  // Sonuç ekranı giriş animasyonları
  const resultFadeAnim = useRef(new Animated.Value(0)).current; 
  const resultSlideAnim = useRef(new Animated.Value(50)).current; // Aşağıdan (50px) başlar

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

  // Mix Ready olduğunda Animasyonu Tetikle
  useEffect(() => {
    if (mixedFileUri) {
      Animated.parallel([
        Animated.timing(resultFadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
        Animated.timing(resultSlideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
      ]).start();
    } else {
      // Reset durumunda değerleri sıfırla
      resultFadeAnim.setValue(0);
      resultSlideAnim.setValue(50);
    }
  }, [mixedFileUri]);

  // Kayıt butonu animasyonu (Aynı kaldı)
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const loadLyrics = async (lyricAsset: Asset) => {
    try {
      if (!lyricAsset.localUri) await lyricAsset.downloadAsync();
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

  const togglePreview = async () => {
    if (!mixedFileUri) return;
    try {
      if (previewSound) {
        const status = await previewSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await previewSound.pauseAsync();
            setIsPreviewPlaying(false);
          } else {
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
      const { sound } = await Audio.Sound.createAsync({ uri: mixedFileUri }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setIsPreviewPlaying(false);
            sound.setPositionAsync(0);
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
      Alert.alert('Error', 'Sharing is not available');
      return;
    }
    await Sharing.shareAsync(mixedFileUri);
  };

  const handleDownload = async () => {
    if (!mixedFileUri) return;
    try {
      if (Platform.OS === 'android') {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const directoryUri = permissions.directoryUri;
          const fileContent = await FileSystem.readAsStringAsync(mixedFileUri, { encoding: FileSystem.EncodingType.Base64 });
          const newFileUri = await StorageAccessFramework.createFileAsync(directoryUri, 'karaoke_mix.wav', 'audio/wav');
          await FileSystem.writeAsStringAsync(newFileUri, fileContent, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert('Success', 'File saved to your device!');
        }
      } else {
        await Sharing.shareAsync(mixedFileUri);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Download failed: ' + e.message);
    }
  };

  // GÜNCELLENDİ: Artık reset çağırıyor
  const handleGoHome = async () => {
    if (previewSound) {
      await previewSound.unloadAsync();
      setPreviewSound(null);
      setIsPreviewPlaying(false);
    }
    reset(); // useKaraoke içindeki reset fonksiyonu
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
    <LinearGradient
      colors={['#4c669f', '#3b5998', '#192f6a']} 
      style={styles.container}
    >
      <SafeAreaView style={{flex: 1}}>
        <View style={styles.header}>
          <Text style={styles.title}>Karaoke Star 🎤</Text>
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
              <ActivityIndicator size="large" color="#fff" />
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
                
                <VolumeVisualizer metering={metering} />

                <TouchableOpacity onPress={stopSession}>
                  <Animated.View style={[
                    styles.button, 
                    styles.stopButton,
                    { transform: [{ scale: pulseAnim }] } 
                  ]}>
                    <View style={styles.stopIcon} />
                    <Text style={[styles.buttonText, styles.stopButtonText]}>STOP</Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </View>
          ) : mixedFileUri ? (
            // *** GÜNCELLENEN MIX READY EKRANI ***
            <View style={styles.center}>
              <Animated.View style={{ 
                opacity: resultFadeAnim, 
                transform: [{ translateY: resultSlideAnim }],
                alignItems: 'center',
                width: '100%'
              }}>
                
                {/* Başarı İkonu / Emojisi */}
                <Text style={{ fontSize: 60, marginBottom: 10 }}>🌟</Text>
                
                <Text style={[styles.successTitle, {color: 'white'}]}>Mix Ready!</Text>
                <Text style={[styles.successSub, {color: '#ddd'}]}>Great performance! What's next?</Text>
                
                <View style={styles.resultCard}>
                  <View style={styles.row}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, isPreviewPlaying ? styles.playingBtn : styles.playBtn]} 
                      onPress={togglePreview}
                    >
                      <Text style={styles.actionBtnText}>
                        {isPreviewPlaying ? "⏸ Stop Preview" : "▶ Play Preview"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.row, { marginTop: 15 }]}>
                    <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare}>
                      <Text style={styles.actionBtnText}>📤 Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.downloadBtn]} onPress={handleDownload}>
                      <Text style={styles.actionBtnText}>⬇️ Download</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Ana Sayfaya Dön Butonu */}
                <TouchableOpacity 
                  style={styles.homeButton} 
                  onPress={handleGoHome}
                >
                  <Text style={styles.homeButtonText}>🏠 Return to Home</Text>
                </TouchableOpacity>

              </Animated.View>
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.heroIcon}>
                <Text style={{fontSize: 60}}>🎧</Text>
              </View>
              <Text style={[styles.instructionTitle, {color: 'white'}]}>Ready to Sing?</Text>
              <Text style={[styles.instruction, {color: '#ddd'}]}>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 30,
  },
  header: {
    padding: 15,
    backgroundColor: 'transparent',
    alignItems: 'center',
    borderBottomWidth: 0,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
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
    backgroundColor: 'transparent',
  },
  recordingControls: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    backgroundColor: '#fff',
    width: 200,
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
  stopButtonText: {
    color: '#D32F2F', 
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  successSub: {
    fontSize: 16,
    marginBottom: 30,
    fontWeight: '500',
  },
  resultCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)', // Hafif transparan beyaz
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    marginBottom: 25,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  downloadBtn: {
    backgroundColor: '#607D8B',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  homeButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subStatus: {
    marginTop: 8,
    color: '#ddd',
  },
  heroIcon: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  instructionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 16,
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