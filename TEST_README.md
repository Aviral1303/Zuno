# Whisper Model Interactive Tester

This script allows you to test the Whisper speech-to-text model interactively by recording audio and getting transcriptions.

## Features

- 🎤 **Record audio** from your microphone
- 📝 **Real-time transcription** using Whisper
- 📁 **Test with audio files** 
- ⏱️ **Custom recording duration**
- 🖥️ **Interactive menu** for easy testing

## Setup

1. Install dependencies (including PyAudio for microphone recording):
```bash
pip install -r requirements.txt
```

2. **For macOS users** - Install PortAudio first:
```bash
brew install portaudio
```

3. **For Ubuntu/Debian users**:
```bash
sudo apt-get install portaudio19-dev
```

4. **For Windows users** - PyAudio should install directly

## Usage

Run the interactive tester:
```bash
python test_whisper.py
```

### Interactive Menu Options:

1. **Record and transcribe (5 seconds)** - Quick test
2. **Record and transcribe (custom duration)** - Set your own duration
3. **Test with audio file** - Use existing audio files
4. **Exit** - Quit the program

### Example Session:

```
🎤 Whisper Model Interactive Tester
========================================
🔄 Loading Whisper model...
✅ Model loaded successfully on cpu

🎯 Interactive Whisper Testing Mode
==================================================

Options:
1. Record and transcribe (5 seconds)
2. Record and transcribe (custom duration)
3. Test with audio file
4. Exit

Enter your choice (1-4): 1

🎤 Recording for 5 seconds... Speak now!
✅ Recording complete!
🔄 Transcribing...

📝 Transcription: Hello, this is a test of the Whisper model.
```

## Troubleshooting

### PyAudio Installation Issues:
- **macOS**: `brew install portaudio && pip install pyaudio`
- **Ubuntu**: `sudo apt-get install portaudio19-dev && pip install pyaudio`
- **Windows**: `pip install pyaudio`

### If PyAudio fails to install:
- You can still test with audio files (option 3)
- The script will show a warning but continue working

### Audio Quality Tips:
- Speak clearly and at normal volume
- Reduce background noise
- Use a good microphone if available
- 5-10 second recordings work best for testing

## File Support

The script supports common audio formats:
- WAV, MP3, M4A, FLAC
- Any format supported by librosa
- Automatically resamples to 16kHz for optimal Whisper performance
