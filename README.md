# Karaoke App 🎤

A cross-platform React Native Karaoke application built with Expo. This app provides a complete karaoke experience with audio playback, synchronized lyrics, voice recording, and on-device audio mixing.

## 🚀 Features

* **Audio Playback:** Plays the backing track.
* **Synchronized Lyrics:** Displays lyrics timed perfectly with the music using SRT files.
* **Voice Recording:** Records the user's singing session.
* **Audio Mixing:** Merges the music and voice recording into a single file using the Web Audio API (no external heavy binaries like FFmpeg required).
* **Share & Save:** Allows users to share or save their mixed performance.

## 🛠 Prerequisites

Before you begin, ensure you have the following installed:
* **Node.js** (LTS version recommended)
* **Expo Go App** installed on your iOS or Android device.

## Cc Installation & Setup

1.  **Install Dependencies**
    Open your terminal in the project directory and run:
    ```bash
    npm install
    ```

2.  **⚠️ Important: Add Your Assets**
    This app requires a music file and a lyrics file to function. You must add your own files to the `assets/` folder:
    
    * **Music:** Place your MP3 file in the `assets` folder and rename it to `song.mp3`.
    * **Lyrics:** Place your SRT file in the `assets` folder and rename it to `lyrics.srt`.

    > *Note: If these files are missing or named incorrectly, the app may not load the karaoke session correctly.*

## ▶️ Running the App

We recommend testing the application using **Expo Go** for the fastest development experience.

1.  **Start the Development Server:**
    ```bash
    npx expo start
    ```

    *If you encounter cache issues or weird errors, run the start command with the clear flag:*
    ```bash
    npx expo start --clear
    ```

2.  **Launch on Device:**
    * Scan the QR code displayed in the terminal using the **Expo Go** app on your Android or iOS device.
    * Ensure your phone and computer are on the same Wi-Fi network.

## ℹ️ Architecture Note

**Why Web Audio API?**
Instead of using heavy native libraries like FFmpeg which can cause build issues on various platforms, this project uses a lightweight **Web Audio API** approach via a hidden WebView. This ensures:
* Fast and reliable on-device audio processing.
* No complex native linking requirements.
* Compatibility across Android and iOS.

## 🐛 Troubleshooting

* **Lyrics not showing?**
    * Check that your `lyrics.srt` file is valid and properly formatted (standard SRT format).
    * Ensure the filename is exactly `lyrics.srt`.
* **Recording not starting?**
    * Make sure you have granted **Microphone Permissions** to the Expo Go app on your device settings.