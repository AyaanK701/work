/*
HoursTrackerApp.jsx — UK version with monthly summary and time-to-afford estimates.
*/

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const STORAGE_KEYS = {
  entries: "ht_entries_v1",
  wage: "ht_wage_v1",
  savePct: "ht_savepct_v1",
  wishlist: "ht_wishlist_v1",
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function formatCurrency(n) {
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 });
}

export default function HoursTrackerApp() {
  const [entries, setEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.entries)) || [];
    } catch (e) {
      return [];
    }
  });
  const [wage, setWage] = useState(() => Number(localStorage.getItem(STORAGE_KEYS.wage)) || 15);
  const [savePct, setSavePct] = useState(() => Number(localStorage.getItem(STORAGE_KEYS.savePct)) || 20);
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist)) || [];
    } catch (e) {
      return [];
    }
  });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(8);
  const [note, setNote] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState(0);

  useEffect(() => localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries)), [entries]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.wage, String(wage)), [wage]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.savePct, String(savePct)), [savePct]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify(wishlist)), [wishlist]);

  const totalHours = useMemo(() => entries.reduce((s, e) => s + Number(e.hours || 0), 0), [entries]);
  const totalEarnings = useMemo(() => totalHours * Number(wage || 0), [totalHours, wage]);
  const recommendedSavings = useMemo(() => totalEarnings * (Number(savePct || 0) / 100), [totalEarnings, savePct]);
  const spendable = useMemo(() => totalEarnings - recommendedSavings, [totalEarnings, recommendedSavings]);

  const chartData = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const m = e.date.slice(0, 7);
      map[m] = (map[m] || 0) + Number(e.hours || 0) * Number(wage || 0);
    }
    return Object.keys(map).sort().map((k) => ({ month: k, earnings: Math.round(map[k] * 100) / 100 }));
  }, [entries, wage]);

  const affordableItems = useMemo(() => wishlist.filter((w) => w.price <= spendable), [wishlist, spendable]);
  const canAffordAll = useMemo(() => wishlist.reduce((s, i) => s + i.price, 0) <= spendable, [wishlist, spendable]);

  const weeklyAverage = useMemo(() => {
    if (entries.length === 0) return 0;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const first = new Date(sorted[0].date);
    const last = new Date(sorted[sorted.length - 1].date);
    const weeks = Math.max(1, Math.ceil((last - first) / (1000 * 60 * 60 * 24 * 7)));
    return totalEarnings / weeks;
  }, [entries, totalEarnings]);

  const wishlistWithTime = useMemo(() => wishlist.map(item => {
    const needed = item.price - spendable;
    const weeksNeeded = needed > 0 && weeklyAverage > 0 ? Math.ceil(needed / weeklyAverage) : 0;
    return { ...item, weeksNeeded };
  }), [wishlist, spendable, weeklyAverage]);

  function addEntry(e) {
    e.preventDefault();
    const newEntry = { id: uid(), date, hours: Number(hours), note };
    setEntries((s) => [...s, newEntry].sort((a, b) => a.date.localeCompare(b.date)));
    setNote("");
    setHours(8);
  }

  function removeEntry(id) {
    setEntries((s) => s.filter((e) => e.id !== id));
  }

  function addWishlist(e) {
    e.preventDefault();
    const w = { id: uid(), name: itemName || "Untitled", price: Number(itemPrice) };
    setWishlist((s) => [...s, w]);
    setItemName("");
    setItemPrice(0);
  }
  function removeWishlist(id) {
    setWishlist((s) => s.filter((w) => w.id !== id));
  }

  function exportCSV() {
    const rows = ["date,hours,note"].concat(entries.map((r) => `${r.date},${r.hours},"${(r.note || "").replace(/"/g, '""')}"`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hours_entries_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function clearAll() {
    if (!confirm("Clear all data? This cannot be undone.")) return;
    setEntries([]);
    setWishlist([]);
    setWage(15);
    setSavePct(20);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Hours & Money Tracker (UK)</h1>
          <div className="text-sm text-gray-600">Track hours, earnings, savings & wishlist goals</div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="md:col-span-1 bg-white p-4 rounded-2xl shadow">
            <h2 className="font-semibold mb-2">Add work entry</h2>
            <form onSubmit={addEntry} className="space-y-2">
              <label className="block text-xs">Date</label>
              <input value={date} onChange={(ev) => setDate(ev.target.value)} type="date" className="w-full p-2 rounded border" />
              <label className="block text-xs">Hours</label>
              <input value={hours} onChange={(ev) => setHours(ev.target.value)} type="number" min="0" step="0.25" className="w-full p-2 rounded border" />
              <label className="block text-xs">Note</label>
              <input value={note} onChange={(ev) => setNote(ev.target.value)} type="text" className="w-full p-2 rounded border" />
              <div className="flex gap-2">
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">Add</button>
                <button type="button" onClick={exportCSV} className="mt-2 px-4 py-2 border rounded">Export CSV</button>
              </div>
            </form>
            <hr className="my-4" />
            <h2 className="font-semibold mb-2">Settings</h2>
            <label className="block text-xs">Hourly wage</label>
            <input value={wage} onChange={(ev) => setWage(Number(ev.target.value))} type="number" min="0" step="0.01" className="w-full p-2 rounded border" />
            <label className="block text-xs mt-2">Save percentage</label>
            <input value={savePct} onChange={(ev) => setSavePct(Number(ev.target.value))} type="number" min="0" max="100" className="w-full p-2 rounded border" />
            <hr className="my-4" />
            <h2 className="font-semibold mb-2">Wishlist</h2>
            <form onSubmit={addWishlist} className="space-y-2">
              <input placeholder="Item name" value={itemName} onChange={(ev) => setItemName(ev.target.value)} className="w-full p-2 rounded border" />
              <input value={itemPrice} onChange={(ev) => setItemPrice(ev.target.value)} type="number" min="0" step="0.01" className="w-full p-2 rounded border" placeholder="Price" />
              <button className="px-3 py-2 bg-green-600 text-white rounded">Add</button>
            </form>
            <ul className="mt-3 space-y-1 text-sm">
              {wishlistWithTime.map(w => (
                <li key={w.id} className="flex justify-between">
                  <span>{w.name} — {formatCurrency(w.price)}</span>
                  <span className="text-gray-500">{w.weeksNeeded > 0 ? `${w.weeksNeeded} wks` : "now"}</span>
                  <button onClick={() => removeWishlist(w.id)} className="text-red-500 ml-2">X</button>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <button onClick={clearAll} className="text-xs text-red-600">Clear all data</button>
            </div>
          </section>

          <section className="md:col-span-1 bg-white p-4 rounded-2xl shadow">
            <h2 className="font-semibold">Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg"><div>Total hours</div><div>{totalHours}</div></div>
              <div className="p-3 bg-gray-50 rounded-lg"><div>Total earnings</div><div>{formatCurrency(totalEarnings)}</div></div>
              <div className="p-3 bg-gray-50 rounded-lg"><div>Savings ({savePct}%)</div><div>{formatCurrency(recommendedSavings)}</div></div>
              <div className="p-3 bg-gray-50 rounded-lg"><div>Spendable</div><div>{formatCurrency(spendable)}</div></div>
            </div>
            <h3 className="mt-4 font-semibold">Weekly average pay</h3>
            <div>{formatCurrency(weeklyAverage)}</div>
          </section>

          <section className="md:col-span-1 bg-white p-4 rounded-2xl shadow">
            <h2 className="font-semibold mb-2">Monthly Summary</h2>
            {chartData.length === 0 ? <div>No data</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="earnings" />
                </BarChart>
              </ResponsiveContainer>
            )}
            <h2 className="mt-4 font-semibold">Entries</h2>
            <div className="max-h-56 overflow-auto text-sm">
              {entries.length === 0 ? "No entries" : (
                <ul className="space-y-2">
                  {entries.map(e => (
                    <li key={e.id} className="flex justify-between bg-gray-50 p-2 rounded">
                      <div>{e.date} — {e.hours} hrs</div>
                      <div>{formatCurrency(e.hours * wage)}</div>
                      <button onClick={() => removeEntry(e.id)} className="text-red-500 text-xs">Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
