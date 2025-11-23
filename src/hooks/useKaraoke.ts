import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

/**
 * State interface for the Karaoke session.
 */
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

/**
 * Custom hook to manage the Karaoke session logic.
 * Handles audio recording, playback, synchronization, and mixing preparation.
 * 
 * @returns Karaoke state and control functions
 */
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

  // References (Critical for automatic stopping and cleanup)
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [permissionResponse, requestPermission] = Audio.usePermissions();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
    };
  }, []);

  /**
   * Updates state based on playback status.
   * Automatically stops the session when the song finishes.
   */
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setState(prev => ({
        ...prev,
        positionMillis: status.positionMillis,
        durationMillis: status.durationMillis || prev.durationMillis,
        isPlaying: status.isPlaying,
      }));

      // Stop recording when the song finishes
      if (status.didJustFinish) {
        stopSession();
      }
    }
  };

  /**
   * Updates state based on recording status (e.g., metering levels).
   */
  const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
    if (status.isRecording) {
      setState(prev => ({
        ...prev,
        metering: status.metering || -160,
      }));
    }
  };

  /**
   * Starts the karaoke session:
   * 1. Resets state
   * 2. Checks permissions
   * 3. Configures audio mode
   * 4. Prepares recording and sound
   * 5. Starts both simultaneously
   */
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
        shouldDuckAndroid: true,
      });

      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          // @ts-ignore: audioSource is not in the type definition but required for AEC
          audioSource: 7, // VOICE_COMMUNICATION (AEC)
        },
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          audioQuality: Audio.IOSAudioQuality.HIGH,
        }
      };

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(recordingOptions);
      newRecording.setOnRecordingStatusUpdate(onRecordingStatusUpdate);

      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../../assets/song.mp3'),
        { shouldPlay: false }
      );
      newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

      // Set music volume to 50% to reduce echo pickup
      await newSound.setVolumeAsync(0.5);

      // Assign to refs
      recordingRef.current = newRecording;
      soundRef.current = newSound;

      await newRecording.startAsync();
      await newSound.playAsync();

      setState(prev => ({ ...prev, isRecording: true, isPlaying: true }));

    } catch (err: any) {
      console.error('Failed to start session', err);
      setState(prev => ({ ...prev, error: err.message }));
    }
  };

  /**
   * Stops the current session, unloads audio resources, and prepares for mixing.
   */
  const stopSession = async () => {
    // Check refs
    if (!soundRef.current && !recordingRef.current) return;

    try {
      setState(prev => ({ ...prev, isPlaying: false, isRecording: false, processing: true, metering: -160 }));

      let voiceUri = '';
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        voiceUri = recordingRef.current.getURI() || '';
        recordingRef.current = null; // Clear ref
      }

      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null; // Clear ref
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

  /**
   * Resets the karaoke state and unloads any active audio.
   * Useful for restarting the session completely.
   */
  const reset = async () => {
    try {
      // Stop and unload if anything is playing
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      // Reset state to initial values
      setState({
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
    } catch (error) {
      console.error("Reset error:", error);
    }
  };

  /**
   * Prepares audio files for mixing by converting them to Base64.
   * 
   * @param voiceUri URI of the recorded voice file
   */
  const prepareForMixing = async (voiceUri: string) => {
    try {
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

  /**
   * Helper to convert a Blob to a Base64 string.
   */
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

  /**
   * Callback for when the mixing process is complete.
   * Saves the mixed file to the document directory.
   */
  const handleMixComplete = async (mixedBase64: string) => {
    try {
      console.log("Mix completed, saving file...");
      const outputUri = FileSystem.documentDirectory + 'karaoke_mix.wav';

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

  /**
   * Callback for mixing errors.
   */
  const handleMixError = (msg: string) => {
    console.error("Mixer error from WebView:", msg);
    setState(prev => ({ ...prev, error: 'Mixer error: ' + msg, processing: false }));
  };

  return {
    ...state,
    startSession,
    stopSession,
    reset,
    handleMixComplete,
    handleMixError,
    requestPermission
  };
};