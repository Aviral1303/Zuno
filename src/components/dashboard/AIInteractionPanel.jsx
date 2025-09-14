import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Sparkles } from "lucide-react";

const AIInteractionPanel = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [lastReply, setLastReply] = useState("");
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        await sendAudioToBackend(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (!isRecording) startRecording(); else stopRecording();
  };

  const sendAudioToBackend = async (blob) => {
    try {
      const formData = new FormData();
      const file = new File([blob], 'recording.webm', { type: blob.type || 'audio/webm' });
      formData.append('audio', file);
      const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data?.transcription) {
        setInputMessage(data.transcription);
        await sendToLLM(data.transcription);
      } else {
        console.error('Transcription error:', data?.error || 'Unknown error');
      }
    } catch (e) {
      console.error('Failed to send audio:', e);
    }
  };

  const sendToLLM = async (text) => {
    if (!text?.trim()) return;
    try {
      setIsThinking(true);
      const res = await fetch(`${baseUrl}/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (res.ok && data?.reply) {
        setLastReply(data.reply);
      } else {
        setLastReply(data?.error || 'Model error');
      }
    } catch (e) {
      console.error('LLM request failed:', e);
      setLastReply('LLM request failed. Check server.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendClick = async () => {
    const text = inputMessage;
    setInputMessage("");
    await sendToLLM(text);
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSendClick();
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-semibold text-gray-900">Talk to Zuno</h3>
            <p className="text-sm text-gray-500">Speak or type to your AI shopping assistant</p>
          </div>
        </div>

        <div className="relative mb-6 md:mb-8">
          <Button
            onClick={toggleRecording}
            className={`relative rounded-full w-24 h-24 md:w-28 md:h-28 text-white ${
              isRecording ? 'bg-gradient-to-br from-red-600 to-pink-600' : 'bg-gradient-to-br from-indigo-600 to-purple-600'
            }`}
          >
            {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-300"
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </Button>
        </div>

        <div className="w-full max-w-2xl flex items-center gap-3">
          <div className="flex-1">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about deals, prices, subscriptions, gifts..."
              className="bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
          </div>
          <Button
            onClick={handleSendClick}
            disabled={!inputMessage.trim() || isThinking}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {lastReply && (
          <div className="w-full max-w-2xl text-left mt-4 p-4 bg-slate-50 rounded-2xl border border-gray-100">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{lastReply}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInteractionPanel;


