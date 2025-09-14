import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";

function PieChart({ data = [], size = 200 }) {
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
    return <path key={idx} d={dpath} fill={d.color} opacity={0.9} />;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs}
    </svg>
  );
}

export default function BudgetAdvisor() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [amazonTxns, setAmazonTxns] = useState([]);
  const [loadingAmazon, setLoadingAmazon] = useState(false);
  const [annual, setAnnual] = useState(false);

  // Dummy monthly spend estimates for an average U.S. household (illustrative only)
  const dummySpend = useMemo(() => ({
    target: 260,
    walmart: 320,
    costco: 380,
    doordash: 110,
    instacart: 160,
    ubereats: 95,
  }), []);

  const fetchAmazonTransactions = async () => {
    setLoadingAmazon(true);
    try {
      const params = new URLSearchParams({
        external_user_id: 'zuno_user_123',
        merchant_id: '44',
        limit: '50',
        mock: '1',
      });
      const res = await fetch(`${baseUrl}/knot/amazon/transactions?${params.toString()}`);
      const data = await res.json();
      const txns = data?.data?.transactions || data?.data?.data?.transactions || [];
      setAmazonTxns(txns);
    } catch (e) {
      setAmazonTxns([]);
    } finally {
      setLoadingAmazon(false);
    }
  };

  useEffect(() => {
    // Load Amazon by default
    fetchAmazonTransactions();
  }, []);

  const amazonTotal = useMemo(() => {
    return amazonTxns.reduce((sum, t) => {
      const s = parseFloat((t?.price?.total ?? '0').replace(/[^0-9.]/g, ''));
      return sum + (isNaN(s) ? 0 : s);
    }, 0);
  }, [amazonTxns]);

  const merchants = useMemo(() => ([
    { key: 'amazon', name: 'Amazon', value: Math.max(amazonTotal, 420), color: '#6366f1' },
    { key: 'target', name: 'Target', value: dummySpend.target, color: '#ef4444' },
    { key: 'walmart', name: 'Walmart', value: dummySpend.walmart, color: '#10b981' },
    { key: 'costco', name: 'Costco', value: dummySpend.costco, color: '#f59e0b' },
    { key: 'doordash', name: 'DoorDash', value: dummySpend.doordash, color: '#8b5cf6' },
    { key: 'instacart', name: 'Instacart', value: dummySpend.instacart, color: '#14b8a6' },
    { key: 'ubereats', name: 'UberEats', value: dummySpend.ubereats, color: '#06b6d4' },
  ]), [amazonTotal, dummySpend]);

  const scaledMerchants = useMemo(() => (
    annual ? merchants.map(m => ({ ...m, value: (m.value || 0) * 12 })) : merchants
  ), [annual, merchants]);

  // For the pie only, use more natural non-linear annual proportions
  const pieMerchants = useMemo(() => {
    if (!annual) return merchants;
    const factors = {
      amazon: 11.4,
      target: 11.0,
      walmart: 11.6,
      costco: 12.8,
      doordash: 8.6,
      instacart: 10.2,
      ubereats: 8.9,
    };
    return merchants.map(m => ({
      ...m,
      value: (m.value || 0) * (factors[m.key] ?? 12),
    }));
  }, [annual, merchants]);

  const pieGrandTotal = pieMerchants.reduce((s, m) => s + (m.value || 0), 0);
  const grandTotal = scaledMerchants.reduce((s, m) => s + (m.value || 0), 0);

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-light text-gray-900">Budget Advisor</h1>
              <p className="text-gray-600">Smart spending insights and budget optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Monthly</span>
              <Switch checked={annual} onCheckedChange={setAnnual} />
              <span>Annual</span>
            </div>
          </div>
        </motion.div>

        {/* Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-1 bg-white rounded-3xl p-6 border border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Spending distribution</h3>
            <div className="flex items-center justify-center">
              <PieChart data={pieMerchants} size={220} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {pieMerchants.map((m) => (
                <div key={m.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto font-medium">${m.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <span className="font-medium text-gray-900">Total:</span> ${annual ? pieGrandTotal.toFixed(0) : grandTotal.toFixed(0)} {annual ? '/ year' : '/ month'} (est.)
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-4">By merchant (est.)</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scaledMerchants.map((m) => (
                <div key={m.key} className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
                  <div className="text-xs text-gray-500">{m.name}</div>
                  <div className="text-2xl font-semibold text-gray-900">${m.value.toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Amazon transaction sample */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Amazon transactions (mock or live)</h3>
            <div className="text-xs text-gray-500">Loaded: {amazonTxns.length}</div>
          </div>
          {amazonTxns.length ? (
            <div className="grid gap-3">
              {amazonTxns.slice(0, 10).map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="truncate">
                    <div className="text-sm font-medium text-gray-900 truncate">{t.products?.[0]?.name || t.description || 'Amazon Purchase'}</div>
                    <div className="text-xs text-gray-500">{t.datetime ? new Date(t.datetime).toLocaleString() : ''}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{t.price?.total ? `$${parseFloat(t.price.total).toFixed(2)}` : '—'}</div>
                </div>
              ))}
              {amazonTxns.length > 10 && (
                <div className="text-xs text-gray-500">Showing {Math.min(10, amazonTxns.length)} of {amazonTxns.length}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No transactions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}