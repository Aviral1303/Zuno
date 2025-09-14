// Simple analytics helpers for spending patterns

export function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function isInCurrentMonth(dateLike) {
  try {
    const d = new Date(dateLike);
    const { start, end } = getCurrentMonthBounds();
    return d >= start && d <= end;
  } catch {
    return false;
  }
}

export function summarizeTransactions(transactions = []) {
  const monthTxns = (transactions || []).filter(t => isInCurrentMonth(t.datetime || t.ts));

  const totalSpentMonth = monthTxns.reduce((sum, t) => {
    const amt = parseFloat((t.price && (t.price.total || t.price.amount)) || 0);
    return sum + (isFinite(amt) ? amt : 0);
  }, 0);

  const perMerchant = {};
  for (const t of monthTxns) {
    const name = (t.merchant && t.merchant.name) || 'Unknown';
    const amt = parseFloat((t.price && (t.price.total || t.price.amount)) || 0);
    if (!perMerchant[name]) perMerchant[name] = 0;
    perMerchant[name] += isFinite(amt) ? amt : 0;
  }

  const topMerchant = Object.entries(perMerchant)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

  const recent = [...(transactions || [])]
    .sort((a, b) => new Date(b.datetime || b.ts) - new Date(a.datetime || a.ts))
    .slice(0, 10);

  return {
    totalSpentMonth,
    perMerchant,
    topMerchant,
    recent,
  };
}

// Persist a snapshot from Budget/Spending tracker so Dashboard/Spendometer can mirror it
export function saveBudgetSnapshot(snapshot) {
  try {
    if (!snapshot) return;
    localStorage.setItem('zuno_budget_snapshot', JSON.stringify(snapshot));
  } catch {}
}

export function loadBudgetSnapshot() {
  try {
    const raw = localStorage.getItem('zuno_budget_snapshot');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getDummyTransactions() {
  const now = new Date();
  const mk = ({ daysAgo, idx, price, merchantId, merchantName, title, pid }) => ({
    datetime: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    description: `${merchantName} Purchase`,
    merchant: { id: merchantId, name: merchantName },
    price: { total: price.toFixed(2) },
    products: [
      {
        external_id: pid,
        name: title,
        quantity: 1,
        price: { total: price.toFixed(2) },
        url: 'https://www.amazon.com/dp/B000000000'
      }
    ]
  });
  const items = [
    // First entry with realistic product name
    mk({ daysAgo: 7, idx: 0, price: 20.99, merchantId: 44, merchantName: 'Amazon', title: 'Wireless Bluetooth Earbuds', pid: 'ASIN001' }),
    // Replace the rest with realistic-looking products
    mk({ daysAgo: 12, idx: 1, price: 21.99, merchantId: 44, merchantName: 'Amazon', title: 'USB-C Fast Charging Cable (6ft)', pid: 'ASIN002' }),
    mk({ daysAgo: 17, idx: 2, price: 22.99, merchantId: 44, merchantName: 'Amazon', title: 'Logitech Wireless Mouse M185', pid: 'ASIN003' }),
    mk({ daysAgo: 22, idx: 3, price: 23.99, merchantId: 44, merchantName: 'Amazon', title: 'Kitchen Towels 6-Pack, Cotton', pid: 'ASIN004' }),
    mk({ daysAgo: 9, idx: 4, price: 34.49, merchantId: 12, merchantName: 'Target', title: 'Home Decor Set', pid: 'TGT12345' }),
    mk({ daysAgo: 15, idx: 5, price: 42.15, merchantId: 45, merchantName: 'Walmart', title: 'Household Supplies', pid: 'WMT98765' }),
    mk({ daysAgo: 20, idx: 6, price: 128.90, merchantId: 165, merchantName: 'Costco', title: 'Bulk Groceries', pid: 'COSTCO111' }),
    mk({ daysAgo: 11, idx: 7, price: 28.40, merchantId: 19, merchantName: 'DoorDash', title: 'Dinner Order', pid: 'DD0099' }),
    mk({ daysAgo: 13, idx: 8, price: 76.12, merchantId: 40, merchantName: 'Instacart', title: 'Weekly Groceries', pid: 'INST555' }),
    mk({ daysAgo: 16, idx: 9, price: 18.75, merchantId: 36, merchantName: 'UberEats', title: 'Lunch Order', pid: 'UBER333' }),
  ];
  // Newest first
  items.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  return items;
}


