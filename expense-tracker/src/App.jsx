import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Papa from "papaparse";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1R9Kc_23orwPMJV5z0ao98uVt_tAsUZxQKAc54FQMT7U/export?format=csv&gid=0";

  //统一处理大小写
  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }
  //把第一个字母大写
  function capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function isYes(value) {
    const v = normalizeText(value);
    return v === "yes" || v === "y" || v === "true" || v === "1";
  }
  
  //category分类
  function getCategoryFromRow(row) {
    if (isYes(row["repair"])) return "repair";
    if (isYes(row["supply"])) return "supply";
    if (isYes(row["cleaning"])) return "cleaning";
    if (isYes(row["maintenace"]) || isYes(row["maintenance"])) return "maintenance";
    if (isYes(row["lawncare"])) return "lawncare";
    if (isYes(row["loan"])) return "loan";
    return "";
  }
//check重复选择category
  function getCheckedCategories(row) {
    const checked = [];
    if (isYes(row["repair"])) checked.push("repair");
    if (isYes(row["supply"])) checked.push("supply");
    if (isYes(row["cleaning"])) checked.push("cleaning");
    if (isYes(row["maintenace"]) || isYes(row["maintenance"])) checked.push("maintenance");
    if (isYes(row["lawncare"])) checked.push("lawncare");
    if (isYes(row["loan"])) checked.push("loan");
    return checked;
  }

  function parseAmount(value) {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonth(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function matchesDateRange(date, rangeValue) {
  if (rangeValue === "all") return true;
  if (!date) return false;

  const now = new Date();
  const cutoff = new Date();

  if (rangeValue === "1m") cutoff.setMonth(now.getMonth() - 1);
  if (rangeValue === "3m") cutoff.setMonth(now.getMonth() - 3);
  if (rangeValue === "6m") cutoff.setMonth(now.getMonth() - 6);
  if (rangeValue === "12m") cutoff.setMonth(now.getMonth() - 12);

  return date >= cutoff;
}

function matchesCostBucket(amount, bucket) {
  if (bucket === "any") return true;
  if (bucket === "lte50") return amount <= 50;
  if (bucket === "lte100") return amount <= 100;
  if (bucket === "lte200") return amount <= 200;
  if (bucket === "gt200") return amount > 200;
  return true;
}

function normalizeRowKeys(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[String(key).trim().toLowerCase()] = value;
  });
  return normalized;
}






//组件
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [propertyFilter, setPropertyFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [onlineOrder, setOnlineOrder] = useState("all");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [costBucket, setCostBucket] = useState("any");
  const [keyword, setKeyword] = useState("");
  const [mobileProperty, setMobileProperty] = useState("luna");
  const CATEGORY_COLORS = {
    repair: "#56aea3",
    supply: "#feaac2",
    cleaning: "#bc87bf",
    maintenance: "#91b6eb",
    lawncare: "	#f36273",
    loan: "#8fdbd8",
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) {
          throw new Error("Failed to fetch Google Sheet");
        }

        const text = await res.text();

        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            const parsed = (result.data || []).map((row, index) => {
              const r = normalizeRowKeys(row);
              const parsedDate = parseDate(r["date"]);
              const parsedCost = parseAmount(r["cost"]);

              const checkedCategories = getCheckedCategories(r);
              const category = checkedCategories[0] || "";
              const hasMultipleCategories = checkedCategories.length > 1;

              return {
                id: index + 1,
                date: parsedDate,
                dateLabel: formatDate(parsedDate),
                cost: parsedCost,
                buyer: normalizeText(r["buyer"]),
                content: String(r["content"] || "").trim(),
                onlineOrder: normalizeText(r["online order"]),
                carrier: String(r["carrier"] || "").trim(),
                property: normalizeText(r["property"]),
                category,
                raw: r,
                searchText: Object.values(r).join(" ").toLowerCase(),
              };
            });

            setData(parsed);
            setLoading(false);
          },
          error: (err) => {
            setError(err.message || "CSV parse failed");
            setLoading(false);
          },
        });
      } catch (err) {
        setError(err.message || "Unable to load data");
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const propertyOk =
        propertyFilter === "all" ? true : item.property === propertyFilter;

      const dateOk = matchesDateRange(item.date, dateRange);

      const onlineOk =
        onlineOrder === "all" ? true : item.onlineOrder === onlineOrder;

      const buyerOk =
        buyerFilter === "all" ? true : item.buyer === buyerFilter;

      const costOk = matchesCostBucket(item.cost, costBucket);

      const keywordOk =
        keyword.trim() === ""
          ? true
          : item.searchText.includes(keyword.trim().toLowerCase()) ||
            item.dateLabel.includes(keyword.trim());

      return propertyOk && dateOk && onlineOk && buyerOk && costOk && keywordOk;
    });
  }, [data, propertyFilter, dateRange, onlineOrder, buyerFilter, costBucket, keyword]);

  const totalAll = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.cost, 0);
  }, [filteredData]);

  const totalLuna = useMemo(() => {
    return filteredData
      .filter((item) => item.property === "luna")
      .reduce((sum, item) => sum + item.cost, 0);
  }, [filteredData]);

  const totalJefferson = useMemo(() => {
    return filteredData
      .filter((item) => item.property === "jefferson")
      .reduce((sum, item) => sum + item.cost, 0);
  }, [filteredData]);

  const totalsByCategory = useMemo(() => {
    const totals = {
      repair: 0,
      supply: 0,
      cleaning: 0,
      maintenance: 0,
      lawncare: 0,
      loan: 0,
    };
  
    filteredData.forEach((item) => {
      if (item.category) {
        totals[item.category] += item.cost;
      }
    });
  
    return totals;
  }, [filteredData]);


//制图，barchart 两个bars
  const chartData = useMemo(() => {
    const grouped = {};
  
    filteredData.forEach((item) => {
      if (!item.date || item.date.getFullYear() !== 2026) return;
  
      const monthKey = formatMonth(item.date);
  
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          month: monthKey,
  
          luna_repair: 0,
          luna_supply: 0,
          luna_cleaning: 0,
          luna_maintenance: 0,
          luna_lawncare: 0,
          luna_loan: 0,
  
          jefferson_repair: 0,
          jefferson_supply: 0,
          jefferson_cleaning: 0,
          jefferson_maintenance: 0,
          jefferson_lawncare: 0,
          jefferson_loan: 0,
        };
      }
  
      if (item.property && item.category) {
        const key = `${item.property}_${item.category}`;
        if (grouped[monthKey][key] !== undefined) {
          grouped[monthKey][key] += item.cost;
        }
      }
    });
  
    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData]);


  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  function CustomLegend({ payload }) {
    if (!payload) return null;
  
    // 去重
    const unique = [];
    const seen = new Set();
  
    payload.forEach((item) => {
      if (!seen.has(item.value)) {
        seen.add(item.value);
        unique.push(item);
      }
    });
  
    return (
      <div className="flex flex-wrap gap-4 text-sm">
        {unique.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* 颜色方块保留 */}
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            {/* 文字强制黑色 */}
            <span className="text-slate-600 font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }

  //手机端legend
  function MobileLegend({ payload }) {
    if (!payload) return null;
  
    const unique = [];
    const seen = new Set();
  
    payload.forEach((item) => {
      const raw = item.value || "";
      const label = raw.includes("_") ? raw.split("_")[1] : raw;
  
      if (!seen.has(label)) {
        seen.add(label);
        unique.push({
          ...item,
          cleanLabel: capitalize(label),
        });
      }
    });
  
    return (
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {unique.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.cleanLabel}</span>
          </div>
        ))}
      </div>
    );
  }

  function CustomTooltip({ active, payload, label, chartData }) {
    if (!active || !payload || payload.length === 0) return null;
  
    const activeEntry = payload[0];
    if (!activeEntry || typeof activeEntry.dataKey !== "string") return null;
  
    const propertyKey = activeEntry.dataKey.startsWith("luna_")
      ? "luna"
      : "jefferson";
    const propertyLabel = propertyKey === "luna" ? "Luna" : "Jefferson";
  
    const month = activeEntry?.payload?.month || label;
    if (!month) return null;
  
    const monthRow = chartData.find((item) => item.month === month);
    if (!monthRow) return null;
  
    const categoryKeys = [
      "repair",
      "supply",
      "cleaning",
      "maintenance",
      "lawncare",
      "loan",
    ];
  
    const items = categoryKeys
      .map((category) => {
        const value = Number(monthRow[`${propertyKey}_${category}`] || 0);
        return {
          category,
          value,
          color: CATEGORY_COLORS[category],
        };
      })
      .filter((item) => item.value > 0);
  
    if (items.length === 0) return null;
  
    const total = items.reduce((sum, item) => sum + item.value, 0);
  
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="mb-1 text-sm font-semibold text-slate-800">{month}</div>
        <div className="mb-2 text-xs text-slate-500">{propertyLabel}</div>
  
        <div className="space-y-1 text-sm">
          {items.map((item) => (
            <div
              key={item.category}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="capitalize text-slate-700">
                  {item.category}
                </span>
              </span>
              <span className="font-medium text-slate-900">
                ${item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
  
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-slate-900">
            ${total.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
  // function CustomTooltip({ active, payload, label, hoveredProperty }) {
  //   if (!active || !label || !hoveredProperty) return null;
  
  //   const property = hoveredProperty === "luna" ? "Luna" : "Jefferson";
  
  //   const items = (payload || [])
  //     .filter((entry) => {
  //       if (!entry || !entry.dataKey) return false;
  //       return (
  //         entry.dataKey.startsWith(`${hoveredProperty}_`) &&
  //         Number(entry.value) > 0
  //       );
  //     })
  //     .map((entry) => ({
  //       ...entry,
  //       category: entry.dataKey.split("_")[1],
  //     }));
  
  //   if (items.length === 0) return null;
  
  //   const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  
  //   return (
  //     <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
  //       <div className="mb-1 text-sm font-semibold text-slate-800">{label}</div>
  //       <div className="mb-2 text-xs text-slate-500">{property}</div>
  
  //       <div className="space-y-1 text-sm">
  //         {items.map((entry, index) => (
  //           <div key={index} className="flex items-center justify-between gap-4">
  //             <span className="flex items-center gap-2">
  //               <span
  //                 className="inline-block h-2.5 w-2.5 rounded-full"
  //                 style={{ backgroundColor: entry.color }}
  //               />
  //               <span className="capitalize text-slate-700">
  //                 {entry.category}
  //               </span>
  //             </span>
  //             <span className="font-medium text-slate-900">
  //               ${Number(entry.value).toLocaleString()}
  //             </span>
  //           </div>
  //         ))}
  //       </div>
  
  //       <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between text-sm">
  //         <span className="text-slate-500">Total</span>
  //         <span className="font-semibold text-slate-900">
  //           ${total.toLocaleString()}
  //         </span>
  //       </div>
  //     </div>
  //   );
  // }

  function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
    useEffect(() => {
      function handleResize() {
        setIsMobile(window.innerWidth < 768);
      }
  
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  
    return isMobile;
  }
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-750 p-8">
      <h1 className="text-4xl font-semibold text-slate-750 tracking-tight mb-3">Expense Tracker</h1>
      <p className="text-lg text-slate-500 mb-6">2026 - 2027</p>
      {loading && <p>Loading...</p>}
      {error && <p className="mb-4 text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          {!isMobile && <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-slate-500">All Properties Total</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(totalAll)}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-slate-500">Luna Total</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(totalLuna)}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-slate-500">Jefferson Total</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(totalJefferson)}</p>
            </div>
          </div>}
          {isMobile && (<div className="mb-6 grid gap-4 ">
            <div className="rounded-lg bg-white p-5 shadow">
              <p className="text-sm text-slate-500">All Properties Total</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(totalAll)}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-slate-500">Luna Total</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(totalLuna)}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-slate-500">Jefferson Total</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(totalJefferson)}</p>
            </div>
          </div>)}

          <div className="mb-6 rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold text-slate-750">
              Monthly Spending by Property (2026)
            </h2>
            {isMobile && (
                  <div className="mb-4 flex gap-2">
                    <button
                      onClick={() => setMobileProperty("luna")}
                      className={`px-3 py-1 rounded-full text-sm ${
                        mobileProperty === "luna"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      Luna
                    </button>
                    <button
                      onClick={() => setMobileProperty("jefferson")}
                      className={`px-3 py-1 rounded-full text-sm ${
                        mobileProperty === "jefferson"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      Jefferson
                    </button>
                  </div>
                )}

            {!isMobile ? (<div className="min-w-0 overflow-hidden rounded-xl no-tap-highlight">
              <ResponsiveContainer width="100%" aspect={2.2} height={600}>
                 <BarChart
                  width="100%" 
                  data={chartData}
                  barGap={8}
                  margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    shared={false}
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    content={<CustomTooltip chartData={chartData} />}
                  />
                  <Legend content={<CustomLegend />} />

                  <Bar dataKey="luna_repair" name="Repair" stackId="luna" fill={CATEGORY_COLORS.repair} />
                  <Bar dataKey="luna_supply" name="Supply" stackId="luna" fill={CATEGORY_COLORS.supply}/>
                  <Bar dataKey="luna_cleaning" name="Cleaning" stackId="luna" fill={CATEGORY_COLORS.cleaning} />
                  <Bar dataKey="luna_maintenance" name="Maintenance" stackId="luna" fill={CATEGORY_COLORS.maintenance} />
                  <Bar dataKey="luna_lawncare" name="Lawncare" stackId="luna" fill={CATEGORY_COLORS.lawncare} />
                  <Bar dataKey="luna_loan" name="Loan" stackId="luna" fill={CATEGORY_COLORS.loan} />

                  <Bar dataKey="jefferson_repair" name="Repair" stackId="jefferson" legendType="none" fill={CATEGORY_COLORS.repair} />
                  <Bar dataKey="jefferson_supply" name="Supply" stackId="jefferson" legendType="none" fill={CATEGORY_COLORS.supply} />
                  <Bar dataKey="jefferson_cleaning" name="Cleaning" stackId="jefferson" legendType="none" fill={CATEGORY_COLORS.cleaning} />
                  <Bar dataKey="jefferson_maintenance" name="Maintenance" stackId="jefferson" legendType="none" fill={CATEGORY_COLORS.maintenance} />
                  <Bar dataKey="jefferson_lawncare" name="Lawncare" stackId="jefferson" legendType="none" fill={CATEGORY_COLORS.lawncare} />
                  <Bar dataKey="jefferson_loan" name="Loan" stackId="jefferson" legendType="none" fill={CATEGORY_COLORS.loan} />
                </BarChart>
                </ResponsiveContainer>
                </div>)
                : (
              <div className="min-w-0 overflow-hidden rounded-xl no-tap-highlight" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart width="100%" 
                  data={chartData}
                  barGap={8}
                  margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                    {console.log(chartData)}
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                    shared={false}
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    content={<CustomTooltip chartData={chartData} />}
                  />
                  <Legend content={<MobileLegend />} />

                    <Bar
                      dataKey={`${mobileProperty}_repair`}
                      stackId="a"
                      fill={CATEGORY_COLORS.repair}
                    />
                    <Bar
                      dataKey={`${mobileProperty}_supply`}
                      stackId="a"
                      fill={CATEGORY_COLORS.supply}
                    />
                    <Bar
                      dataKey={`${mobileProperty}_cleaning`}
                      stackId="a"
                      fill={CATEGORY_COLORS.cleaning}
                    />
                    <Bar
                      dataKey={`${mobileProperty}_maintenance`}
                      stackId="a"
                      fill={CATEGORY_COLORS.maintenance}
                    />
                    <Bar
                      dataKey={`${mobileProperty}_lawncare`}
                      stackId="a"
                      fill={CATEGORY_COLORS.lawncare}
                    />
                    <Bar
                      dataKey={`${mobileProperty}_loan`}
                      stackId="a"
                      fill={CATEGORY_COLORS.loan}
                    />
                  </BarChart>
              </ResponsiveContainer>
            </div>)}
          </div>

          <div className="mb-6 rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Filters</h2>

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Property</label>
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="w-full rounded-lg border p-2 text-slate-500"
                >
                  <option value="all">All</option>
                  {["luna", "jefferson"].map(p => (
                  <option key={p} value={p}>{capitalize(p)}</option>
                ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Time</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full rounded-lg border p-2 text-slate-500"
                >
                  <option value="all">All time</option>
                  <option value="1m">Within 1 month</option>
                  <option value="3m">Within 3 months</option>
                  <option value="6m">Within 6 months</option>
                  <option value="12m">Within 12 months</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Online Order</label>
                <select
                  value={onlineOrder}
                  onChange={(e) => setOnlineOrder(e.target.value)}
                  className="w-full rounded-lg border p-2 text-slate-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Buyer</label>
                <select
                  value={buyerFilter}
                  onChange={(e) => setBuyerFilter(e.target.value)}
                  className="w-full rounded-lg border p-2 text-slate-500"
                >
                  <option value="all">All</option>
                  <option value="maggie">Maggie</option>
                  <option value="henry">Henry</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Cost</label>
                <select
                  value={costBucket}
                  onChange={(e) => setCostBucket(e.target.value)}
                  className="w-full rounded-lg border p-2 text-slate-500"
                >
                  <option value="any">Any</option>
                  <option value="lte50">$50 or less</option>
                  <option value="lte100">$100 or less</option>
                  <option value="lte200">$200 or less</option>
                  <option value="gt200">Above $200</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Keyword Search</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="content, date, carrier..."
                  className="w-full rounded-lg border p-2 text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">
              Records ({filteredData.length})
            </h2>

            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Content</th>
                    <th className="px-4 py-3">Online Order</th>
                    <th className="px-4 py-3">Carrier</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-3 text-slate-550">{item.dateLabel || "-"}</td>
                      <td className="px-4 py-3 text-slate-550">{capitalize(item.property)}</td>
                      <td className="px-4 py-3 text-slate-550">{capitalize(item.buyer)}</td>
                      <td className="px-4 py-3 text-slate-550">{item.content || "-"}</td>
                      <td className="px-4 py-3 text-slate-550">{capitalize(item.onlineOrder)}</td>
                      <td className="px-4 py-3 text-slate-550">{item.carrier || "-"}</td>
                      <td className="px-4 py-3 text-slate-550">{formatCurrency(item.cost)}</td>
                      <td className="px-4 py-3 text-slate-550">{capitalize(item.category) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}