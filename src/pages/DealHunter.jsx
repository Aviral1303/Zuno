import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Search, Filter, ShoppingBag, Link as LinkIcon, PlusCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DealHunter() {
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState("");
  const [merchants, setMerchants] = useState({ 44: true, 12: true, 45: true }); // kept for legacy; not shown in UI
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  
  const [trackLoading, setTrackLoading] = useState({});
  const [trackedKeys, setTrackedKeys] = useState(new Set());
  const useWebSearch = true;

  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

  const selectedMerchantIds = Object.entries(merchants)
    .filter(([, v]) => !!v)
    .map(([k]) => Number(k));

  // Knot linking removed from Deal Hunter (available in Knot Sync)

  const trackKeyForItem = (item) => `${item.merchant_id || 'm'}::${item.external_id || item.url || item.title}`;

  const trackPriceForItem = async (item) => {
    const key = trackKeyForItem(item);
    if (trackLoading[key]) return;
    setTrackLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const targetCents = typeof item.price_total === 'number' ? Math.round(item.price_total * 100) : undefined;
      const canonical = item.external_id ? `${item.merchant_id || 'm'}:${item.external_id}` : (item.url || item.title || 'unknown');
      const res = await fetch(`${baseUrl}/price-protection/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_user_id: 'zuno_user_123',
          canonical_id: canonical,
          target_price_cents: targetCents,
          note: item.title || 'tracked item',
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to add watch');
      setTrackedKeys((prev) => new Set(prev).add(key));
    } catch (e) {
      console.error('trackPriceForItem failed', e);
      setError(e.message || 'Failed to add watch');
    } finally {
      setTrackLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  

  

  const enrichMissingPrices = async (items) => {
    try {
      const indices = [];
      const tasks = items.map((it, idx) => {
        const hasPrice = typeof it.price_total === 'number' || typeof it.price_usd === 'number';
        const u = it.url;
        if (hasPrice || !u) return null;
        indices.push(idx);
        return fetch(`${baseUrl}/product/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u })
        })
        .then(r => r.json().catch(() => ({})))
        .then(data => ({ idx, price: data?.price_usd }))
        .catch(() => null);
      }).filter(Boolean);
      if (!tasks.length) return items;
      const resolved = await Promise.all(tasks);
      const next = [...items];
      resolved.forEach((res) => {
        if (!res || res.price == null) return;
        next[res.idx] = { ...next[res.idx], price_usd: res.price };
      });
      return next;
    } catch {
      return items;
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    setError("");
    setLoading(true);
    setResults([]);
    
    try {
      

      const budgetNum = Number(budget);
      const budgetCents = !Number.isNaN(budgetNum) && budgetNum > 0 ? Math.round(budgetNum * 100) : undefined;

      if (useWebSearch) {
        const res = await fetch(`${baseUrl}/dealhunter/rag_search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, budget_cents: budgetCents, max_results: 9, external_user_id: 'zuno_user_123' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Web search failed');
        const items = (data.items || []).map((it) => ({
          title: it.title,
          url: it.url,
          external_id: it.url,
          merchant: it.merchant_name || 'Web',
          price_total: typeof it.price_usd === 'number' ? it.price_usd : undefined,
          image: it.image,
          explanation: it.reason,
        }));
        const enriched = await enrichMissingPrices(items);
        setResults(enriched);
      } else {
        const payload = {
          query,
          merchants: selectedMerchantIds.length ? selectedMerchantIds : [44, 12, 45],
          limit: 20,
          explain: true,
          explain_top_k: 3,
          external_user_id: 'zuno_user_123'
        };
        if (budgetCents) payload.budget_cents = budgetCents;
        const res = await fetch(`${baseUrl}/dealhunter/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Search failed");
        setResults(data?.items || []);
      }
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleMerchant = (id) => {
    setMerchants((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Target className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-2">Deal Hunter</h1>
          <p className="text-base text-gray-600">Search recent products and get concise AI explanations.</p>
        </motion.div>

        {/* Search form */}
        <form
          onSubmit={handleSearch}
          className="bg-gray-50 rounded-3xl p-6 border border-gray-100 mb-8"
        >
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">What are you looking for?</label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., wireless headphones"
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Budget (USD)</label>
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder="Optional"
                className="bg-white"
              />
            </div>
            <div className="flex md:justify-end">
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 flex items-center gap-2 rounded-2xl">
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none ml-auto">
              <input type="checkbox" checked={useWebSearch} onChange={() => setUseWebSearch((v) => !v)} />
              <span>Use web search (Claude)</span>
            </label>
          </div>
        </form>

        {/* Results */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 text-red-600 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-gray-50 rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item, idx) => (
              <motion.div
                key={`${item.url || item.external_id || idx}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-gray-900 font-medium line-clamp-2">{item.title || "Untitled"}</h4>
                    <p className="text-xs text-gray-500 mt-1">{item.merchant || "Unknown merchant"}</p>
                    {item.explanation ? (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-3">{item.explanation}</p>
                    ) : null}
                  </div>
                  {item.image && (
                    <img src={item.image} alt="thumb" className="w-20 h-20 object-cover rounded-xl border border-gray-100" />
                  )}
                  <div className="text-right">
                    <div className="text-sm text-gray-900 font-semibold">
                      {typeof item.price_total === 'number'
                        ? `$${item.price_total.toFixed(2)}`
                        : (typeof item.price_usd === 'number' ? `$${item.price_usd.toFixed(2)}` : '—')}
                    </div>
                    {item.has_discount ? (
                      <span className="text-emerald-600 text-xs">Discount detected</span>
                    ) : null}
                    {trackedKeys.has(trackKeyForItem(item)) && (
                      <div className="mt-1 inline-flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tracking
                      </div>
                    )}
                  </div>
                </div>
                {item.explanation ? (
                  <p className="text-sm text-gray-700 mt-3">{item.explanation}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={item.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> View
                  </a>
                  <Button
                    onClick={() => trackPriceForItem(item)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={!!trackLoading[trackKeyForItem(item)] || trackedKeys.has(trackKeyForItem(item))}
                  >
                    {trackLoading[trackKeyForItem(item)] ? (
                      <span>Adding…</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><PlusCircle className="w-3.5 h-3.5" /> Track price</span>
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
            {!results.length && (
              <div className="text-center text-gray-500 col-span-full">
                {query || budget ? "No results yet. Try adjusting your filters." : "Search to discover recent deals."}
              </div>
            )}
          </div>
        )}

        {/* Knot linking and Amazon transaction display removed from Deal Hunter */}
      </div>
    </div>
  );
}