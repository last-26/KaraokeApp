import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { Asset, useAssets } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';

import { useKaraoke } from './src/hooks/useKaraoke';
import { parseSRT, LyricLine } from './src/utils/srtParser';
import { LyricsDisplay } from './src/components/LyricsDisplay';
import { AudioMixer } from './src/components/AudioMixer';

export default function App() {
  const [assets] = useAssets([require('./assets/lyrics.srt'), require('./assets/song.mp3')]);
  
  const {
    startSession,
    stopSession,
    handleMixComplete,
    handleMixError,
    isRecording,
    isPlaying,
    positionMillis,
    processing,
    mixedFileUri,
    voiceFileUri,
    error,
    songBase64,
    voiceBase64,
    requestPermission,
    metering // Audio level
  } = useKaraoke();

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoaded, setLyricsLoaded] = useState(false);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);

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
      
      // Fetch content as text
      const response = await fetch(uri);
      const content = await response.text();
      
      const parsed = parseSRT(content);
      setLyrics(parsed);
      setLyricsLoaded(true);
    } catch (e: any) {
      console.log('Error loading lyrics:', e);
      Alert.alert('Warning', 'Could not load lyrics. check console.');
    }
  };

  const handlePlayPreview = async () => {
    if (!mixedFileUri) return;
    try {
      if (previewSound) {
        await previewSound.unloadAsync();
      }
      // Play mixed file from document directory
      const { sound } = await Audio.Sound.createAsync({ uri: mixedFileUri });
      setPreviewSound(sound);
      await sound.playAsync();
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

  const handleShareVoice = async () => {
    if (!voiceFileUri) return;
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(voiceFileUri);
  };

  // Simple Volume Meter Visualization
  const renderMeter = () => {
    // metering is usually -160 (silent) to 0 (loud)
    // Normalize to 0-100 range approximately
    const val = Math.max(0, (metering + 80) * 2); 
    const widthVal = Math.min(100, val);
    
    return (
      <View style={styles.meterContainer}>
        <View style={[styles.meterBar, { width: `${widthVal}%` }]} />
        <Text style={styles.meterText}>🎤</Text>
      </View>
    );
  };

  if (!assets) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E91E63" />
        <Text>Loading Assets...</Text>
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
            <Text style={styles.subStatus}>This happens on-device, please wait.</Text>
          </View>
        ) : isRecording ? (
          <View style={{ flex: 1 }}>
            <View style={styles.lyricsContainer}>
               <LyricsDisplay lyrics={lyrics} currentTime={positionMillis} />
            </View>
            
            <View style={styles.recordingControls}>
              {renderMeter()}
              <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopSession}>
                <Text style={styles.buttonText}>Stop Recording</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : mixedFileUri ? (
          <View style={styles.center}>
            <Text style={styles.successText}>Karaoke Mix Ready!</Text>
            
            <View style={styles.resultContainer}>
              <TouchableOpacity style={[styles.button, styles.playButton]} onPress={handlePlayPreview}>
                <Text style={styles.buttonText}>▶ Play Mix</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={handleShare}>
                <Text style={styles.buttonText}>💾 Save / Share</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={() => {
                if (previewSound) previewSound.unloadAsync();
                setPreviewSound(null);
                startSession(); 
              }}
            >
              <Text style={styles.buttonText}>Start New Recording</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.instruction}>
              Ready to sing? Put on your headphones!
            </Text>
            <TouchableOpacity style={[styles.button, styles.startButton]} onPress={startSession}>
              <Text style={styles.buttonText}>Start Karaoke</Text>
            </TouchableOpacity>
            {!lyricsLoaded && <Text style={styles.warning}>Lyrics not loaded</Text>}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 30,
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
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
  },
  recordingControls: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  meterContainer: {
    width: 200,
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  meterBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  meterText: {
    position: 'absolute',
    right: -25,
    fontSize: 16,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    marginVertical: 8,
    minWidth: 220,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  startButton: {
    backgroundColor: '#E91E63',
  },
  stopButton: {
    backgroundColor: '#D32F2F',
  },
  playButton: {
    backgroundColor: '#4CAF50',
  },
  actionButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineText: {
    color: '#E91E63',
  },
  statusText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subStatus: {
    marginTop: 5,
    color: '#666',
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 30,
  },
  instruction: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  warning: {
    color: 'orange',
    marginTop: 10,
  },
  resultContainer: {
    width: '100%',
    alignItems: 'center',
  }
});
