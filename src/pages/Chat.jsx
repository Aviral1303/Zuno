import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  RotateCcw,
  Settings,
  Sparkles,
  Mic,
  MicOff
} from "lucide-react";
import { ChatMessage } from "@/entities/ChatMessage";

import ChatBubble from "../components/chat/ChatBubble";
import VoiceToggle from "../components/chat/VoiceToggle";
import TypingIndicator from "../components/chat/TypingIndicator";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const silenceStartRef = useRef(null);
  const VAD_SILENCE_MS = 1200;
  const VAD_THRESHOLD = 0.01; // RMS threshold
  const [showReasoning, setShowReasoning] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const HISTORY_STORAGE_KEY = 'zuno_chat_history_v1';
  const [purchasePreview, setPurchasePreview] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length) {
          setMessages(saved);
          return;
        }
      }
    } catch {}
    const welcomeMessage = {
      message: "Hi! I'm your Zuno shopping concierge. I can help you find deals, track prices, manage subscriptions, and plan gifts. What can I help you with today?",
      sender: "ai",
      message_type: "text"
    };
    setMessages([welcomeMessage]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const loadMessages = async () => {
    try {
      const chatMessages = await ChatMessage.list('-created_date');
      setMessages(chatMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Lightweight buy-intent detection: "buy <url|canonical>" or starts with "/buy"
    const detectBuy = (text) => {
      const t = text.trim();
      const lower = t.toLowerCase();
      // Extract URL
      const urlMatch = t.match(/https?:\/\/\S+/i);
      // Detect canonical like 44:ASINCODE or 12:A-12345
      const canonicalMatch = t.match(/^(?:buy\s+|\/buy\s+)?(\d+:[A-Za-z0-9\-]+)/i);
      if (lower.startsWith('buy ') || lower.startsWith('/buy ') || urlMatch || canonicalMatch) {
        return {
          url: urlMatch ? urlMatch[0] : undefined,
          canonical: canonicalMatch && canonicalMatch[1] ? canonicalMatch[1] : undefined,
        };
      }
      return null;
    };

    const maybeBuy = detectBuy(inputMessage);
    if (maybeBuy && (maybeBuy.url || maybeBuy.canonical)) {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
        const res = await fetch(`${baseUrl}/purchase/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: maybeBuy.url, canonical_id: maybeBuy.canonical, qty: 1 })
        });
        const data = await res.json();
        if (res.ok && data?.ok) {
          setPurchasePreview(data);
          // Also drop a chat message to indicate preview created
          setMessages(prev => [...prev, { message: 'I prepared a purchase preview. Please confirm.', sender: 'ai', message_type: 'text' }]);
          setInputMessage('');
          return;
        } else {
          setMessages(prev => [...prev, { message: `Preview failed: ${data?.error || 'Unknown error'}`, sender: 'ai', message_type: 'text' }]);
          setInputMessage('');
          return;
        }
      } catch (e) {
        setMessages(prev => [...prev, { message: `Preview failed: ${String(e)}`, sender: 'ai', message_type: 'text' }]);
        setInputMessage('');
        return;
      }
    }

    const userMessage = {
      message: inputMessage,
      sender: "user",
      message_type: "text"
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Send to backend LLM
    try {
      setShowReasoning(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const historyPayload = (messages || []).slice(-12).map(m => ({
        role: m.sender === 'user' ? 'user' : 'ai',
        content: m.message,
      }));
      const res = await fetch(`${baseUrl}/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.message, history: historyPayload })
      });
      const data = await res.json();
      setIsTyping(false);
      setShowReasoning(false);
      if (res.ok && data?.reply) {
        const aiResponse = {
          message: data.reply,
          sender: 'ai',
          message_type: 'text'
        };
        setMessages(prev => [...prev, aiResponse]);
        try { await ChatMessage.create(aiResponse); } catch {}
      } else {
        const errMsg = data?.error || 'Model error';
        setMessages(prev => [...prev, { message: `LLM error: ${errMsg}`, sender: 'ai', message_type: 'text' }]);
      }
    } catch (error) {
      setIsTyping(false);
      setShowReasoning(false);
      console.error('LLM request failed:', error);
      setMessages(prev => [...prev, { message: 'LLM request failed. Check server.', sender: 'ai', message_type: 'text' }]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
        teardownVAD();
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);
      setIsRecording(true);
      setupVAD(stream);
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    setIsRecording(false);
    teardownVAD();
  };

  const handleAudioRecord = () => {
    if (!isRecording) startRecording(); else stopRecording();
  };

  const sendAudioToBackend = async (blob) => {
    try {
      const formData = new FormData();
      const file = new File([blob], 'recording.webm', { type: blob.type || 'audio/webm' });
      formData.append('audio', file);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const res = await fetch(`${baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data?.transcription) {
        // Set the transcript in input and send it to LLM
        setInputMessage(data.transcription);
        // Automatically send the transcribed message to LLM
        await sendTranscribedMessage(data.transcription);
      } else {
        console.error('Transcription error:', data?.error || 'Unknown error');
      }
    } catch (e) {
      console.error('Failed to send audio:', e);
    }
  };

  const sendTranscribedMessage = async (transcript) => {
    if (!transcript.trim()) return;

    const userMessage = {
      message: transcript,
      sender: "user",
      message_type: "text"
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setShowReasoning(true);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const historyPayload = (messages || []).slice(-12).map(m => ({
        role: m.sender === 'user' ? 'user' : 'ai',
        content: m.message,
      }));
      const res = await fetch(`${baseUrl}/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: transcript, history: historyPayload })
      });
      const data = await res.json();
      
      if (res.ok && data?.reply) {
        const aiResponse = {
          message: data.reply,
          sender: 'ai',
          message_type: 'text'
        };
        setMessages(prev => [...prev, aiResponse]);
        try { await ChatMessage.create(aiResponse); } catch {}
      } else {
        const errMsg = data?.error || 'Model error';
        setMessages(prev => [...prev, { message: `LLM error: ${errMsg}`, sender: 'ai', message_type: 'text' }]);
      }
    } catch (error) {
      console.error('LLM request failed:', error);
      setMessages(prev => [...prev, { message: 'LLM request failed. Check server.', sender: 'ai', message_type: 'text' }]);
    } finally {
      setIsTyping(false);
      setShowReasoning(false);
    }
  };

  const clearChat = () => {
    const next = [{
      message: "Chat cleared. How can I help you today?",
      sender: "ai",
      message_type: "text"
    }];
    setMessages(next);
    try { localStorage.removeItem(HISTORY_STORAGE_KEY); } catch {}
  };

  // Persist messages locally for demo memory
  useEffect(() => {
    try {
      if (Array.isArray(messages) && messages.length) {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {}
  }, [messages]);

  const setupVAD = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);
      const data = new Float32Array(analyser.frequencyBinCount);
      silenceStartRef.current = null;
      vadIntervalRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const sample = data[i];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        const now = Date.now();
        if (rms < VAD_THRESHOLD) {
          if (!silenceStartRef.current) silenceStartRef.current = now;
          if (now - silenceStartRef.current >= VAD_SILENCE_MS) {
            stopRecording();
          }
        } else {
          silenceStartRef.current = null;
        }
      }, 150);
    } catch (e) {
      console.warn('VAD setup failed:', e);
    }
  };

  const teardownVAD = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    } catch {}
    audioContextRef.current = null;
    analyserRef.current = null;
    silenceStartRef.current = null;
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Zuno Concierge</h1>
              <p className="text-gray-500 text-sm">Your AI shopping assistant</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={clearChat}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-2xl"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-2xl"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {messages.map((message, index) => (
              <ChatBubble
                key={index}
                message={message}
                index={index}
                prevSender={index > 0 ? messages[index - 1]?.sender : undefined}
                timestamp={message.timestamp}
              />
            ))}
          </AnimatePresence>
          
          <AnimatePresence>
            {isTyping && (
              <TypingIndicator showReasoning={showReasoning} />
            )}
          </AnimatePresence>
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white/80 backdrop-blur border-t border-gray-200 p-4 md:p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          {purchasePreview && (
            <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-500">{purchasePreview.merchant}</div>
                  <div className="font-medium text-gray-900 truncate">{purchasePreview.item?.title || 'Item'}</div>
                  <div className="text-xs text-gray-500 truncate">{purchasePreview.item?.canonical_id}</div>
                  <div className="mt-2 text-sm text-gray-700">
                    Subtotal: ${purchasePreview.item?.unit_price_usd?.toFixed?.(2) || purchasePreview.item?.unit_price_usd} × {purchasePreview.item?.qty || 1}
                    {' '}• Shipping: ${purchasePreview.fees?.shipping?.toFixed?.(2) || purchasePreview.fees?.shipping}
                    {' '}• Tax: ${purchasePreview.fees?.tax?.toFixed?.(2) || purchasePreview.fees?.tax}
                  </div>
                  <div className="text-base font-semibold text-gray-900">Total: ${purchasePreview.total_usd?.toFixed?.(2) || purchasePreview.total_usd}</div>
                </div>
                {purchasePreview.item?.image && (
                  <img src={purchasePreview.item.image} alt="thumb" className="w-16 h-16 object-cover rounded-xl border border-gray-100" />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  onClick={async () => {
                    if (!purchasePreview?.preview_token) return;
                    setPlacingOrder(true);
                    try {
                      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
                      const res = await fetch(`${baseUrl}/purchase/confirm`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ preview_token: purchasePreview.preview_token })
                      });
                      const data = await res.json();
                      if (res.ok && data?.ok) {
                        setMessages(prev => [...prev, { message: `Order placed: ${data.order_id}`, sender: 'ai', message_type: 'text' }]);
                        setPurchasePreview(null);
                      } else {
                        setMessages(prev => [...prev, { message: `Purchase failed: ${data?.error || 'Unknown error'}`, sender: 'ai', message_type: 'text' }]);
                      }
                    } catch (e) {
                      setMessages(prev => [...prev, { message: `Purchase failed: ${String(e)}`, sender: 'ai', message_type: 'text' }]);
                    } finally {
                      setPlacingOrder(false);
                    }
                  }}
                  disabled={placingOrder}
                  className="rounded-2xl"
                >
                  {placingOrder ? 'Placing…' : 'Confirm purchase'}
                </Button>
                <Button variant="outline" onClick={() => setPurchasePreview(null)} className="rounded-2xl">Cancel</Button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 md:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleAudioRecord}
              className={`relative rounded-full transition-all duration-300 ${
                isRecording 
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 border-red-500 text-white' 
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              
              {isRecording && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-red-400"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.8, 0, 0.8],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </Button>
            
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about deals, gifts, subscriptions..."
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 rounded-2xl pr-10 md:pr-12 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
              />
              
              {isRecording && (
                <motion.div
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                </motion.div>
              )}
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-gray-400 text-xs text-center mt-3">
            Zuno AI can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}