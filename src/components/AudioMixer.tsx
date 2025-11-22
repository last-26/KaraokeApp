import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  songBase64: string | null;
  voiceBase64: string | null;
  onMixComplete: (mixedBase64: string) => void;
  onError: (error: string) => void;
}

export const AudioMixer: React.FC<Props> = ({ songBase64, voiceBase64, onMixComplete, onError }) => {
  const webviewRef = useRef<WebView>(null);

  useEffect(() => {
    if (songBase64 && voiceBase64) {
      // Small delay to ensure WebView is ready
      setTimeout(() => {
        const script = `mixAudio("${songBase64}", "${voiceBase64}");`;
        webviewRef.current?.injectJavaScript(script);
      }, 1000);
    }
  }, [songBase64, voiceBase64]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body>
        <script>
          function base64ToArrayBuffer(base64) {
            var binary_string = window.atob(base64);
            var len = binary_string.length;
            var bytes = new Uint8Array(len);
            for (var i = 0; i < len; i++) {
              bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes.buffer;
          }

          function audioBufferToWav(buffer, opt) {
            opt = opt || {};
            var numChannels = buffer.numberOfChannels;
            var sampleRate = buffer.sampleRate;
            var format = opt.float32 ? 3 : 1;
            var bitDepth = format === 3 ? 32 : 16;
            var result;
            if (numChannels === 2) {
              result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
            } else {
              result = buffer.getChannelData(0);
            }
            return encodeWAV(result, numChannels, sampleRate, format, bitDepth);
          }

          function interleave(inputL, inputR) {
            var length = inputL.length + inputR.length;
            var result = new Float32Array(length);
            var index = 0;
            var inputIndex = 0;
            while (index < length) {
              result[index++] = inputL[inputIndex];
              result[index++] = inputR[inputIndex];
              inputIndex++;
            }
            return result;
          }

          function encodeWAV(samples, numChannels, sampleRate, format, bitDepth) {
            var bytesPerSample = bitDepth / 8;
            var blockAlign = numChannels * bytesPerSample;
            var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
            var view = new DataView(buffer);
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + samples.length * bytesPerSample, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, format, true);
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * blockAlign, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bitDepth, true);
            writeString(view, 36, 'data');
            view.setUint32(40, samples.length * bytesPerSample, true);
            if (format === 1) {
               floatTo16BitPCM(view, 44, samples);
            } else {
               floatTo32BitFloat(view, 44, samples);
            }
            var binary = '';
            var bytes = new Uint8Array(buffer);
            var len = bytes.byteLength;
            // Chunked base64 conversion to prevent stack overflow
            for (var i = 0; i < len; i+=32768) {
               binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 32768, len)));
            }
            return window.btoa(binary);
          }

          function floatTo16BitPCM(output, offset, input) {
            for (var i = 0; i < input.length; i++, offset += 2) {
              var s = Math.max(-1, Math.min(1, input[i]));
              output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
          }
          function floatTo32BitFloat(output, offset, input) {
             for (var i = 0; i < input.length; i++, offset += 4) {
               output.setFloat32(offset, input[i], true);
             }
          }

          function writeString(view, offset, string) {
            for (var i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          }

          window.mixAudio = async function(songB64, voiceB64) {
            try {
              // Notify started
              // window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'Mixing started...' }));

              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              
              const songBuffer = base64ToArrayBuffer(songB64);
              const songAudioBuffer = await audioCtx.decodeAudioData(songBuffer);
              
              const voiceBuffer = base64ToArrayBuffer(voiceB64);
              const voiceAudioBuffer = await audioCtx.decodeAudioData(voiceBuffer);
              
              const length = Math.max(songAudioBuffer.length, voiceAudioBuffer.length);
              const channels = 2; 
              
              const outputBuffer = audioCtx.createBuffer(channels, length, songAudioBuffer.sampleRate);
              
              const songVol = 0.7;
              const voiceVol = 1.5;

              for (let i = 0; i < channels; i++) {
                const outputData = outputBuffer.getChannelData(i);
                const songData = songAudioBuffer.getChannelData(i < songAudioBuffer.numberOfChannels ? i : 0);
                const voiceData = voiceAudioBuffer.getChannelData(i < voiceAudioBuffer.numberOfChannels ? i : 0);
                
                for (let j = 0; j < length; j++) {
                  const s = (j < songData.length) ? songData[j] * songVol : 0;
                  const v = (j < voiceData.length) ? voiceData[j] * voiceVol : 0;
                  outputData[j] = s + v;
                }
              }
              
              const wavB64 = audioBufferToWav(outputBuffer);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', data: wavB64 }));
              
            } catch (e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
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
