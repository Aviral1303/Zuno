import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Trash2, PlusCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function PriceTracker() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [watches, setWatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ canonical_id: "", target_price: "" });
  const [matches, setMatches] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [watchMeta, setWatchMeta] = useState({}); // id -> { title?, priceUsd? }
  const [history, setHistory] = useState({}); // canonical -> points

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

  useEffect(() => {
    // For each watch, try to resolve product meta (title/price) if we can infer a URL
    const run = async () => {
      const entries = Array.isArray(watches) ? watches : [];
      for (const w of entries) {
        if (!w || !w.canonical_id || watchMeta[w.id]) continue;
        const url = buildUrlFromCanonical(w.canonical_id);
        if (!url) continue;
        try {
          const res = await fetch(`${baseUrl}/product/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const data = await res.json();
          if (res.ok && data?.ok) {
            setWatchMeta((m) => ({
              ...m,
              [w.id]: { title: data.title, priceUsd: data.price_usd }
            }));
          }
        } catch (e) {
          // ignore per-item failure
        }
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watches)]);

  const buildUrlFromCanonical = (canonical) => {
    try {
      const [mid, pid] = String(canonical).split(':');
      if (!mid || !pid) return null;
      const m = parseInt(mid, 10);
      if (m === 44) return `https://www.amazon.com/dp/${pid}`;
      if (m === 12) return `https://www.target.com/p/-/A-${pid}`;
      if (m === 45) return `https://www.walmart.com/ip/${pid}`;
      return null;
    } catch {
      return null;
    }
  };

  // Fetch 1-year price history for each watch
  useEffect(() => {
    const fetchHistories = async () => {
      const entries = Array.isArray(watches) ? watches : [];
      for (const w of entries) {
        const key = w.canonical_id;
        if (!key || history[key]) continue;
        try {
          const res = await fetch(`${baseUrl}/price-history/list?canonical_id=${encodeURIComponent(key)}&since_days=365`);
          const data = await res.json();
          if (res.ok && data?.ok) {
            setHistory((h) => ({ ...h, [key]: data.points || [] }));
          }
        } catch (e) {
          // ignore
        }
      }
    };
    fetchHistories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watches)]);

  // Simple inline SVG sparkline/line chart
  const PriceLineChart = ({ points = [], baselinePrice, targetPrice, className }) => {
    if (!points.length) return <div className={cn("h-16 text-xs text-gray-400 flex items-center", className)}>No data</div>;
    const w = 280;
    const h = 64;
    const pad = 6;
    const xs = points.map((p, i) => i);
    const ys = points.map((p) => Number(p.price_usd));
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanY = Math.max(0.01, maxY - minY);
    const toX = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, xs.length - 1);
    const toY = (v) => h - pad - ((v - minY) * (h - 2 * pad)) / spanY;
    const d = xs
      .map((i, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(2)} ${toY(ys[idx]).toFixed(2)}`)
      .join(' ');
    const last = ys[ys.length - 1];
    const first = ys[0];
    const change = last - first;
    const color = change >= 0 ? "#16a34a" : "#dc2626";
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)}>
        {/* Baseline (first price) */}
        {typeof baselinePrice === 'number' && (
          <line x1={pad} x2={w - pad} y1={toY(baselinePrice)} y2={toY(baselinePrice)} stroke="#94a3b8" strokeDasharray="1 3" strokeWidth="1" strokeOpacity="0.8" />
        )}
        {/* Target price (only if provided) */}
        {typeof targetPrice === 'number' && (
          <line x1={pad} x2={w - pad} y1={toY(targetPrice)} y2={toY(targetPrice)} stroke="#7c3aed" strokeDasharray="1.5 3" strokeWidth="1" strokeOpacity="0.9" />
        )}
        {/* Series line thinner for clarity */}
        <path d={d} fill="none" stroke={color} strokeWidth="0.9" strokeOpacity="0.95" />
        {xs.map((_, idx) => idx === xs.length - 1 ? (
          <circle key={idx} cx={toX(idx)} cy={toY(ys[idx])} r="1.8" fill={color} fillOpacity="0.95" />
        ) : null)}
      </svg>
    );
  };

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

  // Try to extract merchant/product/price from a product URL
  const parseProductUrl = (value) => {
    try {
      const u = new URL(value);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      const path = u.pathname;
      const qp = u.searchParams;

      // Helper to pull a likely price from common query keys
      const extractPrice = () => {
        const keys = ['price', 'amount', 'value', 'offerprice', 'uprice', 'pr', 'p'];
        for (const k of keys) {
          const v = qp.get(k);
          if (!v) continue;
          const num = parseFloat(v.replace(/[^0-9.]/g, ''));
          if (!Number.isNaN(num) && num > 0) return num;
        }
        return undefined;
      };

      const slugToTitle = (slug) => {
        if (!slug) return undefined;
        try {
          const cleaned = decodeURIComponent(slug)
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (!cleaned) return undefined;
          return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        } catch {
          return undefined;
        }
      };

      // Amazon: /dp/ASIN or /gp/product/ASIN
      if (host.includes('amazon.')) {
        const m = path.match(/\/(?:gp\/product|dp)\/([A-Z0-9]{10})/i) || path.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
        const slugMatch = path.match(/\/([^/]+)\/dp\//i);
        const asin = m && m[1] ? m[1].toUpperCase() : undefined;
        const price = extractPrice();
        const title = slugToTitle(slugMatch && slugMatch[1]);
        if (asin) {
          return {
            merchantName: 'Amazon',
            merchantId: 44,
            productId: asin,
            priceUsd: price,
            title,
            canonical: `44:${asin}`,
          };
        }
      }

      // Walmart: /ip/<slug>/<id>
      if (host.includes('walmart.com')) {
        const parts = path.split('/').filter(Boolean);
        const id = parts[parts.length - 1];
        const numeric = id && id.match(/\d+/) ? id.match(/\d+/)[0] : undefined;
        const price = extractPrice();
        const slug = parts[parts.length - 2];
        const title = slugToTitle(slug);
        if (numeric) {
          return {
            merchantName: 'Walmart',
            merchantId: 45,
            productId: numeric,
            priceUsd: price,
            title,
            canonical: `45:${numeric}`,
          };
        }
      }

      // Target: /p/<slug>/-/A-<id>
      if (host.includes('target.com')) {
        const m = path.match(/\/A-(\d+)/);
        const slugMatch = path.match(/\/p\/([^/]+)\/-\//i);
        const tid = m && m[1] ? m[1] : undefined;
        const price = extractPrice();
        const title = slugToTitle(slugMatch && slugMatch[1]);
        if (tid) {
          return {
            merchantName: 'Target',
            merchantId: 12,
            productId: tid,
            priceUsd: price,
            title,
            canonical: `12:${tid}`,
          };
        }
      }

      // Fallback for unknown domains
      return {
        merchantName: host,
        merchantId: undefined,
        productId: path.split('/').filter(Boolean).pop(),
        priceUsd: undefined,
        canonical: value,
      };
    } catch {
      return null;
    }
  };

  const addWatch = async (e) => {
    e?.preventDefault?.();
    if (!form.canonical_id.trim()) return;
    setLoading(true);
    setError("");
    try {
      // Prefer parsed price if user didn't provide a target
      const targetCents = form.target_price
        ? Math.round(Number(form.target_price) * 100)
        : (parsed?.priceUsd ? Math.round(Number(parsed.priceUsd) * 100) : undefined);
      const canonical = (() => {
        const val = form.canonical_id.trim();
        if (/^https?:\/\//i.test(val)) {
          const p = parseProductUrl(val);
          return p?.canonical || val;
        }
        return val;
      })();
      const note = (() => {
        if (parsed?.title) return parsed.title;
        if (parsed?.merchantName && parsed?.productId) return `${parsed.merchantName} ${parsed.productId}`;
        return 'Tracked item';
      })();
      const res = await fetch(`${baseUrl}/price-protection/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_user_id: externalUserId,
          canonical_id: canonical,
          target_price_cents: targetCents,
          note,
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to add');
      setForm({ canonical_id: "", target_price: "" });
      setParsed(null);
      await loadWatches();
      await loadMatches();
    } catch (e) {
      setError(e.message || 'Failed to add');
    } finally {
      setLoading(false);
    }
  };

  // Resolve via backend for accurate title/price (best-effort)
  const resolveViaBackend = async (url) => {
    setResolving(true);
    try {
      const res = await fetch(`${baseUrl}/product/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        const p = {
          merchantName: data.merchant_name,
          merchantId: data.merchant_id,
          productId: data.product_id,
          priceUsd: data.price_usd,
          title: data.title,
          canonical: data.canonical || url,
        };
        setParsed(p);
        if (p.priceUsd && !form.target_price) {
          setForm((f) => ({ ...f, target_price: String(p.priceUsd) }));
        }
      }
    } catch (e) {
      console.warn('resolveViaBackend failed', e);
    } finally {
      setResolving(false);
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
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, canonical_id: v }));
                  if (/^https?:\/\//i.test(v)) {
                    const p = parseProductUrl(v);
                    setParsed(p);
                    // Pre-fill target if empty and price found
                    if (p?.priceUsd && !form.target_price) {
                      setForm((f) => ({ ...f, target_price: String(p.priceUsd) }));
                    }
                    // Kick off backend resolve to refine title/price
                    resolveViaBackend(v);
                  } else {
                    setParsed(null);
                  }
                }}
                placeholder="e.g. asin:B0... or product URL"
                className="bg-white"
              />
              {parsed && (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex flex-wrap gap-3">
                    <span><span className="text-gray-500">Merchant:</span> <span className="font-medium">{parsed.merchantName || 'Unknown'}</span></span>
                    {parsed.title && (
                      <span><span className="text-gray-500">Name:</span> <span className="font-medium">{parsed.title}</span></span>
                    )}
                    <span><span className="text-gray-500">Product:</span> <span className="font-medium">{parsed.productId || '—'}</span></span>
                    <span><span className="text-gray-500">Price:</span> <span className="font-medium">{parsed.priceUsd != null ? `$${Number(parsed.priceUsd).toFixed(2)}` : (resolving ? 'Loading…' : '—')}</span></span>
                    <span><span className="text-gray-500">Canonical:</span> <span className="font-mono">{parsed.canonical}</span></span>
                  </div>
                </div>
              )}
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

          {/* Quick Add: default product links */}
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Quick add examples:</p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: 'Amazon – Apple AirPods Pro',
                  url: 'https://www.amazon.com/Apple-AirPods-Pro-2nd-Gen/dp/B0D1R4ZQ9S/',
                },
                {
                  label: 'Amazon – Kindle Paperwhite',
                  url: 'https://www.amazon.com/All-new-Kindle-Paperwhite-adjustable-Waterproof/dp/B08KTZ8249/',
                },
                {
                  label: 'Target – Apple Watch SE',
                  url: 'https://www.target.com/p/apple-watch-se-gps-40mm-aluminum-case-with-sport-band/-/A-84680346',
                },
                {
                  label: 'Walmart – Nintendo Switch',
                  url: 'https://www.walmart.com/ip/Nintendo-Switch-with-Neon-Blue-and-Neon-Red-Joy-Con/554499512',
                },
              ].map((q) => (
                <button
                  key={q.url}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, canonical_id: q.url, target_price: '' }));
                    const p = parseProductUrl(q.url);
                    setParsed(p);
                    resolveViaBackend(q.url);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-700"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100">
          <h2 className="text-xl font-light text-gray-900 mb-4">Your watches</h2>
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  // Demo canonical IDs
                  const demos = [
                    { canonical: '44:B0BHTZCXZL', note: 'Noise Cancelling Headphones' },
                    { canonical: '12:84680346', note: 'Apple Watch SE' },
                    { canonical: '45:554499512', note: 'Nintendo Switch' },
                  ];
                  const existing = new Set((watches || []).map((w) => w.canonical_id));
                  for (const d of demos) {
                    if (existing.has(d.canonical)) continue;
                    await fetch(`${baseUrl}/price-protection/watch`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        external_user_id: externalUserId,
                        canonical_id: d.canonical,
                        note: d.note,
                      })
                    });
                  }
                  await loadWatches();
                  // Seed history for this user
                  await fetch(`${baseUrl}/price-history/seed_demo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points: 48, days: 365, jitter_pct: 0.35, external_user_id: externalUserId })
                  });
                  setHistory({});
                } catch {}
              }}
              className="inline-flex items-center gap-2"
            >
              Add demo watches
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await fetch(`${baseUrl}/price-history/seed_demo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points: 40, days: 365, jitter_pct: 0.3, external_user_id: externalUserId })
                  });
                  // refresh history after seeding
                  setHistory({});
                } catch {}
              }}
              className="inline-flex items-center gap-2"
            >
              Seed demo history
            </Button>
          </div>
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
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {watchMeta[w.id]?.title || w.note || w.canonical_id || 'Tracked item'}
                      {watchMeta[w.id]?.priceUsd != null && (
                        <span className="ml-2 text-gray-700">— ${Number(watchMeta[w.id].priceUsd).toFixed(2)}</span>
                      )}
                    </p>
                    {w.canonical_id && (
                      <p className="text-xs text-gray-400 truncate">{w.canonical_id}</p>
                    )}
                    <p className="text-xs text-gray-500">Added {new Date(w.created_at).toLocaleString()}</p>
                    <div className="mt-2 pr-4">
                      {(() => {
                        const pts = history[w.canonical_id] || [];
                        const baseline = pts.length ? Number(pts[0].price_usd) : undefined;
                        const tprice = typeof w.target_price_cents === 'number' ? w.target_price_cents / 100.0 : undefined;
                        return (
                          <PriceLineChart
                            points={pts}
                            baselinePrice={baseline}
                            targetPrice={tprice}
                          />
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-900">{w.target_price_cents != null ? `$${(w.target_price_cents/100).toFixed(2)}` : '—'}</div>
                    <Button variant="outline" onClick={() => deleteWatch(w.id)} disabled={loading} className="inline-flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Remove
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