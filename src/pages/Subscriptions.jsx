import React, { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Subscriptions() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [draft, setDraft] = useState(null);

  const externalUserId = 'zuno_user_123';

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

  const makeCancelDraft = async (merchantName, productName) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/subscriptions/cancel_draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_name: merchantName, product_name: productName, external_user_id: externalUserId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Draft failed');
      setDraft(data);
    } catch (e) {
      setError(e.message || 'Draft failed');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-4xl font-light text-gray-900 mb-2">Subscription Manager</h1>
          <p className="text-base text-gray-600">Detect recurring charges and cancel what you don't need.</p>
        </motion.div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Scan the last 12 months across your linked merchants</p>
            </div>
            <Button onClick={runAudit} disabled={loading} className="inline-flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Run audit
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        {results && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100">
            <h2 className="text-xl font-light text-gray-900 mb-4">Candidates</h2>
            {renderCandidates()}

            {draft && (
              <div className="mt-6 bg-gray-50 rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-700 font-medium mb-2">Cancel email draft</p>
                <p className="text-sm text-gray-900"><span className="font-semibold">Subject:</span> {draft.subject}</p>
                <pre className="text-xs bg-white p-3 rounded-lg border border-gray-200 overflow-auto mt-2 whitespace-pre-wrap">{draft.body}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}