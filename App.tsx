import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Platform, Animated, Easing, ScrollView } from 'react-native';
import { Asset, useAssets } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; 

const { StorageAccessFramework } = FileSystem;

import { useKaraoke } from './src/hooks/useKaraoke';
import { parseSRT, LyricLine } from './src/utils/srtParser';
import { LyricsDisplay } from './src/components/LyricsDisplay';
import { AudioMixer } from './src/components/AudioMixer';
import { AudioPlayer } from './src/components/AudioPlayer';

const VolumeVisualizer = ({ metering }: { metering: number }) => {
  const normalizedLevel = Math.min(100, Math.max(0, (metering + 60) * (100 / 60)));
  const segments = Array.from({ length: 15 });

  return (
    <View style={styles.vizContainer}>
      {segments.map((_, index) => {
        const threshold = (index + 1) * (100 / segments.length);
        const isActive = normalizedLevel >= threshold;
        let backgroundColor = 'rgba(255,255,255,0.2)';
        if (isActive) {
          // Renk paleti: Mavi -> Amber -> Kırmızı (Cyan değil)
          if (index < 8) backgroundColor = '#4FC3F7'; 
          else if (index < 12) backgroundColor = '#FFD740'; 
          else backgroundColor = '#FF5252'; 
        }
        return (
          <View 
            key={index} 
            style={[
              styles.vizSegment, 
              { 
                backgroundColor,
                height: isActive ? 20 + (index * 2) : 8,
                opacity: isActive ? 1 : 0.5 
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
    reset,
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
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultFadeAnim = useRef(new Animated.Value(0)).current; 
  const resultSlideAnim = useRef(new Animated.Value(50)).current;

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
      resultFadeAnim.setValue(0);
      resultSlideAnim.setValue(50);
    }
  }, [mixedFileUri]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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

  const shareFile = async (uri: string | null) => {
    if (!uri) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Error', 'Sharing is not available');
      return;
    }
    await Sharing.shareAsync(uri);
  };

  const saveFile = async (uri: string | null, fileName: string) => {
    if (!uri) return;
    try {
      if (Platform.OS === 'android') {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const directoryUri = permissions.directoryUri;
          const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const newFileUri = await StorageAccessFramework.createFileAsync(directoryUri, fileName, 'audio/wav');
          await FileSystem.writeAsStringAsync(newFileUri, fileContent, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert('Success', `${fileName} saved to your device!`);
        }
      } else {
        await Sharing.shareAsync(uri);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Download failed: ' + e.message);
    }
  };

  const handleGoHome = async () => {
    reset();
  };

  if (!assets) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFD740" />
        <Text style={{marginTop: 10, color: 'white'}}>Loading Assets...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
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
              <ActivityIndicator size="large" color="#FFD740" />
              <Text style={styles.statusText}>Mixing Audio...</Text>
              <Text style={styles.subStatus}>High quality mix in progress...</Text>
            </View>
          ) : isRecording ? (
            <View style={{ flex: 1 }}>
              <View style={styles.lyricsContainer}>
                 <LyricsDisplay lyrics={lyrics} currentTime={positionMillis} />
              </View>
              
              <View style={styles.recordingControls}>
                <Text style={styles.recordingLabel}>• REC •</Text>
                
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
            <View style={styles.center}>
              <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingVertical: 20 }}>
                <Animated.View style={{ 
                  opacity: resultFadeAnim, 
                  transform: [{ translateY: resultSlideAnim }],
                  alignItems: 'center',
                  width: '100%'
                }}>
                  
                  <Text style={{ fontSize: 60, marginBottom: 10 }}>🌟</Text>
                  
                  <Text style={[styles.successTitle, {color: 'white'}]}>Performance Ready!</Text>
                  <Text style={[styles.successSub, {color: '#B0BEC5'}]}>Listen to your masterpiece:</Text>
                  
                  <View style={styles.resultCard}>
                    <AudioPlayer uri={mixedFileUri} title="Karaoke Mix (Final)" />
                    
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.shareBtn]} 
                        onPress={() => shareFile(mixedFileUri)}
                      >
                         <Ionicons name="share-outline" size={20} color="#fff" style={styles.btnIcon} />
                        <Text style={styles.actionBtnText}>Share Mix</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.downloadBtn]} 
                        onPress={() => saveFile(mixedFileUri, 'karaoke_mix.wav')}
                      >
                        <Ionicons name="download-outline" size={20} color="#fff" style={styles.btnIcon} />
                        <Text style={styles.actionBtnText}>Save Mix</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.resultCard}>
                    <AudioPlayer uri={voiceFileUri} title="Voice Recording (Raw)" />

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.purpleBtn]} 
                        onPress={() => shareFile(voiceFileUri)}
                      >
                        <Ionicons name="share-outline" size={20} color="#fff" style={styles.btnIcon} />
                        <Text style={styles.actionBtnText}>Share Voice</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.darkBtn]} 
                        onPress={() => saveFile(voiceFileUri, 'voice.wav')}
                      >
                         <Ionicons name="download-outline" size={20} color="#fff" style={styles.btnIcon} />
                        <Text style={styles.actionBtnText}>Save Voice</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.homeButton} 
                    onPress={handleGoHome}
                  >
                    <Ionicons name="refresh-outline" size={20} color="#fff" style={styles.btnIcon} />
                    <Text style={styles.homeButtonText}>New Session</Text>
                  </TouchableOpacity>

                </Animated.View>
              </ScrollView>
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.heroIcon}>
                <Text style={{fontSize: 60}}>🎧</Text>
              </View>
              <Text style={[styles.instructionTitle, {color: 'white'}]}>Ready to Sing?</Text>
              <Text style={[styles.instruction, {color: '#B0BEC5'}]}>
                Use headphones for the best experience.
              </Text>
              <TouchableOpacity style={[styles.button, styles.startButton]} onPress={startSession}>
                <Ionicons name="mic" size={24} color="#0f0c29" style={{marginRight: 10}} />
                <Text style={[styles.buttonText, { color: '#0f0c29' }]}>Start Karaoke</Text>
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
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lyricsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  recordingControls: {
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 60, // <-- STOP Butonu yukarı alındı
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', 
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  recordingLabel: {
    color: '#FF5252',
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 15,
    fontSize: 14,
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
    backgroundColor: '#FFD740', // <-- Pastel Amber (Cyan yerine)
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
  },
  successSub: {
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '500',
  },
  resultCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    backgroundColor: '#5C6BC0',
  },
  downloadBtn: {
    backgroundColor: '#78909C',
  },
  purpleBtn: {
    backgroundColor: '#AB47BC',
  },
  darkBtn: {
    backgroundColor: '#546E7A',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnIcon: {
    marginRight: 8,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 40,
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
    color: '#B0BEC5',
  },
  heroIcon: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    color: '#FFAB91',
    marginTop: 15,
    fontWeight: '500',
  },
});