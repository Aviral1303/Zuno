import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Trash2, PlusCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PriceTracker() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [watches, setWatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ canonical_id: "", target_price: "" });
  const [matches, setMatches] = useState([]);

  const externalUserId = 'zuno_user_123';

  const loadWatches = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/price-protection/list?external_user_id=${encodeURIComponent(externalUserId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setWatches(data.watches || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatches();
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const res = await fetch(`${baseUrl}/price-protection/matches?external_user_id=${encodeURIComponent(externalUserId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load matches');
      setMatches(data.matches || []);
    } catch (e) {
      console.warn('loadMatches failed', e);
    }
  };

  const addWatch = async (e) => {
    e?.preventDefault?.();
    if (!form.canonical_id.trim()) return;
    setLoading(true);
    setError("");
    try {
      const targetCents = form.target_price ? Math.round(Number(form.target_price) * 100) : undefined;
      const res = await fetch(`${baseUrl}/price-protection/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_user_id: externalUserId,
          canonical_id: form.canonical_id.trim(),
          target_price_cents: targetCents,
          note: 'manual add',
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to add');
      setForm({ canonical_id: "", target_price: "" });
      await loadWatches();
      await loadMatches();
    } catch (e) {
      setError(e.message || 'Failed to add');
    } finally {
      setLoading(false);
    }
  };

  const deleteWatch = async (id) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/price-protection/watch/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to delete');
      await loadWatches();
      await loadMatches();
    } catch (e) {
      setError(e.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-2">Price Tracker</h1>
          <p className="text-base text-gray-600">Track items and get notified when prices drop.</p>
        </motion.div>

        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 mb-6">
          <form onSubmit={addWatch} className="grid gap-4 md:grid-cols-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600 mb-1 block">Item ID or URL</label>
              <Input
                value={form.canonical_id}
                onChange={(e) => setForm((f) => ({ ...f, canonical_id: e.target.value }))}
                placeholder="e.g. asin:B0... or product URL"
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Target price (USD)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.target_price}
                onChange={(e) => setForm((f) => ({ ...f, target_price: e.target.value }))}
                placeholder="Optional"
                className="bg-white"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={loading} className="inline-flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Add watch
              </Button>
            </div>
          </form>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100">
          <h2 className="text-xl font-light text-gray-900 mb-4">Your watches</h2>
          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : watches.length ? (
            <div className="grid gap-3">
              {watches.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{w.canonical_id || w.note || 'Tracked item'}</p>
                    <p className="text-xs text-gray-500">Added {new Date(w.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-900">
                      {w.target_price_cents != null ? `$${(w.target_price_cents/100).toFixed(2)}` : '—'}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => deleteWatch(w.id)} disabled={loading}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No watches yet. Add one above or from Deal Hunter.</p>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-light text-gray-900">Alerts</h2>
            <Button variant="outline" size="sm" onClick={loadMatches} className="inline-flex items-center gap-2">
              <Bell className="w-4 h-4" /> Refresh
            </Button>
          </div>
          {matches.length ? (
            <div className="grid gap-3">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">Match on watch #{m.watch_id}</p>
                    <p className="text-xs text-gray-500">Detected {new Date(m.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-sm text-emerald-700 font-semibold">
                    {typeof m.found_price_cents === 'number' ? `$${(m.found_price_cents/100).toFixed(2)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No alerts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}