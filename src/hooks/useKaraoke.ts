import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
// SDK 54 Uyarısı için düzeltme: 'legacy' import kullanıyoruz
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

export interface KaraokeState {
  isRecording: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  processing: boolean;
  mixedFileUri: string | null;
  voiceFileUri: string | null;
  error: string | null;
  songBase64: string | null;
  voiceBase64: string | null;
  metering: number;
}

export const useKaraoke = () => {
  const [state, setState] = useState<KaraokeState>({
    isRecording: false,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
    processing: false,
    mixedFileUri: null,
    voiceFileUri: null,
    error: null,
    songBase64: null,
    voiceBase64: null,
    metering: -160,
  });

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
      if (recording) recording.stopAndUnloadAsync();
    };
  }, [sound, recording]);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setState(prev => ({
        ...prev,
        positionMillis: status.positionMillis,
        durationMillis: status.durationMillis || prev.durationMillis,
        isPlaying: status.isPlaying,
      }));

      if (status.didJustFinish) {
        stopSession();
      }
    }
  };

  const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
    if (status.isRecording) {
      setState(prev => ({
        ...prev,
        metering: status.metering || -160,
      }));
    }
  };

  const startSession = async () => {
    try {
      setState(prev => ({ 
        ...prev, 
        error: null, 
        mixedFileUri: null, 
        voiceFileUri: null, 
        processing: false,
        metering: -160
      }));

      if (!permissionResponse || permissionResponse.status !== 'granted') {
        const perm = await requestPermission();
        if (perm.status !== 'granted') {
          setState(prev => ({ ...prev, error: 'Microphone permission denied' }));
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      // Prepare Recording with Metering Enabled
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      newRecording.setOnRecordingStatusUpdate(onRecordingStatusUpdate);

      // Prepare Sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../../assets/song.mp3'),
        { shouldPlay: false }
      );
      newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

      // Start
      setRecording(newRecording);
      setSound(newSound);
      
      await newRecording.startAsync();
      await newSound.playAsync();

      setState(prev => ({ ...prev, isRecording: true, isPlaying: true }));

    } catch (err: any) {
      console.error('Failed to start session', err);
      setState(prev => ({ ...prev, error: err.message }));
    }
  };

  const stopSession = async () => {
    if (!sound && !recording) return;

    try {
      setState(prev => ({ ...prev, isPlaying: false, isRecording: false, processing: true, metering: -160 }));

      let voiceUri = '';
      if (recording) {
        await recording.stopAndUnloadAsync();
        voiceUri = recording.getURI() || '';
        setRecording(null);
      }

      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      if (voiceUri) {
        setState(prev => ({ ...prev, voiceFileUri: voiceUri }));
        await prepareForMixing(voiceUri);
      } else {
        setState(prev => ({ ...prev, processing: false }));
      }

    } catch (error: any) {
      console.error(error);
      setState(prev => ({ ...prev, error: error.message, processing: false }));
    }
  };

  const prepareForMixing = async (voiceUri: string) => {
    try {
      // 1. Load Song Base64
      const songAsset = Asset.fromModule(require('../../assets/song.mp3'));
      await songAsset.downloadAsync();
      const songUri = songAsset.localUri || songAsset.uri;

      if (!songUri) throw new Error('Could not load song asset');
      
      const songResponse = await fetch(songUri);
      const songBlob = await songResponse.blob();
      const songB64 = await blobToBase64(songBlob);

      const voiceResponse = await fetch(voiceUri);
      const voiceBlob = await voiceResponse.blob();
      const voiceB64 = await blobToBase64(voiceBlob);

      setState(prev => ({ 
        ...prev, 
        songBase64: songB64, 
        voiceBase64: voiceB64,
        processing: true 
      }));

    } catch (err: any) {
      console.error('Preparation error', err);
      setState(prev => ({ ...prev, error: 'Prep error: ' + err.message, processing: false }));
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleMixComplete = async (mixedBase64: string) => {
    try {
      console.log("Mix completed, saving file...");
      const outputUri = FileSystem.documentDirectory + 'karaoke_mix.wav';
      
      // Legacy import kullandığımız için bu fonksiyon sorunsuz çalışmalı
      await FileSystem.writeAsStringAsync(outputUri, mixedBase64, { encoding: 'base64' });
      
      console.log("File saved to:", outputUri);

      setState(prev => ({ 
        ...prev, 
        mixedFileUri: outputUri, 
        processing: false,
        songBase64: null,
        voiceBase64: null
      }));
    } catch (e: any) {
      console.error("Save error:", e);
      setState(prev => ({ ...prev, error: 'Save error: ' + e.message, processing: false }));
    }
  };

  const handleMixError = (msg: string) => {
    console.error("Mixer error from WebView:", msg);
    setState(prev => ({ ...prev, error: 'Mixer error: ' + msg, processing: false }));
  };

  return {
    ...state,
    startSession,
    stopSession,
    handleMixComplete,
    handleMixError,
    requestPermission
  };
};