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

  // UI states for adding entries
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(8);
  const [note, setNote] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState(0);

  // New state: show/hide the data table
  const [showDataTable, setShowDataTable] = useState(false);

  // Sorting state for data table
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "asc" });

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Month selection state
  const months = Array.from(new Set(entries.map(e => e.date.slice(0, 7)))).sort();
  const [selectedMonth, setSelectedMonth] = useState(months.length ? months[months.length - 1] : new Date().toISOString().slice(0, 7));

  useEffect(() => localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries)), [entries]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.wage, String(wage)), [wage]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.savePct, String(savePct)), [savePct]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify(wishlist)), [wishlist]);
  useEffect(() => localStorage.setItem("ht_dark_mode", JSON.stringify(darkMode)), [darkMode]);
  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  // Calculate totals
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

  // --- Sort entries for table ---
  const sortedEntries = useMemo(() => {
    let sortableEntries = [...entries];
    if (sortConfig !== null) {
      sortableEntries.sort((a, b) => {
        let v1 = a[sortConfig.key];
        let v2 = b[sortConfig.key];
        // If sorting by hours, convert to number
        if (sortConfig.key === "hours") {
          v1 = Number(v1);
          v2 = Number(v2);
        }
        // If sorting by note, fallback to string compare
        if (v1 < v2) return sortConfig.direction === "asc" ? -1 : 1;
        if (v1 > v2) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableEntries;
  }, [entries, sortConfig]);

  // Handlers
  function addEntry(e) {
    e.preventDefault();
    if (!date) {
      alert("Please select a date");
      return;
    }
    if (isNaN(hours) || hours < 0) {
      alert("Please enter a valid positive number of hours");
      return;
    }
    const newEntry = { id: uid(), date, hours: Number(hours), note };
    setEntries((s) => [...s, newEntry].sort((a, b) => a.date.localeCompare(b.date)));
    setNote("");
    setHours(8);
  }

  function removeEntry(id) {
    setEntries((s) => s.filter((e) => e.id !== id));
  }

  // Toggle sort for column in table
  function requestSort(key) {
    let direction = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  }

  // Inline editing for Hours and Note in table
  function updateEntryField(id, field, value) {
    setEntries((s) => s.map(e => {
      if (e.id !== id) return e;
      if (field === "hours") {
        const n = Number(value);
        if (isNaN(n) || n < 0) return e; // ignore invalid hours
        return { ...e, hours: n };
      }
      if (field === "note") {
        return { ...e, note: value };
      }
      return e;
    }));
  }

  function addWishlist(e) {
    e.preventDefault();
    if (!itemName.trim()) {
      alert("Please enter item name");
      return;
    }
    if (isNaN(itemPrice) || itemPrice < 0) {
      alert("Please enter a valid price");
      return;
    }
    const w = { id: uid(), name: itemName.trim(), price: Number(itemPrice) };
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyEarnings = entries
    .filter(e => e.date.slice(0, 7) === selectedMonth)
    .reduce((sum, e) => sum + Number(e.hours || 0) * Number(wage || 0), 0);

  return (
    <div className={`min-h-screen p-6 ${darkMode ? "dark-mode" : ""}`}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Ayaan's Wage Tracker</h1>
          <div className="text-sm text-gray-600"> Ayaan Khan React App</div>
        </header>

        <main className="main-grid">
          <div className="card">
            {/* Add work entry, settings, wishlist (move all code from your first <section> here) */}
            <section className="md:col-span-1 bg-white p-4 rounded-2xl shadow">
              <h2 className="font-semibold mb-2">Add work entry</h2>
              <form onSubmit={addEntry} className="space-y-2">
                <label className="block text-xs">Date</label>
                <input
                  value={date}
                  onChange={(ev) => setDate(ev.target.value)}
                  type="date"
                  className="w-full p-2 rounded border"
                />
                <label className="block text-xs">Hours</label>
                <input
                  value={hours}
                  onChange={(ev) => setHours(ev.target.value)}
                  type="number"
                  min="0"
                  step="0.25"
                  className="w-full p-2 rounded border"
                />
                <label className="block text-xs">Note</label>
                <input
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  type="text"
                  className="w-full p-2 rounded border"
                />
                <div className="button-group">
                  <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">Add</button>
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="mt-2 px-4 py-2 border rounded"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDataTable(!showDataTable)}
                    className="mt-2 px-4 py-2 border rounded"
                  >
                    {showDataTable ? "Close Data Table" : "Show Data Table"}
                  </button>
                </div>
              </form>

              {showDataTable && (
                <div className="mt-4 max-h-[300px] overflow-auto border rounded shadow">
                  <table className="min-w-full table-auto text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <SortableHeader
                          label="Date"
                          sortKey="date"
                          sortConfig={sortConfig}
                          requestSort={requestSort}
                        />
                        <SortableHeader
                          label="Hours"
                          sortKey="hours"
                          sortConfig={sortConfig}
                          requestSort={requestSort}
                        />
                        <th className="p-2 border">Note</th>
                        <th className="p-2 border">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-2 text-center text-gray-500">
                            No entries yet
                          </td>
                        </tr>
                      )}
                      {sortedEntries.map(({ id, date, hours, note }) => (
                        <tr key={id} className="hover:bg-gray-50">
                          <td className="p-2 border text-center">{date}</td>
                          <td className="p-2 border text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={hours}
                              onChange={(e) => updateEntryField(id, "hours", e.target.value)}
                              className="w-16 text-center border rounded px-1 py-0"
                            />
                          </td>
                          <td className="p-2 border">
                            <input
                              type="text"
                              value={note || ""}
                              onChange={(e) => updateEntryField(id, "note", e.target.value)}
                              className="w-full border rounded px-1 py-0"
                            />
                          </td>
                          <td className="p-2 border text-center">
                            <button
                              onClick={() => removeEntry(id)}
                              className="text-red-600 font-bold hover:text-red-800"
                              title="Delete entry"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <hr className="my-4" />
              <h2 className="font-semibold mb-2">Settings</h2>
              <label className="block text-xs">Hourly wage</label>
              <input
                value={wage}
                onChange={(ev) => setWage(Number(ev.target.value))}
                type="number"
                min="0"
                step="0.01"
                className="w-full p-2 rounded border"
              />
              <label className="block text-xs mt-2">Save percentage</label>
              <input
                value={savePct}
                onChange={(ev) => setSavePct(Number(ev.target.value))}
                type="number"
                min="0"
                max="100"
                className="w-full p-2 rounded border"
              />
              <hr className="my-4" />
              <h2 className="font-semibold mb-2">Wishlist</h2>
              <form onSubmit={addWishlist} className="space-y-2">
                <input
                  placeholder="Item name"
                  value={itemName}
                  onChange={(ev) => setItemName(ev.target.value)}
                  className="wishlist-item-input"
                />
                <input
                  value={itemPrice}
                  onChange={(ev) => setItemPrice(ev.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="wishlist-price-input"
                  placeholder="Price"
                />
                <button className="px-3 py-2 bg-green-600 text-white rounded">Add</button>
              </form>
              <ul className="mt-3 space-y-1 text-sm">
                {wishlistWithTime.map(w => (
                  <li key={w.id} className="flex items-center justify-between">
                    <span>
                      {w.name} — {formatCurrency(w.price)}
                      {w.weeksNeeded > 0
                        ? <span className="text-gray-500"> — {w.weeksNeeded} wks</span>
                        : <span className="text-green-600"> — now</span>
                      }
                    </span>
                    <button
                      onClick={() => removeWishlist(w.id)}
                      className="ml-2 text-red-600 font-bold"
                    >
                      ×
                    </button>
                    <div style={{ marginTop: "0.25rem", height: "6px", background: "#e5e7eb", borderRadius: "3px" }}>
                      <div
                        style={{
                          width: `${Math.min(100, (spendable / w.price) * 100)}%`,
                          height: "100%",
                          background: "#3b82f6",
                          borderRadius: "3px"
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={clearAll}
                className="mt-4 w-full text-xs text-red-700 underline"
              >
                Clear all data
              </button>
            </section>
          </div>
          <div className="card">
            {/* Summary and chart (move all code from your second <section> here) */}
            <section className="md:col-span-2 bg-white p-4 rounded-2xl shadow">
              <h2 className="font-semibold mb-2">Summary</h2>
              <div className="grid grid-cols-2 gap-4 text-center text-sm mb-4">
                <div className="p-2 border rounded">
                  <div className="font-bold">{totalHours.toFixed(2)}</div>
                  <div>-Total hours worked</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="font-bold">{formatCurrency(totalEarnings)}</div>
                  <div>-Total earnings</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="font-bold">{formatCurrency(recommendedSavings)}</div>
                  <div>-Recommended savings</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="font-bold">{formatCurrency(spendable)}</div>
                  <div>-Spendable money</div>
                </div>
              </div>

              <h3 className="font-semibold mb-2">Earnings per month</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="earnings" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>
          <div className="card">
            <h2 className="font-semibold mb-2">Monthly Summary</h2>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ marginBottom: "1rem", padding: "0.5rem", borderRadius: "0.375rem" }}
            >
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="p-4 border rounded mb-4 text-center">
              <div className="text-sm text-gray-500 mb-1">Earnings this month</div>
              <div style={{ fontWeight: "bold", fontSize: "2rem", color: "#2563eb" }}>
                {formatCurrency(monthlyEarnings)}
              </div>
            </div>
            <h3 className="font-semibold mb-2">Entries</h3>
            <ul className="entries-list">
              {entries
                .filter(e => e.date.slice(0, 7) === selectedMonth)
                .map(e => (
                  <li key={e.id} className="entries-list-item">
                    <span>
                      {e.date} — {e.hours} hrs
                    </span>
                    <span>{formatCurrency(e.hours * wage)}</span>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="delete"
                      style={{
                        color: "#dc2626",
                        marginLeft: "0.5rem",
                        fontWeight: "bold",
                        border: "none",
                        background: "none",
                        cursor: "pointer"
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              {entries.filter(e => e.date.slice(0, 7) === selectedMonth).length === 0 && (
                <li className="entries-list-item text-gray-400">No entries this month</li>
              )}
            </ul>
          </div>
        </main>
        <button
          onClick={() => setDarkMode(d => !d)}
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            background: darkMode ? "#222" : "#f3f4f6",
            color: darkMode ? "#fff" : "#222",
            border: "none",
            cursor: "pointer",
            zIndex: 10
          }}
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
    </div>
  );
}

function SortableHeader({ label, sortKey, sortConfig, requestSort }) {
  let arrow = sortConfig.direction === "asc" ? "▲" : "▼";
  if (sortConfig.key === sortKey) {
    return (
      <th className="p-2 border">
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs">{arrow}</span>
          <span>{label}</span>
        </div>
      </th>
    );
  }
  return (
    <th
      onClick={() => requestSort(sortKey)}
      className="p-2 border cursor-pointer select-none user-select-none"
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        <span className="text-xs opacity-50">▼</span>
      </div>
    </th>
  );
}