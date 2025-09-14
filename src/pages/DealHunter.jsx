import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Search, Filter, ShoppingBag, Link as LinkIcon, Shield, PlusCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DealHunter() {
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState("");
  const [merchants, setMerchants] = useState({ 44: true, 12: true, 45: true }); // Amazon, Target, Walmart
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [knotInitialized, setKnotInitialized] = useState(false);
  const [amazonConnected, setAmazonConnected] = useState(false);
  const [knotClient, setKnotClient] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [trackLoading, setTrackLoading] = useState({});
  const [trackedKeys, setTrackedKeys] = useState(new Set());

  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

  const selectedMerchantIds = Object.entries(merchants)
    .filter(([, v]) => !!v)
    .map(([k]) => Number(k));

  // Initialize Knot Web SDK (load script only once)
  useEffect(() => {
    const loadSdk = () => new Promise((resolve, reject) => {
      if (window.KnotapiJS) return resolve();
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/knotapi-js@next';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Knot Web SDK'));
      document.head.appendChild(script);
    });

    const bootstrap = async () => {
      try {
        await loadSdk();
        setKnotInitialized(true);
        if (window.KnotapiJS && !knotClient) {
          const KnotapiJS = window.KnotapiJS.default;
          const client = new KnotapiJS();
          setKnotClient(client);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    bootstrap();
  }, [knotClient]);

  const openKnot = async () => {
    try {
      // ask backend to create a session (transaction_link)
      const res = await fetch(`${baseUrl}/knot/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'transaction_link', external_user_id: 'zuno_user_123' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create session');

      const session = data.session;
      const sid = session.id || session.session_id || session.session?.id;
      const cid = data.client_id;
      setSessionId(sid);

      if (!window.KnotapiJS) throw new Error('Knot SDK not loaded');
      const KnotapiJS = window.KnotapiJS.default;
      const client = knotClient || new KnotapiJS();

      client.open({
        sessionId: sid,
        clientId: cid,
        environment: 'development',
        product: 'transaction_link',
        merchantIds: selectedMerchantIds.length ? selectedMerchantIds : [44],
        entryPoint: 'dealhunter',
        onSuccess: (product, details) => {
          console.log('onSuccess', product, details);
          setAmazonConnected(true);
          // pro-actively sync right after success
          fetch(`${baseUrl}/knot/transactions/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sid,
              merchant_id: 44,
              external_user_id: 'zuno_user_123',
              limit: 50
            })
          }).catch(() => {});
        },
        onError: (product, errorCode, message) => {
          console.log('onError', product, errorCode, message);
          setError(message || 'Knot error');
        },
        onEvent: (product, event, merchant, merchantId, payload, taskId) => {
          console.log('onEvent', product, event, merchant, merchantId, payload, taskId);
          if (event === 'AUTHENTICATED') setAmazonConnected(true);
        },
        onExit: (product) => {
          console.log('onExit', product);
        }
      });

      if (!knotClient) setKnotClient(client);
    } catch (err) {
      console.error('Failed to open Knot:', err);
      setError(err.message);
    }
  };

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

  const authenticateAmazon = async () => {
    if (sessionId) {
      try {
        // For now, we'll simulate Amazon authentication
        // In a real implementation, this would trigger the Knot authentication flow
        setAmazonConnected(true);
        console.log('Amazon authentication simulated (backend integration needed)');
      } catch (error) {
        console.error('Amazon authentication failed:', error);
        setError('Amazon authentication failed');
      }
    }
  };

  const fetchAmazonTransactions = async () => {
    setLoadingTransactions(true);
    setError("");
    
    try {
      const params = new URLSearchParams({
        external_user_id: 'zuno_user_123',
        merchant_id: '44',
        limit: '50'
      });
      if (sessionId) params.set('session_id', sessionId);
      // Temporary: allow mock fallback during sandbox
      params.set('mock', '1');
      const response = await fetch(`${baseUrl}/knot/amazon/transactions?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('Amazon transactions response:', data);
      
      if (data.ok && data.data) {
        // Extract transactions from the response
        const transactionData = data.data;
        const transactionsList = transactionData.transactions || transactionData.data?.transactions || [];
        setTransactions(transactionsList);
        setAmazonConnected(true);
      } else {
        setError(`Failed to fetch transactions: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to fetch Amazon transactions:', error);
      setError(`Failed to fetch Amazon transactions: ${error.message}`);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    setError("");
    setLoading(true);
    setResults([]);
    
    try {
      // First, sync transactions if we have a session
      if (sessionId) {
        try {
          await fetch(`${baseUrl}/knot/transactions/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              merchant_id: 44, // Amazon
              external_user_id: 'zuno_user_123'
            })
          });
        } catch (syncError) {
          console.warn('Transaction sync failed, continuing with search:', syncError);
        }
      }

      const payload = {
        query,
        merchants: selectedMerchantIds.length ? selectedMerchantIds : [44, 12, 45],
        limit: 20,
        explain: true,
        explain_top_k: 3,
        external_user_id: 'zuno_user_123'
      };
      const budgetNum = Number(budget);
      if (!Number.isNaN(budgetNum) && budgetNum > 0) {
        payload.budget_cents = Math.round(budgetNum * 100);
      }
      
      const res = await fetch(`${baseUrl}/dealhunter/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Search failed");
      setResults(data?.items || []);
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
          <p className="text-base text-gray-600">Search recent products from linked merchants via Knot and get concise AI explanations.</p>
          
          {/* Knot Status Indicator */}
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {knotInitialized ? (
              <span className="flex items-center gap-1 text-green-600">
                <Shield className="w-4 h-4" />
                Knot API Connected
              </span>
            ) : error ? (
              <span className="flex items-center gap-1 text-red-600">
                <Shield className="w-4 h-4" />
                Knot API Error
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-500">
                <Shield className="w-4 h-4" />
                Connecting to Knot API...
              </span>
            )}
          </div>
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
            <span className="text-gray-600">Merchants:</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!merchants[44]} onChange={() => toggleMerchant(44)} /> 
              <span className="flex items-center gap-1">
                Amazon
                {amazonConnected && <Shield className="w-3 h-3 text-green-600" />}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!merchants[12]} onChange={() => toggleMerchant(12)} /> Target
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!merchants[45]} onChange={() => toggleMerchant(45)} /> Walmart
            </label>
            
            {knotInitialized && (
              <>
                <Button 
                  onClick={openKnot}
                  variant="secondary"
                  size="sm"
                  className="ml-2 text-xs"
                >
                  <LinkIcon className="w-3 h-3 mr-1" /> Link via Knot
                </Button>
                <Button 
                  onClick={fetchAmazonTransactions}
                  variant="outline"
                  size="sm"
                  className="ml-2 text-xs"
                  disabled={loadingTransactions}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {loadingTransactions ? "Loading..." : "Get Amazon Transactions"}
                </Button>
              </>
            )}
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
                key={`${item.merchant_id}-${item.external_id}-${idx}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-gray-900 font-medium line-clamp-2">{item.title || "Untitled"}</h4>
                    <p className="text-xs text-gray-500 mt-1">{item.merchant || "Unknown merchant"}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900 font-semibold">
                      {typeof item.price_total === "number" ? `$${item.price_total.toFixed(2)}` : "—"}
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

        {/* Amazon Transactions Display */}
        {transactions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-light text-gray-900 mb-4">Amazon Transaction History</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="grid gap-4">
                {transactions.slice(0, 10).map((transaction, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {transaction.products?.[0]?.name || transaction.description || "Amazon Purchase"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {transaction.datetime ? new Date(transaction.datetime).toLocaleDateString() : "Unknown Date"}
                      </p>
                      {transaction.products && transaction.products.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {transaction.products.length} item(s)
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {transaction.price?.total ? `$${parseFloat(transaction.price.total).toFixed(2)}` : "—"}
                      </div>
                      {transaction.price?.adjustments && transaction.price.adjustments.length > 0 && (
                        <div className="text-xs text-green-600">
                          {transaction.price.adjustments.filter(a => a.type === 'DISCOUNT').length} discount(s)
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              {transactions.length > 10 && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Showing first 10 of {transactions.length} transactions
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}