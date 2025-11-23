import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Props for the AudioMixer component.
 */
interface Props {
  songBase64: string | null;
  voiceBase64: string | null;
  onMixComplete: (mixedBase64: string) => void;
  onError: (error: string) => void;
}

/**
 * A hidden component that uses a WebView to mix audio tracks using the Web Audio API.
 * This is necessary because React Native's native audio libraries often lack advanced mixing capabilities like offline rendering.
 * 
 * @param songBase64 Base64 string of the backing track
 * @param voiceBase64 Base64 string of the recorded voice
 * @param onMixComplete Callback function when mixing is finished
 * @param onError Callback function when an error occurs
 */
export const AudioMixer: React.FC<Props> = ({ songBase64, voiceBase64, onMixComplete, onError }) => {
  const webviewRef = useRef<WebView>(null);

  // Trigger mixing when both audio sources are available
  useEffect(() => {
    if (songBase64 && voiceBase64) {
      setTimeout(() => {
        const script = `mixAudio("${songBase64}", "${voiceBase64}");`;
        webviewRef.current?.injectJavaScript(script);
      }, 500);
    }
  }, [songBase64, voiceBase64]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body>
        <script>
          /**
           * Converts a Base64 string to an ArrayBuffer.
           */
          function base64ToArrayBuffer(base64) {
            var binary_string = window.atob(base64);
            var len = binary_string.length;
            var bytes = new Uint8Array(len);
            for (var i = 0; i < len; i++) {
              bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes.buffer;
          }

          /**
           * Encodes raw audio samples into a WAV file format (Mono).
           */
          function encodeWAVMono(samples, sampleRate) {
            var buffer = new ArrayBuffer(44 + samples.length * 2);
            var view = new DataView(buffer);

            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + samples.length * 2, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true); 
            view.setUint16(22, 1, true); 
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true); 
            view.setUint16(32, 2, true); 
            view.setUint16(34, 16, true); 
            writeString(view, 36, 'data');
            view.setUint32(40, samples.length * 2, true);

            floatTo16BitPCM(view, 44, samples);

            return buffer;
          }

          /**
           * Converts float samples to 16-bit PCM.
           */
          function floatTo16BitPCM(output, offset, input) {
            for (var i = 0; i < input.length; i++, offset += 2) {
              var s = Math.max(-1, Math.min(1, input[i]));
              output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
          }

          /**
           * Writes a string to a DataView at a specific offset.
           */
          function writeString(view, offset, string) {
            for (var i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          }

          /**
           * Converts a Blob object to a Base64 string.
           */
          function blobToBase64(blob) {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result;
                resolve(result.split(',')[1]); 
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          /**
           * Main mixing function exposed to React Native.
           * Decodes audio, mixes them with latency compensation, and renders to WAV.
           */
          window.mixAudio = async function(songB64, voiceB64) {
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              
              const songBuffer = await audioCtx.decodeAudioData(base64ToArrayBuffer(songB64));
              const voiceBuffer = await audioCtx.decodeAudioData(base64ToArrayBuffer(voiceB64));
              
              const TARGET_RATE = 22050;
              const TARGET_CHANNELS = 1;
              const LATENCY_COMPENSATION_SEC = 0.160; // Latency compensation for specific device

              const voiceOffset = (voiceBuffer.duration > LATENCY_COMPENSATION_SEC) ? LATENCY_COMPENSATION_SEC : 0;

              const resamplingRatio = TARGET_RATE / songBuffer.sampleRate;
              const maxOriginalLength = Math.max(songBuffer.length, voiceBuffer.length);
              const outputLength = Math.floor(maxOriginalLength * resamplingRatio);

              const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
                TARGET_CHANNELS, 
                outputLength,
                TARGET_RATE
              );

              // Setup Song Source
              const songSource = offlineCtx.createBufferSource();
              songSource.buffer = songBuffer;
              const songGain = offlineCtx.createGain();
              songGain.gain.value = 0.7; // Song Volume
              songSource.connect(songGain);
              songGain.connect(offlineCtx.destination);

              // Setup Voice Source
              const voiceSource = offlineCtx.createBufferSource();
              voiceSource.buffer = voiceBuffer;
              const voiceGain = offlineCtx.createGain();
              // !!! UPDATE: Increased volume to 3.0 (louder voice) !!!
              voiceGain.gain.value = 3.0; 
              
              voiceSource.connect(voiceGain);
              voiceGain.connect(offlineCtx.destination);

              // Schedule playback
              songSource.start(0);
              voiceSource.start(0, voiceOffset);

              // Render
              const renderedBuffer = await offlineCtx.startRendering();

              const monoData = renderedBuffer.getChannelData(0);
              const wavBuffer = encodeWAVMono(monoData, TARGET_RATE);
              const blob = new Blob([wavBuffer], { type: 'audio/wav' });
              
              if (window.gc) window.gc();

              const finalBase64 = await blobToBase64(blob);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', data: finalBase64 }));
              
            } catch (e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'error', 
                message: 'Mix error: ' + e.message 
              }));
            }
          };
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ height: 0, width: 0, position: 'absolute' }}>
      <WebView
        ref={webviewRef}
        source={{ html: htmlContent }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'success') {
              onMixComplete(data.data);
            } else if (data.type === 'error') {
              onError(data.message);
            } else if (data.type === 'log') {
              console.log('WebView Log:', data.message);
            }
          } catch (e) {
            onError('Failed to parse webview message');
          }
        }}
        javaScriptEnabled={true}
        originWhitelist={['*']}
      />
    </View>
  );
};