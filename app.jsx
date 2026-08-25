import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Wallet,
  Landmark, Coins, Calculator, ChevronDown, ChevronUp, Stamp
} from "lucide-react";

const PAPER = "#F1EAD8";
const INK = "#1B3A4B";
const INK_SOFT = "#4A6B78";
const GREEN = "#2F6F4E";
const RED = "#B23A3A";
const GOLD = "#9C7A2E";
const RULE = "#CBBFA0";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n, d = 0) =>
  (n ?? 0).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n) => `${n >= 0 ? "+" : ""}${fmt(n, 2)}%`;

const STORAGE_KEY = "etf-passbook-data-v2";

export default function App() {
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loaded, setLoaded] = useState(false);

  // ---- 讀取本地 localStorage (適配手機 App WebView) ----
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setHoldings(data.holdings || []);
        setTransactions(data.transactions || []);
        setDividends(data.dividends || []);
      }
    } catch (e) {
      console.error("載入失敗", e);
    }
    setLoaded(true);
  }, []);

  // ---- 儲存至 localStorage ----
  const persist = useCallback((h, t, d) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ holdings: h, transactions: t, dividends: d })
      );
    } catch (e) {
      console.error("儲存失敗", e);
    }
  }, []);

  useEffect(() => {
    if (loaded) persist(holdings, transactions, dividends);
  }, [holdings, transactions, dividends, loaded, persist]);

  // ---- 統計計算（移動加權平均成本法） ----
  const stats = useMemo(() => {
    const byHolding = {};
    for (const h of holdings) {
      const txs = transactions
        .filter((t) => t.holdingId === h.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      let shares = 0, cost = 0, realized = 0;
      for (const t of txs) {
        if (t.type === "buy") {
          shares += t.shares;
          cost += t.shares * t.price + (t.fee || 0);
        } else {
          const avg = shares > 0 ? cost / shares : 0;
          const soldCost = avg * t.shares;
          realized += t.shares * t.price - (t.fee || 0) - soldCost;
          shares -= t.shares;
          cost -= soldCost;
        }
      }
      const avgCost = shares > 0 ? cost / shares : 0;
      const price = h.currentPrice || 0;
      const marketValue = shares * price;
      const unrealized = marketValue - cost;
      const divTotal = dividends
        .filter((d) => d.holdingId === h.id)
        .reduce((s, d) => s + d.total, 0);
      byHolding[h.id] = {
        shares, cost, avgCost, marketValue, unrealized,
        unrealizedPct: cost > 0 ? (unrealized / cost) * 100 : 0,
        realized, divTotal,
        yieldOnCost: cost > 0 ? (divTotal / cost) * 100 : 0,
      };
    }
    const totals = Object.values(byHolding).reduce(
      (acc, s) => ({
        cost: acc.cost + s.cost,
        marketValue: acc.marketValue + s.marketValue,
        unrealized: acc.unrealized + s.unrealized,
        realized: acc.realized + s.realized,
        divTotal: acc.divTotal + s.divTotal,
      }),
      { cost: 0, marketValue: 0, unrealized: 0, realized: 0, divTotal: 0 }
    );
    totals.unrealizedPct = totals.cost > 0 ? (totals.unrealized / totals.cost) * 100 : 0;
    totals.totalReturnPct =
      totals.cost > 0 ? ((totals.unrealized + totals.divTotal) / totals.cost) * 100 : 0;
    return { byHolding, totals };
  }, [holdings, transactions, dividends]);

  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: INK }} className="font-body">
      <FontImport />
      <div className="max-w-5xl mx-auto px-4 py-6 pb-20">
        <Cover totals={stats.totals} holdingCount={holdings.length} />
        <TabBar tab={tab} setTab={setTab} />
        {tab === "overview" && <Overview holdings={holdings} stats={stats} />}
        {tab === "holdings" && (
          <HoldingsTab
            holdings={holdings} setHoldings={setHoldings}
            transactions={transactions} setTransactions={setTransactions}
            stats={stats}
          />
        )}
        {tab === "dividends" && (
          <DividendsTab
            holdings={holdings} dividends={dividends} setDividends={setDividends}
            stats={stats}
          />
        )}
        {tab === "projection" && <ProjectionTab holdings={holdings} stats={stats} />}
      </div>
    </div>
  );
}

function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
      .font-body { font-family: 'Noto Sans TC', sans-serif; }
      .font-mono { font-family: 'IBM Plex Mono', monospace; }
      .tabular { font-variant-numeric: tabular-nums; }
      .ledger-row { border-bottom: 1px dashed ${RULE}; }
      .ledger-row:last-child { border-bottom: none; }
      input, select {
        background: #FBF8F0; border: 1px solid ${RULE}; color: ${INK};
        border-radius: 4px; padding: 8px 10px; font-size: 15px;
      }
      input:focus, select:focus { outline: 2px solid ${INK_SOFT}44; }
      button { cursor: pointer; }
      ::-webkit-scrollbar { height: 6px; width: 6px; }
    `}</style>
  );
}

function Cover({ totals, holdingCount }) {
  const gain = totals.unrealized >= 0;
  return (
    <div
      className="relative rounded-xl mb-6 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${INK} 0%, #22475c 100%)`,
        boxShadow: "0 6px 0 rgba(0,0,0,0.08), 0 10px 24px rgba(27,58,75,0.25)",
      }}
    >
      <div className="p-6 md:p-8 text-[#F1EAD8]">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] opacity-70">GITHUB APP · PASSBOOK</div>
            <div className="font-mono text-2xl md:text-3xl font-bold mt-1">ETF 存股隨身帳戶</div>
          </div>
          <Stamp size={40} className="opacity-80" style={{ color: RED }} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Metric label="總市值" value={`$${fmt(totals.marketValue)}`} big />
          <Metric label="總投入成本" value={`$${fmt(totals.cost)}`} />
          <Metric
            label="未實現損益"
            value={`${totals.unrealized >= 0 ? "+" : ""}$${fmt(totals.unrealized)}`}
            sub={fmtPct(totals.unrealizedPct)}
            color={gain ? "#7FD9A6" : "#F0A0A0"}
          />
          <Metric
            label="累積股息"
            value={`$${fmt(totals.divTotal)}`}
            sub={`總報酬 ${fmtPct(totals.totalReturnPct)}`}
            color="#E8D48A"
          />
        </div>

        <div className="font-mono text-[11px] mt-6 opacity-60 flex justify-between">
          <span>持有 {holdingCount} 檔 ETF</span>
          <span>手機離線版已同步</span>
        </div>
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-3 flex flex-col justify-evenly py-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full mx-auto" style={{ background: PAPER }} />
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, big, color }) {
  return (
    <div>
      <div className="font-mono text-[11px] opacity-70">{label}</div>
      <div
        className={`font-mono tabular font-bold ${big ? "text-xl md:text-2xl" : "text-base md:text-lg"}`}
        style={{ color: color || "#F1EAD8" }}
      >
        {value}
      </div>
      {sub && <div className="font-mono text-xs opacity-80" style={{ color }}>{sub}</div>}
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "overview", label: "總覽", icon: Landmark },
    { id: "holdings", label: "持股", icon: Wallet },
    { id: "dividends", label: "股息", icon: Coins },
    { id: "projection", label: "試算", icon: Calculator },
  ];
  return (
    <div className="flex gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: RULE }}>
      {tabs.map((t) => {
        const active = tab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium relative -mb-px whitespace-nowrap"
            style={{
              color: active ? INK : INK_SOFT,
              borderBottom: active ? `2px solid ${INK}` : "2px solid transparent",
            }}
          >
            <Icon size={16} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Overview({ holdings, stats }) {
  const pieData = holdings
    .map((h) => ({
      name: h.code,
      value: stats.byHolding[h.id]?.marketValue || 0,
    }))
    .filter((d) => d.value > 0);
  const barData = holdings.map((h) => ({
    name: h.code,
    成本: Math.round(stats.byHolding[h.id]?.cost || 0),
    市值: Math.round(stats.byHolding[h.id]?.marketValue || 0),
  }));
  const COLORS = [INK, GREEN, GOLD, RED, INK_SOFT, "#6B8F9E", "#8A6A2E", "#5C8A6E"];

  if (holdings.length === 0) {
    return <EmptyState text="還沒有任何 ETF，先到「持股」新增一檔開始記錄。" />;
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Card title="資產配置占比">
        {pieData.length === 0 ? (
          <EmptyState text="尚無市值資料" small />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `$${fmt(v)}`} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="成本 vs 市值對比">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData}>
            <CartesianGrid stroke={RULE} strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: INK }} />
            <YAxis tick={{ fontSize: 11, fill: INK }} />
            <Tooltip formatter={(v) => `$${fmt(v)}`} />
            <Legend />
            <Bar dataKey="成本" fill={INK_SOFT} radius={[3, 3, 0, 0]} />
            <Bar dataKey="市值" fill={GREEN} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="持股明細列表" full>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono tabular">
            <thead>
              <tr className="text-left" style={{ color: INK_SOFT }}>
                <th className="py-2 pr-3">代號</th>
                <th className="py-2 pr-3">股數</th>
                <th className="py-2 pr-3">均價</th>
                <th className="py-2 pr-3">現價</th>
                <th className="py-2 pr-3">市值</th>
                <th className="py-2 pr-3">損益</th>
                <th className="py-2 pr-3">報酬率</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const s = stats.byHolding[h.id];
                const up = s.unrealized >= 0;
                return (
                  <tr key={h.id} className="ledger-row">
                    <td className="py-2.5 pr-3 font-semibold">{h.code}<div className="font-body text-xs opacity-60">{h.name}</div></td>
                    <td className="py-2.5 pr-3">{fmt(s.shares)}</td>
                    <td className="py-2.5 pr-3">{fmt(s.avgCost, 2)}</td>
                    <td className="py-2.5 pr-3">{fmt(h.currentPrice, 2)}</td>
                    <td className="py-2.5 pr-3">${fmt(s.marketValue)}</td>
                    <td className="py-2.5 pr-3" style={{ color: up ? GREEN : RED }}>
                      {up ? "+" : ""}${fmt(s.unrealized)}
                    </td>
                    <td className="py-2.5 pr-3" style={{ color: up ? GREEN : RED }}>{fmtPct(s.unrealizedPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HoldingsTab({ holdings, setHoldings, transactions, setTransactions, stats }) {
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ code: "", name: "" });

  const addHolding = () => {
    if (!form.code.trim()) return;
    setHoldings([...holdings, { id: uid(), code: form.code.trim().toUpperCase(), name: form.name.trim(), currentPrice: 0 }]);
    setForm({ code: "", name: "" });
  };
  const removeHolding = (id) => {
    setHoldings(holdings.filter((h) => h.id !== id));
    setTransactions(transactions.filter((t) => t.holdingId !== id));
  };
  const updatePrice = (id, price) => {
    setHoldings(holdings.map((h) => (h.id === id ? { ...h, currentPrice: price } : h)));
  };

  return (
    <div className="space-y-4">
      <Card title="新增自選 ETF">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
          <Field label="代號 (如 0050)">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="0050" className="w-full sm:w-32" />
          </Field>
          <Field label="名稱 (選填)">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="元大台灣50" className="w-full sm:w-48" />
          </Field>
          <button onClick={addHolding} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded font-medium text-sm mt-2 sm:mt-0"
            style={{ background: INK, color: PAPER }}>
            <Plus size={16} /> 新增 ETF
          </button>
        </div>
      </Card>

      {holdings.length === 0 && <EmptyState text="尚未新增任何 ETF" />}

      {holdings.map((h) => (
        <HoldingCard
          key={h.id}
          holding={h}
          stat={stats.byHolding[h.id]}
          expanded={expanded === h.id}
          onToggle={() => setExpanded(expanded === h.id ? null : h.id)}
          onRemove={() => removeHolding(h.id)}
          onPriceChange={(p) => updatePrice(h.id, p)}
          transactions={transactions.filter((t) => t.holdingId === h.id).sort((a, b) => b.date.localeCompare(a.date))}
          addTransaction={(tx) => setTransactions([...transactions, { id: uid(), holdingId: h.id, ...tx }])}
          removeTransaction={(id) => setTransactions(transactions.filter((t) => t.id !== id))}
        />
      ))}
    </div>
  );
}

function HoldingCard({ holding, stat, expanded, onToggle, onRemove, onPriceChange, transactions, addTransaction, removeTransaction }) {
  const [priceInput, setPriceInput] = useState(holding.currentPrice || "");
  const [txForm, setTxForm] = useState({ type: "buy", date: todayStr(), shares: "", price: "", fee: "" });
  const up = (stat?.unrealized || 0) >= 0;

  const submitTx = () => {
    const shares = parseFloat(txForm.shares), price = parseFloat(txForm.price);
    if (!shares || !price) return;
    addTransaction({
      type: txForm.type, date: txForm.date, shares,
      price, fee: parseFloat(txForm.fee) || 0,
    });
    setTxForm({ ...txForm, shares: "", price: "", fee: "" });
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${RULE}`, background: "#FBF8F0" }}>
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="font-mono font-bold text-lg" style={{ color: INK }}>{holding.code}</div>
          <div className="text-sm opacity-70">{holding.name}</div>
        </div>
        <div className="flex items-center gap-3 font-mono tabular text-sm">
          <span>股數 {fmt(stat?.shares || 0)}</span>
          <span style={{ color: up ? GREEN : RED }} className="font-semibold flex items-center gap-0.5">
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {fmtPct(stat?.unrealizedPct || 0)}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 pt-0 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-end gap-3 pt-3" style={{ borderTop: `1px dashed ${RULE}` }}>
            <Field label="更新現價">
              <div className="flex gap-1.5">
                <input type="number" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className="w-28" />
                <button onClick={() => onPriceChange(parseFloat(priceInput) || 0)}
                  className="px-3 py-2 rounded text-sm" style={{ background: INK_SOFT, color: PAPER }}>
                  <RefreshCw size={14} />
                </button>
              </div>
            </Field>
            <button onClick={onRemove} className="ml-auto text-xs px-3 py-2 rounded flex items-center gap-1 mt-2"
              style={{ color: RED, border: `1px solid ${RED}55` }}>
              <Trash2 size={13} /> 刪除此 ETF
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm font-mono tabular p-3 rounded-lg" style={{ background: PAPER }}>
            <div>總成本: <span className="font-bold">${fmt(stat?.cost || 0)}</span></div>
            <div>目前市值: <span className="font-bold">${fmt(stat?.marketValue || 0)}</span></div>
            <div>已實現損益: <span className="font-bold" style={{ color: (stat?.realized || 0) >= 0 ? GREEN : RED }}>${fmt(stat?.realized || 0)}</span></div>
            <div>累積股息: <span className="font-bold" style={{ color: GOLD }}>${fmt(stat?.divTotal || 0)}</span></div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">快速新增交易紀錄</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
              <Field label="類型">
                <select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} className="w-full">
                  <option value="buy">買進</option>
                  <option value="sell">賣出</option>
                </select>
              </Field>
              <Field label="日期">
                <input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} className="w-full" />
              </Field>
              <Field label="股數">
                <input type="number" value={txForm.shares} onChange={(e) => setTxForm({ ...txForm, shares: e.target.value })} className="w-full" />
              </Field>
              <Field label="成交價">
                <input type="number" step="0.01" value={txForm.price} onChange={(e) => setTxForm({ ...txForm, price: e.target.value })} className="w-full" />
              </Field>
              <Field label="手續費">
                <input type="number" value={txForm.fee} onChange={(e) => setTxForm({ ...txForm, fee: e.target.value })} className="w-full" />
              </Field>
              <button onClick={submitTx} className="flex items-center justify-center gap-1 px-3 py-2.5 rounded text-sm font-medium"
                style={{ background: INK, color: PAPER }}>
                <Plus size={15} /> 記錄交易
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">歷史交易</div>
            {transactions.length === 0 ? (
              <div className="text-xs opacity-50">尚無交易紀錄</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono tabular">
                  <thead>
                    <tr className="text-left opacity-60">
                      <th className="py-1.5 pr-2">日期</th><th className="py-1.5 pr-2">類型</th>
                      <th className="py-1.5 pr-2">股數</th><th className="py-1.5 pr-2">價格</th>
                      <th className="py-1.5 pr-2">手續費</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="ledger-row">
                        <td className="py-2 pr-2">{t.date}</td>
                        <td className="py-2 pr-2 font-semibold" style={{ color: t.type === "buy" ? GREEN : RED }}>
                          {t.type === "buy" ? "買進" : "賣出"}
                        </td>
                        <td className="py-2 pr-2">{fmt(t.shares)}</td>
                        <td className="py-2 pr-2">{fmt(t.price, 2)}</td>
                        <td className="py-2 pr-2">{fmt(t.fee)}</td>
                        <td><button onClick={() => removeTransaction(t.id)}><Trash2 size={13} style={{ color: RED }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DividendsTab({ holdings, dividends, setDividends, stats }) {
  const [form, setForm] = useState({ holdingId: "", date: todayStr(), perShare: "", shares: "" });
  const total = (parseFloat(form.perShare) || 0) * (parseFloat(form.shares) || 0);

  const submit = () => {
    if (!form.holdingId || !form.perShare || !form.shares) return;
    setDividends([...dividends, {
      id: uid(), holdingId: form.holdingId, date: form.date,
      perShare: parseFloat(form.perShare), shares: parseFloat(form.shares), total,
    }]);
    setForm({ ...form, perShare: "", shares: "" });
  };

  const sorted = [...dividends].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <Card title="登記股息收益">
        {holdings.length === 0 ? (
          <EmptyState text="請先在「持股」新增至少一檔 ETF" small />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <Field label="選擇 ETF">
              <select value={form.holdingId} onChange={(e) => setForm({ ...form, holdingId: e.target.value })} className="w-full">
                <option value="">請選擇</option>
                {holdings.map((h) => <option key={h.id} value={h.id}>{h.code} - {h.name}</option>)}
              </select>
            </Field>
            <Field label="發放日期">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full" />
            </Field>
            <Field label="每股配息 ($)">
              <input type="number" step="0.001" value={form.perShare} onChange={(e) => setForm({ ...form, perShare: e.target.value })} className="w-full" />
            </Field>
            <Field label="領息股數">
              <input type="number" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} className="w-full" />
            </Field>
            <div className="sm:col-span-2 flex items-center justify-between pt-2">
              <div className="text-sm font-mono font-bold">總股息: <span style={{ color: GOLD }}>${fmt(total, 1)}</span></div>
              <button onClick={submit} className="flex items-center gap-1.5 px-4 py-2.5 rounded text-sm font-medium"
                style={{ background: INK, color: PAPER }}>
                <Plus size={16} /> 登記股息
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="各 ETF 累積股息">
        <div className="grid grid-cols-2 gap-3">
          {holdings.map((h) => (
            <div key={h.id} className="p-3 rounded-lg" style={{ background: "#FBF8F0", border: `1px solid ${RULE}` }}>
              <div className="font-mono font-semibold text-sm">{h.code}</div>
              <div className="font-mono tabular text-lg font-bold" style={{ color: GOLD }}>
                ${fmt(stats.byHolding[h.id]?.divTotal || 0)}
              </div>
              <div className="text-xs opacity-60">殖利率: {fmt(stats.byHolding[h.id]?.yieldOnCost || 0, 2)}%</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="股息明細" full>
        {sorted.length === 0 ? <EmptyState text="尚無股息紀錄" small /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono tabular">
              <thead>
                <tr className="text-left opacity-60">
                  <th className="py-2 pr-3">日期</th><th className="py-2 pr-3">ETF</th>
                  <th className="py-2 pr-3">每股</th><th className="py-2 pr-3">股數</th>
                  <th className="py-2 pr-3">合計</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.id} className="ledger-row">
                    <td className="py-2.5 pr-3">{d.date}</td>
                    <td className="py-2.5 pr-3">{holdings.find((h) => h.id === d.holdingId)?.code || "-"}</td>
                    <td className="py-2.5 pr-3">{fmt(d.perShare, 3)}</td>
                    <td className="py-2.5 pr-3">{fmt(d.shares)}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: GOLD }}>${fmt(d.total, 1)}</td>
                    <td><button onClick={() => setDividends(dividends.filter((x) => x.id !== d.id))}>
                      <Trash2 size={13} style={{ color: RED }} />
                    </button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProjectionTab({ holdings, stats }) {
  const [p, setP] = useState({
    start: Math.round(stats.totals.marketValue) || 0,
    monthly: 10000,
    annualReturn: 6,
    dividendYield: 4,
    reinvest: true,
    years: 20,
  });

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setP({ ...p, [k]: v });
  };

  const data = useMemo(() => {
    const monthlyReturn = Math.pow(1 + Number(p.annualReturn) / 100, 1 / 12) - 1;
    let value = Number(p.start) || 0;
    let invested = value;
    let cumDividend = 0;
    const rows = [{ year: 0, 投入本金: Math.round(invested), 預估資產: Math.round(value), 累積股息: 0 }];
    for (let y = 1; y <= Number(p.years); y++) {
      for (let m = 0; m < 12; m++) {
        value = value * (1 + monthlyReturn) + Number(p.monthly);
        invested += Number(p.monthly);
      }
      const div = value * (Number(p.dividendYield) / 100);
      cumDividend += div;
      if (p.reinvest) value += div;
      rows.push({
        year: y,
        投入本金: Math.round(invested),
        預估資產: Math.round(value),
        累積股息: Math.round(cumDividend),
      });
    }
    return rows;
  }, [p]);

  const final = data[data.length - 1];

  return (
    <div className="space-y-5">
      <Card title="複利與存股試算設定">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="起始資產 ($)">
            <input type="number" value={p.start} onChange={set("start")} className="w-full" />
          </Field>
          <Field label="每月定期投入 ($)">
            <input type="number" value={p.monthly} onChange={set("monthly")} className="w-full" />
          </Field>
          <Field label="投資年限 (年)">
            <input type="number" value={p.years} onChange={set("years")} className="w-full" />
          </Field>
          <Field label="預期年化價格報酬率 (%)">
            <input type="number" step="0.1" value={p.annualReturn} onChange={set("annualReturn")} className="w-full" />
          </Field>
          <Field label="預期年化股息殖利率 (%)">
            <input type="number" step="0.1" value={p.dividendYield} onChange={set("dividendYield")} className="w-full" />
          </Field>
          <Field label="配息機制">
            <label className="flex items-center gap-2 text-sm pt-2">
              <input type="checkbox" checked={p.reinvest} onChange={set("reinvest")} className="w-4 h-4" />
              股息再投入（複利效果）
            </label>
          </Field>
        </div>
      </Card>

      <Card title="試算結果預測">
        <div className="grid grid-cols-2 gap-3 mb-4 font-mono tabular text-sm">
          <Metric2 label="累積投入本金" value={`$${fmt(final.投入本金)}`} />
          <Metric2 label="預估總資產" value={`$${fmt(final.預估資產)}`} color={GREEN} />
          <Metric2 label="累積領取股息" value={`$${fmt(final.累積股息)}`} color={GOLD} />
          <Metric2 label="預估總資產翻倍率" value={`${(final.預估資產 / (final.投入本金 || 1)).toFixed(2)} 倍`} color={INK} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid stroke={RULE} strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: INK }} />
            <YAxis tick={{ fontSize: 11, fill: INK }} tickFormatter={(v) => `${Math.round(v / 10000)}萬`} />
            <Tooltip formatter={(v) => `$${fmt(v)}`} labelFormatter={(l) => `第 ${l} 年`} />
            <Legend />
            <Line type="monotone" dataKey="投入本金" stroke={INK_SOFT} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="預估資產" stroke={GREEN} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="累積股息" stroke={GOLD} strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Metric2({ label, value, color }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: "#FBF8F0", border: `1px solid ${RULE}` }}>
      <div className="text-[11px] opacity-60">{label}</div>
      <div className="font-bold text-base md:text-lg" style={{ color: color || INK }}>{value}</div>
    </div>
  );
}

function Card({ title, children, full }) {
  return (
    <div className={`rounded-xl p-4 md:p-5 ${full ? "md:col-span-2" : ""}`}
      style={{ background: "#FBF8F0", border: `1px solid ${RULE}` }}>
      <div className="text-sm font-bold mb-3.5 flex items-center gap-2" style={{ color: INK }}>
        <span style={{ width: 4, height: 16, background: GOLD, display: "inline-block", borderRadius: 2 }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex-1">
      <div className="text-xs mb-1.5 opacity-70 font-medium">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({ text, small }) {
  return (
    <div className={`text-center opacity-50 ${small ? "py-6 text-xs" : "py-12 text-sm"}`}>
      {text}
    </div>
  );
}
