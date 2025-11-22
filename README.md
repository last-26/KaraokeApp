# Karaoke App

React Native Karaoke application using Expo.
Features audio playback, synchronized lyrics, voice recording, and on-device audio mixing.

## Architecture Change Note
Due to persistent availability issues with native FFmpeg libraries on Android repositories, this project uses a **Web Audio API** based approach for audio mixing. This ensures:
- No heavy native binary dependencies (FFmpeg).
- Reliable build process on all platforms.
- On-device processing using the system's web engine (WebView).

## Features
- Plays `assets/song.mp3`
- Displays synchronized lyrics from `assets/lyrics.srt`
- Records user voice
- Merges music and voice into `karaoke_mix.wav`
- Allows sharing/saving the result

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build and run on Android Emulator:
   ```bash
   npx expo run:android
   ```

## Assets
Place your files in `assets/`:
- `song.mp3`
- `lyrics.srt`

## Troubleshooting
- If you see "Lyrics not loaded", ensure `assets/lyrics.srt` is valid and the app has been rebuilt/reloaded.
- Microphone permissions are required for recording.
