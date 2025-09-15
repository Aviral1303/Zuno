import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Target, RefreshCw, Database, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GiftPlanner() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('amazon');
  const [transactionsByMerchant, setTransactionsByMerchant] = useState({});
  const [knotInitialized, setKnotInitialized] = useState(false);
  const [knotClient, setKnotClient] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [amazonConnected, setAmazonConnected] = useState(false);
  const [error, setError] = useState("");
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

  const merchants = [
    { key: 'amazon', label: 'Amazon' },
    { key: 'walmart', label: 'Walmart' },
    { key: 'target', label: 'Target' },
    { key: 'costco', label: 'Costco' },
    { key: 'doordash', label: 'DoorDash' },
    { key: 'instacart', label: 'Instacart' },
    { key: 'ubereats', label: 'Uber Eats' },
  ];

  const generateDummyTransactions = (merchantKey) => {
    const now = Date.now();
    const names = {
      walmart: ['Grocery Order', 'Electronics Purchase', 'Household Supplies'],
      target: ['Home Essentials', 'Target Run', 'Apparel Purchase'],
      costco: ['Bulk Groceries', 'Costco Membership', 'Kirkland Essentials'],
      doordash: ['Food Delivery', 'Lunch Combo', 'Dinner Special'],
      instacart: ['Weekly Groceries', 'Produce Order', 'Pantry Restock'],
      ubereats: ['Meal Delivery', 'Late Night Snack', 'Breakfast Bundle'],
    };
    const list = names[merchantKey] || ['Order 1', 'Order 2', 'Order 3'];
    return Array.from({ length: 8 }).map((_, i) => ({
      description: list[i % list.length],
      datetime: new Date(now - i * 86400000).toISOString(),
      price: { total: (Math.random() * 60 + 10).toFixed(2) },
      products: [{ name: list[i % list.length] }],
    }));
  };

  const syncAmazon = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        external_user_id: 'zuno_user_123',
        merchant_id: '44',
        limit: '50',
        mock: '0'
      });
      if (sessionId) params.set('session_id', sessionId);
      const res = await fetch(`${baseUrl}/knot/amazon/transactions?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.ok && data.data) {
        const list = data.data.transactions || data.data.data?.transactions || [];
        setTransactionsByMerchant(prev => ({ ...prev, amazon: list }));
        setAmazonConnected(true);
      } else {
        setTransactionsByMerchant(prev => ({ ...prev, amazon: [] }));
      }
    } catch (e) {
      setTransactionsByMerchant(prev => ({ ...prev, amazon: [] }));
    } finally {
      setLoading(false);
    }
  };

  const syncDummy = (key) => {
    console.log("Syncing dummy transactions for", key);
    const list = generateDummyTransactions(key);
    setTransactionsByMerchant(prev => ({ ...prev, [key]: list }));
  };

  // Load Knot Web SDK and bootstrap client
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
        setError(err.message || 'Knot SDK error');
      }
    };

    bootstrap();
  }, [knotClient]);

  const ensureKnotClient = async () => {
    if (knotClient) return knotClient;
    console.log("Loading Knot Web SDK");
    const loadSdk = () => new Promise((resolve, reject) => {
      if (window.KnotapiJS) return resolve();
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/knotapi-js@next';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Knot Web SDK'));
      document.head.appendChild(script);
      console.log('Knot Web SDK loaded');
    });
    await loadSdk();
    const KnotapiJS = window.KnotapiJS && window.KnotapiJS.default;
    if (!KnotapiJS) throw new Error('Knot SDK not available');
    const client = new KnotapiJS();
    setKnotClient(client);
    return client;
  };

  const openKnot = async () => {
    try {
      console.log("Opening Knot");
      setLoading(true);
      console.log("Window", window);
      // Use provided session id only; do not create session or fetch transactions
      const search = typeof window !== 'undefined' ? window.location.search : '';
      console.log("Search", search);
      const qs = new URLSearchParams(search);
      console.log("QS", qs);
      const providedSid = "b8b91632-32ec-47ff-adc1-533b6bca19a5";
      console.log("Provided Session ID", providedSid);
      if (!providedSid) {
        throw new Error('Missing session id. Provide ?session_id=... in URL or set it in state.');
      }
      setSessionId(providedSid);
      console.log("Session ID", providedSid);
      const client = await ensureKnotClient();

      const cid = 'dda0778d-9486-47f8-bd80-6f2512f9bcdb';

      client.open({
        sessionId: "b8b91632-32ec-47ff-adc1-533b6bca19a5",
        clientId: cid,
        environment: 'development',
        product: 'transaction_link',
        merchantIds: [44], // Amazon
        entryPoint: 'knot_sync',  
        onSuccess: () => {
          setAmazonConnected(true);
        },
        onError: (_product, _errorCode, message) => {
          setError(message || 'Knot error');
        },
        onEvent: (_product, event) => {
          if (event === 'AUTHENTICATED') setAmazonConnected(true);
        },
        onExit: () => {}
      });
    } catch (err) {
      setError(err.message || 'Failed to open Knot');
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
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <PlugZap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-4">Knot Sync</h1>
          <p className="text-xl text-gray-600">Connect and sync data using Knot API utilities</p>
        </motion.div>
        
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {merchants.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveTab(m.key)}
                className={`px-4 py-2 rounded-2xl text-sm font-medium border ${activeTab === m.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="mb-6">
            {activeTab === 'amazon' ? (
              <Button onClick={openKnot} disabled={loading} className="rounded-2xl">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Get Amazon Transactions (Knot)
              </Button>
            ) : (
              <Button onClick={() => syncDummy(activeTab)} disabled={loading} className="rounded-2xl">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sync {merchants.find(m => m.key === activeTab)?.label}
              </Button>
            )}
          </div>

          {/* Transactions List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{merchants.find(m => m.key === activeTab)?.label} Transactions</h3>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
              {(transactionsByMerchant[activeTab] || []).length > 0 ? (
                <div className="grid gap-3">
                  {(transactionsByMerchant[activeTab] || []).slice(0, 12).map((transaction, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {transaction.products?.[0]?.name || transaction.description || 'Purchase'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {transaction.datetime ? new Date(transaction.datetime).toLocaleDateString() : 'Unknown Date'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {transaction.price?.total ? `$${parseFloat(transaction.price.total).toFixed(2)}` : '—'}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm">No transactions yet. Click Sync to fetch.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}