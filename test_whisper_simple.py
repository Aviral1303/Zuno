#!/usr/bin/env python3
"""
Whisper Model Tester (File-based)
Test the Whisper speech-to-text model with audio files
"""

import os
import sys
import time
import librosa
import numpy as np
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
import torch

class WhisperTester:
    def __init__(self):
        self.processor = None
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
    def load_model(self):
        """Load the Whisper model"""
        print("🔄 Loading Whisper model...")
        try:
            self.processor = AutoProcessor.from_pretrained("openai/whisper-small")
            self.model = AutoModelForSpeechSeq2Seq.from_pretrained("openai/whisper-small")
            self.model.to(self.device)
            print(f"✅ Model loaded successfully on {self.device}")
            return True
        except Exception as e:
            print(f"❌ Error loading model: {str(e)}")
            return False
    
    def transcribe_audio(self, audio_array, sample_rate):
        """Transcribe audio using Whisper"""
        if self.model is None or self.processor is None:
            print("❌ Model not loaded!")
            return None
            
        try:
            print("🔄 Transcribing...")
            
            # Process with Whisper
            inputs = self.processor(audio_array, sampling_rate=sample_rate, return_tensors="pt")
            
            # Move to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate transcription
            with torch.no_grad():
                predicted_ids = self.model.generate(inputs["input_features"])
            
            # Decode the transcription
            transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
            
            return transcription
            
        except Exception as e:
            print(f"❌ Error in transcription: {str(e)}")
            return None
    
    def test_with_file(self, file_path):
        """Test transcription with an audio file"""
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return
            
        try:
            print(f"🔄 Loading audio file: {file_path}")
            audio, sample_rate = librosa.load(file_path, sr=16000)
            
            print(f"📊 Audio info: {len(audio)/sample_rate:.2f} seconds, {sample_rate} Hz")
            
            transcription = self.transcribe_audio(audio, sample_rate)
            
            if transcription:
                print(f"\n📝 Transcription:")
                print(f"   {transcription}")
                print()
            else:
                print("❌ Transcription failed")
                
        except Exception as e:
            print(f"❌ Error processing file: {str(e)}")
    
    def create_sample_audio(self):
        """Create a sample audio file for testing"""
        print("🎵 Creating a sample audio file...")
        
        # Generate a simple tone
        sample_rate = 16000
        duration = 2  # seconds
        frequency = 440  # A4 note
        
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        audio = np.sin(frequency * 2 * np.pi * t) * 0.3
        
        # Save as WAV file
        sample_file = "sample_audio.wav"
        import soundfile as sf
        sf.write(sample_file, audio, sample_rate)
        
        print(f"✅ Created sample audio: {sample_file}")
        return sample_file
    
    def interactive_mode(self):
        """Interactive testing mode"""
        print("\n🎯 Whisper Model Testing Mode")
        print("=" * 50)
        
        while True:
            print("\nOptions:")
            print("1. Test with audio file")
            print("2. Create sample audio file")
            print("3. List audio files in current directory")
            print("4. Exit")
            
            choice = input("\nEnter your choice (1-4): ").strip()
            
            if choice == "1":
                file_path = input("Enter path to audio file: ").strip()
                if file_path:
                    self.test_with_file(file_path)
                else:
                    print("❌ Please enter a valid file path")
            elif choice == "2":
                sample_file = self.create_sample_audio()
                print(f"✅ Sample file created: {sample_file}")
            elif choice == "3":
                self.list_audio_files()
            elif choice == "4":
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice. Please enter 1-4.")
    
    def list_audio_files(self):
        """List audio files in current directory"""
        audio_extensions = ['.wav', '.mp3', '.m4a', '.flac', '.aac', '.ogg']
        audio_files = []
        
        for file in os.listdir('.'):
            if any(file.lower().endswith(ext) for ext in audio_extensions):
                audio_files.append(file)
        
        if audio_files:
            print("\n📁 Audio files found:")
            for i, file in enumerate(audio_files, 1):
                print(f"   {i}. {file}")
        else:
            print("\n📁 No audio files found in current directory")
            print("   Supported formats: WAV, MP3, M4A, FLAC, AAC, OGG")

def main():
    """Main function"""
    print("🎤 Whisper Model File Tester")
    print("=" * 40)
    
    tester = WhisperTester()
    
    # Load model
    if not tester.load_model():
        print("❌ Failed to load model. Exiting.")
        return
    
    print("\n💡 Tips:")
    print("   - You can test with any audio file (WAV, MP3, M4A, etc.)")
    print("   - For microphone recording, install PyAudio:")
    print("     brew install portaudio && pip install pyaudio")
    print("   - Or use the Flask API: python app.py")
    
    # Start interactive mode
    tester.interactive_mode()

if __name__ == "__main__":
    main()
