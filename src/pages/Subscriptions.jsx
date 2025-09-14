import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Loader2, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { saveBudgetSnapshot } from "@/lib/analytics";

function PieChart({ data = [], size = 180, onSliceEnter, onSliceLeave }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const r = size / 2;
  const c = r;
  let acc = 0;
  const arcs = data.map((d, idx) => {
    const v = d.value || 0;
    const frac = total > 0 ? v / total : 0;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const x0 = c + r * Math.cos(a0);
    const y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1);
    const y1 = c + r * Math.sin(a1);
    const largeArc = frac > 0.5 ? 1 : 0;
    const dpath = `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    return (
      <path
        key={idx}
        d={dpath}
        fill={d.color}
        opacity={0.9}
        onMouseEnter={() => onSliceEnter && onSliceEnter(d, frac)}
        onMouseLeave={() => onSliceLeave && onSliceLeave()}
      />
    );
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs}
    </svg>
  );
}

export default function Subscriptions() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const isMobile = useIsMobile();
  const [monthlyBudget, setMonthlyBudget] = useState("2500");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [hovered, setHovered] = useState(null);
  const [hiddenKeys, setHiddenKeys] = useState(new Set());
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const externalUserId = 'zuno_user_123';

  // Dummy monthly spend breakdown (USD)
  const [monthlyMerchants, setMonthlyMerchants] = useState([
    { key: 'amazon', name: 'Amazon', value: 420, color: '#6366f1' },
    { key: 'target', name: 'Target', value: 260, color: '#ef4444' },
    { key: 'walmart', name: 'Walmart', value: 320, color: '#10b981' },
    { key: 'costco', name: 'Costco', value: 380, color: '#f59e0b' },
    { key: 'doordash', name: 'DoorDash', value: 110, color: '#8b5cf6' },
    { key: 'instacart', name: 'Instacart', value: 160, color: '#14b8a6' },
    { key: 'ubereats', name: 'UberEats', value: 95, color: '#06b6d4' },
    { key: 'subscriptions', name: 'Streaming/Apps', value: 0, color: '#94a3b8' },
  ]);

  const visibleMerchants = useMemo(
    () => monthlyMerchants.filter(m => !hiddenKeys.has(m.key)),
    [monthlyMerchants, hiddenKeys]
  );

  // Non-linear factors for annual pie to look natural
  const monthlyTotal = visibleMerchants.reduce((s, m) => s + (m.value || 0), 0);

  // Persist snapshot so Dashboard Spendometer mirrors this view
  useEffect(() => {
    try {
      const byMerchant = Object.fromEntries(visibleMerchants.map((m) => [m.name, m.value]));
      saveBudgetSnapshot({ totalMonth: monthlyTotal, byMerchant });
    } catch {}
  }, [monthlyTotal, visibleMerchants]);

  const runAudit = async () => {
    setLoading(true);
    setError("");
    setDraft(null);
    try {
      const res = await fetch(`${baseUrl}/subscriptions/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_user_id: externalUserId, merchants: [44,12,45], limit: 50, lookback_days: 365 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Audit failed');
      setResults(data);
    } catch (e) {
      setError(e.message || 'Audit failed');
    } finally {
      setLoading(false);
    }
  };

  const runBudgetAnalysis = async () => {
    setAiLoading(true);
    setAiText("");
    try {
      const lines = monthlyMerchants.map(m => `${m.name}: $${m.value.toFixed(0)}`).join("; ");
      const systemPrompt = "You are the Budget Advisor AI Agent. Your focus is on spending insights, budget optimization, and cost-saving strategies for shopping within the app. Stay within the scope of budgeting, spending analysis, and financial guidance. If unrelated topics come up, politely decline and bring the conversation back to budgeting. Respond in a clear, analytical, and supportive tone.";
      const msg = `My monthly budget is $${monthlyBudget}. Estimated monthly spend split: ${lines}. Provide 4-6 short, plain lines (no markdown, no emojis, no special symbols). Each line should be a simple point beginning with "- ". Focus on actionable guidance and qualitative insights, not math. Cover: subscriptions cleanup, delivery vs groceries, category rebalancing for next month, and one or two specific savings actions.`;
      const res = await fetch(`${baseUrl}/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, system: systemPrompt })
      });
      const data = await res.json();
      if (res.ok && data?.reply) setAiText(data.reply);
      else setAiText("Could not generate analysis right now.");
    } catch (e) {
      setAiText("Analysis failed. Please try again later.");
    } finally {
      setAiLoading(false);
    }
  };

  const buildHistory = () => {
    try {
      return chatMessages.map((m) => ({ role: m.role, content: m.text }));
    } catch (_) {
      return [];
    }
  };

  const askBudgetAdvisor = async (question) => {
    const lines = monthlyMerchants.map(m => `${m.name}: $${m.value.toFixed(0)}`).join("; ");
    const systemPrompt = "You are the Budget Advisor AI Agent. Your focus is on spending insights, budget optimization, and cost-saving strategies for shopping within the app. Stay within the scope of budgeting, spending analysis, and financial guidance. If unrelated topics come up, politely decline and bring the conversation back to budgeting. Respond in a clear, analytical, and supportive tone.";
    const msg = `My monthly budget is $${monthlyBudget}. Estimated monthly spend split: ${lines}. Question: ${question}. Reply in 4-6 short plain lines, no markdown or symbols, each starting with "- ". Focus on practical budgeting guidance.`;
    const res = await fetch(`${baseUrl}/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, system: systemPrompt, history: buildHistory() })
    });
    const data = await res.json();
    return res.ok && data?.reply ? data.reply : "- Unable to answer right now.";
  };

  const runVoiceAnalysis = async (transcript) => {
    setAiLoading(true);
    try {
      const lines = monthlyMerchants.map(m => `${m.name}: $${m.value.toFixed(0)}`).join("; ");
      const systemPrompt = "You are the Budget Advisor AI Agent. Your focus is on spending insights, budget optimization, and cost-saving strategies for shopping within the app. Stay within the scope of budgeting, spending analysis, and financial guidance. If unrelated topics come up, politely decline and bring the conversation back to budgeting. Respond in a clear, analytical, and supportive tone.";
      const msg = `My monthly budget is $${monthlyBudget}. Estimated monthly spend split: ${lines}. Additional question: ${transcript}. Provide 4-6 short, plain lines (no markdown, no emojis, no special symbols). Each line should be a simple point beginning with "- ". Focus on actionable guidance and qualitative insights, not math.`;
      const res = await fetch(`${baseUrl}/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, system: systemPrompt, history: buildHistory() })
      });
      const data = await res.json();
      if (res.ok && data?.reply) {
        setChatMessages((m) => [...m, { role: 'user', text: transcript }, { role: 'ai', text: data.reply }]);
      }
    } catch (_) {
      // ignore
    } finally {
      setAiLoading(false);
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
        try {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          await sendAudioToBackend(blob);
        } finally {
          stream.getTracks().forEach(t => t.stop());
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (_) {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } finally {
      setIsRecording(false);
    }
  };

  const handleMicToggle = () => {
    if (isRecording) stopRecording(); else startRecording();
  };

  const sendAudioToBackend = async (blob) => {
    try {
      const formData = new FormData();
      const file = new File([blob], 'recording.webm', { type: blob.type || 'audio/webm' });
      formData.append('audio', file);
      const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data?.transcription) {
        await runVoiceAnalysis(data.transcription);
      }
    } catch (_) {}
  };

  const renderCandidates = () => {
    const cands = results?.candidates || [];
    if (!cands.length) return <p className="text-gray-500">No recurring subscriptions detected in the lookback window.</p>;
    return (
      <div className="space-y-3">
        {cands.map((c, i) => {
          const parts = (c.key || '').split('::');
          const scope = parts[0] || '';
          const merchant = parts[1] || 'Unknown';
          const product = parts.slice(2).join('::') || '';
          return (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="font-medium text-gray-900">{product || merchant}</p>
                <p className="text-xs text-gray-500">{scope.includes('prod') ? `Product at ${merchant}` : `Merchant: ${merchant}`} • Avg gap {Math.round(c.avg_gap_days)} days • {c.occurrences} occurrences</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeCancelDraft(merchant, product)}
                  className="inline-flex items-center gap-1"
                  disabled={loading}
                >
                  <Mail className="w-3.5 h-3.5" /> Draft cancel email
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-2">Budget Analyser</h1>
          <p className="text-base text-gray-600">Understand your monthly spend and get AI insights.</p>
        </motion.div>

        {/* Budget overview */}
        <div className="bg-white rounded-3xl p-4 md:p-6 border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row md:items-center items-stretch justify-between gap-4 mb-4">
            <h2 className="text-xl font-light text-gray-900">Monthly spend</h2>
            <div className="flex items-stretch md:items-center gap-3 md:gap-2">
              <div className="flex flex-col flex-1 md:flex-initial">
                <span className="text-xs text-gray-600 mb-1">Monthly budget (USD) </span>
                <Input
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="Enter amount"
                  className="bg-gray-50 md:w-44"
                  type="number"
                  min={0}
                />
              </div>
              <Button onClick={runBudgetAnalysis} disabled={aiLoading} className="inline-flex items-center gap-2">
                {aiLoading && <Loader2 className="w-4 h-4 animate-spin" />} Analyze
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditMode((v) => !v)}
                className={`${isEditMode ? 'border-indigo-500 text-indigo-700' : ''}`}
              >
                {isEditMode ? 'Exit edit mode' : 'Edit mode'}
              </Button>
            </div>
          </div>
          {/* Pie chart */}
          <div className="mb-6">
            {/* Budget usage bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Used</span>
                <span>${monthlyTotal.toFixed(0)} / ${Number(monthlyBudget || 0).toFixed(0)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${Math.min(100, (monthlyTotal / Math.max(1, Number(monthlyBudget || 1))) * 100).toFixed(1)}%` }}
                />
              </div>
        </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <span>By merchant</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <PieChart
                data={visibleMerchants}
                size={isMobile ? 180 : 240}
                onSliceEnter={(d, frac) => setHovered({ d, frac })}
                onSliceLeave={() => setHovered(null)}
              />
              <div className="mt-2 text-xs text-gray-700 h-5">
                {hovered ? `${hovered.d.name}: $${(hovered.d.value || 0).toFixed(0)} (${(hovered.frac * 100).toFixed(1)}%)` : 'Hover to see details'}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600 text-center">Total: ${monthlyTotal.toFixed(0)} / month</div>

            {isEditMode && (
              <>
                {/* Interactive legend */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {monthlyMerchants.map((m) => {
                    const active = !hiddenKeys.has(m.key);
                    return (
                      <button
                        key={m.key}
                        onClick={() => {
                          setHiddenKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.key)) next.delete(m.key); else next.add(m.key);
                            return next;
                          });
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-full border text-xs ${active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-200 opacity-70'}`}
                        title={active ? 'Click to hide' : 'Click to show'}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="truncate">{m.name}</span>
                        <span className="ml-auto">${m.value.toFixed(0)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Adjust allocations */}
                <div className="mt-6 p-4 rounded-2xl border border-gray-100 bg-gray-50">
                  <div className="text-sm text-gray-700 mb-3">Adjust category allocations</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {monthlyMerchants.map((m, idx) => (
                      <div key={m.key} className="text-xs">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <span className="text-gray-700">{m.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">$</span>
                            <Input
                              type="number"
                              min={0}
                              step={5}
                              value={m.value}
                              onChange={(e) => {
                                const v = Number(e.target.value || 0);
                                setMonthlyMerchants((arr) => {
                                  const next = [...arr];
                                  next[idx] = { ...next[idx], value: v };
                                  return next;
                                });
                              }}
                              className="w-24 h-7 bg-white"
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1000}
                          step={5}
                          value={m.value}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMonthlyMerchants((arr) => {
                              const next = [...arr];
                              next[idx] = { ...next[idx], value: v };
                              return next;
                            });
                          }}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] text-gray-500">Tip: Toggle categories above to include/exclude from the chart.</div>
                </div>
              </>
            )}
          </div>

          {/* Voice mic and AI analysis below the chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Budget Advisor</div>
              <Button
                variant={isRecording ? "default" : "outline"}
                size="icon"
                onClick={handleMicToggle}
                className={`rounded-full w-12 h-12 ${isRecording ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}
                title={isRecording ? 'Stop recording' : 'Speak your question'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 text-sm">
              {aiText ? (
                <div className="space-y-2">
                  {aiText.split(/\n+/).filter(Boolean).map((raw, idx) => {
                    const clean = raw.replace(/^[-•\d\.\s]+/, '').trim();
                    return (
                      <div key={idx} className="text-gray-800">- {clean}</div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-gray-600">Enter your monthly budget, click Analyze or tap the mic to ask for deeper insights.</div>
              )}
            </div>

            {/* Chat box */}
            <div className="mt-4 p-4 rounded-2xl border border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900">Ask a follow-up</div>
                <div className="text-xs text-gray-500">Context: monthly budget & category splits included</div>
              </div>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  'How can I cut grocery spend next month?',
                  'Am I overspending on delivery apps?',
                  'Suggest a better allocation for my budget',
                ].map((s, idx) => (
                  <button
                    key={idx}
                    className="px-3 py-1.5 text-xs rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700"
                    onClick={async () => {
                      setChatMessages((m) => [...m, { role: 'user', text: s }]);
                      const reply = await askBudgetAdvisor(s);
                      setChatMessages((m) => [...m, { role: 'ai', text: reply }]);
                      setAiText(reply);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your budgeting question..."
                  className="flex-1 bg-gray-50"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      const q = chatInput.trim();
                      setChatMessages((m) => [...m, { role: 'user', text: q }]);
                      setChatInput('');
                      const reply = await askBudgetAdvisor(q);
                      setChatMessages((m) => [...m, { role: 'ai', text: reply }]);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!chatInput.trim()) return;
                    const q = chatInput.trim();
                    setChatMessages((m) => [...m, { role: 'user', text: q }]);
                    setChatInput('');
                    const reply = await askBudgetAdvisor(q);
                    setChatMessages((m) => [...m, { role: 'ai', text: reply }]);
                  }}
                  className="inline-flex items-center gap-2"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>

              {chatMessages.length > 0 && (
                <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                  {chatMessages.slice(-6).map((m, i) => (
                    <div key={i} className={`text-xs rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-indigo-50 text-indigo-900' : 'bg-emerald-50 text-emerald-900'}`}>
                      {m.role === 'user' ? `You: ${m.text}` : m.text}
                    </div>
                  ))}
          </div>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}