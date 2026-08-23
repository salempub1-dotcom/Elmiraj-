// ============================================================
// 📊 الإحصائيات — Statistics / Analytics Dashboard (admin-only)
// ============================================================
// Answers exactly 4 questions, fast, with the fewest possible queries:
//   1) كم ربحت من الطلبات المؤكدة؟          → KPI "💰 الإيرادات المؤكدة"
//   2) كم شخص زار المتجر؟                    → KPI "👥 زيارات الموقع"
//   3) كم منهم تحول إلى طلب مؤكد؟            → KPI "📈 معدل التحويل"
//   4) من أي ولايات تأتي أغلب المبيعات؟      → "🗺️ المبيعات حسب الولايات"
//
// Architecture notes (see the final delivery report for the full writeup):
//   - This whole page is lazy-loaded (React.lazy, see src/App.tsx) — its
//     code (including the ~49KB Algeria map geometry in
//     src/data/algeriaWilayaMap.ts) is a separate build chunk that never
//     ships to the storefront/landing pages.
//   - Revenue = SUM(total) of orders where normalizeOrderStatus(status)
//     === 'confirmed', regardless of the `archived` flag — a confirmed
//     order that was archived after being sent to NOEST still counts.
//     Computed client-side from `orders` (already fully loaded by
//     AdminApp — zero new order queries), exactly like every other
//     admin KPI in this project.
//   - Visits = simple aggregated "Page Views" (NOT deduplicated unique
//     "Visits" — no per-visitor identity is stored anywhere). One grouped
//     query (POST /api/analytics action=stats) per date-range change.
//   - Wilaya aggregation reuses the EXACT existing `wilayaShipping` list
//     from src/App.tsx (imported, never redefined) — never a new list.
//   - The choropleth map is a real, static, local, geographically-accurate
//     SVG (vendored from the MIT-licensed `algeria-map-ts` package — see
//     src/data/algeriaWilayaMap.ts) — no live map dependency, no network
//     calls, no Google Maps/Mapbox/Leaflet/tiles.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import * as db from '../../services/database';
import { normalizeOrderStatus, algiersDateKey, daysBetweenKeys, wilayaShipping } from '../../App';
import type { Order } from '../../App';
import { ALGERIA_MAP_VIEWBOX, wilayaShapes } from '../../data/algeriaWilayaMap';

// ── تنسيق العملة كما هو مستخدم في بقية لوحة الإدارة ─────────────────
const formatDzd = (n: number): string => `${Math.round(n).toLocaleString()} دج`;

// ── مفاتيح تواريخ (YYYY-MM-DD بتوقيت الجزائر) — دوال محلية صغيرة، بنفس
// أسلوب algiersDateKey/daysBetweenKeys المستوردتين من App.tsx، حتى لا
// نحتاج تصدير كل دالة مساعدة داخلية من هناك. ──────────────────────────
const addDaysToKey = (key: string, delta: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, (d || 1) + delta));
  return dt.toISOString().slice(0, 10);
};

type StatsDateFilter = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'all' | 'custom';

const DATE_FILTER_OPTIONS: { id: StatsDateFilter; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'last7', label: 'آخر 7 أيام' },
  { id: 'last30', label: 'آخر 30 يومًا' },
  { id: 'thisMonth', label: 'هذا الشهر' },
  { id: 'lastMonth', label: 'الشهر الماضي' },
  { id: 'all', label: 'كل الفترة' },
  { id: 'custom', label: 'تاريخ مخصص' },
];

/** from/to هي مفاتيح 'YYYY-MM-DD' شاملة (inclusive)، أو null = بلا حد (كل الفترة). */
function computeRange(filter: StatsDateFilter, todayKey: string, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  switch (filter) {
    case 'today': return { from: todayKey, to: todayKey };
    case 'yesterday': { const y = addDaysToKey(todayKey, -1); return { from: y, to: y }; }
    case 'last7': return { from: addDaysToKey(todayKey, -6), to: todayKey };
    case 'last30': return { from: addDaysToKey(todayKey, -29), to: todayKey };
    case 'thisMonth': return { from: `${todayKey.slice(0, 7)}-01`, to: todayKey };
    case 'lastMonth': {
      const [y, m] = todayKey.split('-').map(Number);
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;
      const from = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const to = addDaysToKey(`${todayKey.slice(0, 7)}-01`, -1);
      return { from, to };
    }
    case 'custom': return { from: customFrom || null, to: customTo || null };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

// ── نصيب الشراء % → دلو لوني (Purchase Share bucket) — يعتمد على
// Tailwind `text-*`/`dark:text-*` مع fill="currentColor" حتى يبقى متوافقاً
// تلقائياً مع نظام الثيم الحالي (data-theme) بلا أي كود JS إضافي. ──────
function shareColorClass(sharePct: number): string {
  if (sharePct <= 0) return 'text-gray-200 dark:text-gray-700';
  if (sharePct < 5) return 'text-blue-200 dark:text-blue-900';
  if (sharePct < 15) return 'text-blue-400 dark:text-blue-700';
  if (sharePct < 30) return 'text-blue-600 dark:text-blue-500';
  return 'text-blue-800 dark:text-blue-300';
}

interface WilayaAggRow {
  code: number;
  name: string;
  count: number;
  revenue: number;
  sharePct: number;
}

export default function StatisticsPage({ orders }: { orders: Order[] }) {
  const todayKey = algiersDateKey(new Date());
  const [dateFilter, setDateFilter] = useState<StatsDateFilter>('last30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [chartMetric, setChartMetric] = useState<'visits' | 'revenue'>('visits');
  const [selectedWilayaCode, setSelectedWilayaCode] = useState<number | null>(null);

  const range = useMemo(() => computeRange(dateFilter, todayKey, customFrom, customTo), [dateFilter, todayKey, customFrom, customTo]);
  const rangeIsValid = dateFilter !== 'custom' || (!!range.from && !!range.to);

  // ── زيارات الموقع (Page Views) — استعلام واحد مُجمّع لكل تغيّر في الفترة ──
  const [visits, setVisits] = useState<db.AnalyticsStatsResult | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState(false);

  useEffect(() => {
    if (!rangeIsValid) return;
    let cancelled = false;
    setVisitsLoading(true);
    setVisitsError(false);
    const from = range.from || '2000-01-01';
    const to = range.to || todayKey;
    db.fetchAnalyticsStats(from, to).then(res => {
      if (cancelled) return;
      setVisitsLoading(false);
      if (res.ok && res.data) {
        setVisits(res.data);
      } else {
        setVisitsError(true);
        setVisits(null);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, rangeIsValid]);

  // ── الطلبات المؤكدة ضمن الفترة (بصرف النظر عن الأرشفة) ─────────────
  const confirmedInRange = useMemo(() => {
    return orders.filter(o => {
      if (normalizeOrderStatus(o.status) !== 'confirmed') return false;
      const key = o.createdAt ? algiersDateKey(o.createdAt) : '';
      if (!key) return false;
      if (range.from && key < range.from) return false;
      if (range.to && key > range.to) return false;
      return true;
    });
  }, [orders, range.from, range.to]);

  const confirmedRevenue = useMemo(() => confirmedInRange.reduce((s, o) => s + (o.total || 0), 0), [confirmedInRange]);
  const confirmedCount = confirmedInRange.length;
  const totalViews = visits?.totalViews ?? 0;
  const conversionRate = totalViews > 0 ? (confirmedCount / totalViews) * 100 : null;
  const aov = confirmedCount > 0 ? confirmedRevenue / confirmedCount : 0;

  // ── تجميع حسب الولاية (طلبات مؤكدة فقط ضمن الفترة) ──────────────────
  const wilayaAgg = useMemo((): { rows: WilayaAggRow[]; byCode: Map<number, WilayaAggRow>; totalCount: number } => {
    const counts = new Map<number, { count: number; revenue: number }>();
    let totalCount = 0;
    for (const o of confirmedInRange) {
      const code = o.wilayaId;
      if (!code) continue; // طلبات قديمة بدون wilayaId — تُحتسب في الإجماليات أعلاه لكن لا يمكن ربطها بولاية على الخريطة
      const cur = counts.get(code) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += o.total || 0;
      counts.set(code, cur);
      totalCount += 1;
    }
    const byCode = new Map<number, WilayaAggRow>();
    const rows: WilayaAggRow[] = [];
    counts.forEach((v, code) => {
      const meta = wilayaShipping.find(w => w.code === code);
      const row: WilayaAggRow = {
        code,
        name: meta?.name || `ولاية ${code}`,
        count: v.count,
        revenue: v.revenue,
        sharePct: totalCount > 0 ? Math.round((v.count / totalCount) * 1000) / 10 : 0,
      };
      byCode.set(code, row);
      rows.push(row);
    });
    rows.sort((a, b) => b.count - a.count);
    return { rows, byCode, totalCount };
  }, [confirmedInRange]);

  const top5 = wilayaAgg.rows.slice(0, 5);
  const selectedWilaya = selectedWilayaCode ? wilayaAgg.byCode.get(selectedWilayaCode) : undefined;
  const selectedWilayaName = selectedWilayaCode
    ? (wilayaShipping.find(w => w.code === selectedWilayaCode)?.name || `ولاية ${selectedWilayaCode}`)
    : null;

  // ── سلسلة يومية للرسم البياني — بحد أقصى 60 يوماً حتى في "كل الفترة" ──
  const chartDays = useMemo(() => {
    const to = range.to || todayKey;
    const from = range.from && daysBetweenKeys(range.from, to) <= 60 ? range.from : addDaysToKey(to, -59);
    const keys: string[] = [];
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 61) { keys.push(cursor); cursor = addDaysToKey(cursor, 1); guard++; }
    const visitsByDate = new Map((visits?.byDate || []).map(p => [p.date, p.views]));
    const revenueByDate = new Map<string, number>();
    for (const o of confirmedInRange) {
      const key = o.createdAt ? algiersDateKey(o.createdAt) : '';
      if (!key) continue;
      revenueByDate.set(key, (revenueByDate.get(key) || 0) + (o.total || 0));
    }
    return keys.map(k => ({ date: k, visits: visitsByDate.get(k) || 0, revenue: revenueByDate.get(k) || 0 }));
  }, [range.from, range.to, todayKey, visits, confirmedInRange]);

  const wasTruncated = !!(range.from && daysBetweenKeys(range.from, range.to || todayKey) > 60);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-50">📊 الإحصائيات</h2>

      {/* ── فلتر التاريخ ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-2">
        {DATE_FILTER_OPTIONS.map(o => (
          <button
            key={o.id}
            onClick={() => setDateFilter(o.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${dateFilter === o.id ? 'bg-[#183C6B] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            {o.label}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-2 py-1 text-xs" />
            <span className="text-xs text-gray-400">إلى</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-2 py-1 text-xs" />
          </div>
        )}
      </div>
      {dateFilter === 'custom' && !rangeIsValid && (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">اختر تاريخي "من" و"إلى" لعرض الإحصائيات.</p>
      )}

      {/* ── بطاقات KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4">
          <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-base mb-3 text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">💰</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">{confirmedCount > 0 ? formatDzd(confirmedRevenue) : '—'}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1">الإيرادات المؤكدة</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4">
          <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-base mb-3 text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40">👥</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">{visitsLoading ? '...' : visitsError ? '—' : totalViews.toLocaleString()}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1">زيارات الموقع {visitsError && <span className="text-red-500">(تعذّر التحميل)</span>}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4">
          <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-base mb-3 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40">✅</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">{confirmedCount.toLocaleString()}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1">الطلبات المؤكدة</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4">
          <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-base mb-3 text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40">📈</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">{conversionRate === null ? '—' : `${conversionRate.toFixed(1)}%`}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1">معدل التحويل {totalViews === 0 && <span className="text-gray-400">(بلا زيارات)</span>}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4">
          <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-base mb-3 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">🧾</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">{confirmedCount > 0 ? formatDzd(aov) : '—'}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1">متوسط قيمة الطلب المؤكد</p>
        </div>
      </div>

      {/* ── رسم بياني: أداء المتجر عبر الزمن ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-50">📈 أداء المتجر</h3>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setChartMetric('visits')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${chartMetric === 'visits' ? 'bg-white dark:bg-gray-900 text-[#183C6B] dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>👥 الزيارات</button>
            <button onClick={() => setChartMetric('revenue')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${chartMetric === 'revenue' ? 'bg-white dark:bg-gray-900 text-[#183C6B] dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>💰 الإيرادات المؤكدة</button>
          </div>
        </div>
        {wasTruncated && <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">يعرض الرسم آخر 60 يومًا من الفترة المحددة (الفترة أطول من ذلك).</p>}
        <SimpleLineChart points={chartDays.map(d => ({ label: d.date, value: chartMetric === 'visits' ? d.visits : d.revenue }))} valueFormatter={chartMetric === 'revenue' ? formatDzd : (n: number) => n.toLocaleString()} />
      </div>

      {/* ── المبيعات حسب الولايات ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-50 mb-1">🗺️ المبيعات حسب الولايات</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">من الطلبات المؤكدة فقط ضمن الفترة المحددة — اضغط على أي ولاية لعرض تفاصيلها.</p>

        {wilayaAgg.totalCount === 0 ? (
          <div className="text-center py-10"><p className="text-5xl mb-3">🗺️</p><p className="text-gray-400 dark:text-gray-500">لا توجد مبيعات مؤكدة مرتبطة بولاية خلال هذه الفترة</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="w-full overflow-hidden">
                <svg viewBox={ALGERIA_MAP_VIEWBOX} className="w-full h-auto max-h-[520px] mx-auto" role="img" aria-label="خريطة الجزائر — المبيعات حسب الولايات">
                  {wilayaShapes.map(shape => {
                    const row = wilayaAgg.byCode.get(shape.code);
                    const sharePct = row?.sharePct ?? 0;
                    const isSelected = selectedWilayaCode === shape.code;
                    const colorClass = shareColorClass(sharePct);
                    const shapeClassName = `${colorClass} cursor-pointer transition-colors stroke-white dark:stroke-gray-900 hover:opacity-80 ${isSelected ? 'stroke-amber-500 dark:stroke-amber-400' : ''}`;
                    const shapeLabel = `${wilayaShipping.find(w => w.code === shape.code)?.name || shape.code}${row ? ` — ${sharePct}%` : ''}`;
                    return shape.tag === 'path' ? (
                      <path
                        key={shape.code}
                        d={shape.d}
                        className={shapeClassName}
                        fill="currentColor"
                        strokeWidth={isSelected ? 1.5 : 0.75}
                        onClick={() => setSelectedWilayaCode(shape.code)}
                        role="button"
                        tabIndex={0}
                        aria-label={shapeLabel}
                      />
                    ) : (
                      <polygon
                        key={shape.code}
                        points={shape.d}
                        className={shapeClassName}
                        fill="currentColor"
                        strokeWidth={isSelected ? 1.5 : 0.75}
                        onClick={() => setSelectedWilayaCode(shape.code)}
                        role="button"
                        tabIndex={0}
                        aria-label={shapeLabel}
                      />
                    );
                  })}
                </svg>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3 flex-wrap text-[11px] text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-900 inline-block" /> منخفض</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-700 inline-block" /> متوسط</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-800 dark:bg-blue-300 inline-block" /> مرتفع</span>
                <span className="mr-2">مقياس اللون: نصيب الشراء % (Purchase Share)</span>
              </div>

              {/* لوحة التفاصيل — دائماً أسفل الخريطة (يشمل الجوال) */}
              <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                {selectedWilaya ? (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-50">{selectedWilayaName} <span className="text-xs text-gray-400 font-normal">({selectedWilaya.code})</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedWilaya.count.toLocaleString()} طلب مؤكد — {formatDzd(selectedWilaya.revenue)}</p>
                    </div>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{selectedWilaya.sharePct}%</span>
                  </div>
                ) : selectedWilayaCode ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">{selectedWilayaName} — لا توجد مبيعات مؤكدة من هذه الولاية خلال الفترة المحددة.</p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">اضغط على أي ولاية في الخريطة لعرض تفاصيلها هنا.</p>
                )}
              </div>
            </div>

            {/* أفضل 5 ولايات */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">🏆 أفضل 5 ولايات (بعدد الطلبات المؤكدة)</h4>
              <div className="space-y-2">
                {top5.map((row, i) => (
                  <button
                    key={row.code}
                    onClick={() => setSelectedWilayaCode(row.code)}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl p-3 text-right transition-all ${selectedWilayaCode === row.code ? 'bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#183C6B] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-50">{row.name}</span>
                    </span>
                    <span className="text-left">
                      <span className="block text-xs font-bold text-blue-700 dark:text-blue-300">{row.sharePct}%</span>
                      <span className="block text-[10px] text-gray-400 dark:text-gray-500">{row.count} طلب</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SimpleLineChart — رسم بياني بسيط بـ SVG خام، بلا أي مكتبة خارجية
// ============================================================
function SimpleLineChart({ points, valueFormatter }: { points: { label: string; value: number }[]; valueFormatter: (n: number) => string }) {
  const max = Math.max(1, ...points.map(p => p.value));
  const allZero = points.every(p => p.value === 0);

  if (points.length === 0 || allZero) {
    return (
      <div className="text-center py-10">
        <p className="text-4xl mb-2">📭</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm">لا توجد بيانات كافية لعرض الرسم البياني خلال هذه الفترة</p>
      </div>
    );
  }

  const W = 600, H = 160, PAD = 8;
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p.value / max) * (H - PAD * 2));
    return { x, y, ...p };
  });
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD} L${coords[0].x.toFixed(1)},${H - PAD} Z`;

  return (
    // dir="ltr" هنا مقصود: محور الزمن داخل SVG يرسم الأقدم يساراً/الأحدث
    // يميناً بغض النظر عن اتجاه الصفحة (SVG لا يُعكس تلقائياً مع dir=rtl)،
    // فلولا هذا لانعكس ترتيب تسميتَي "من/إلى" أسفل الرسم بسبب flex في RTL
    // وأصبحتا لا تطابقان طرفي الرسم البياني الفعليين.
    <div className="w-full overflow-x-auto" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40 min-w-[320px]" preserveAspectRatio="none">
        <path d={areaPath} className="fill-blue-100 dark:fill-blue-950/40" stroke="none" />
        <path d={linePath} className="stroke-[#183C6B] dark:stroke-blue-400" fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2.2" className="fill-[#183C6B] dark:fill-blue-300" vectorEffect="non-scaling-stroke">
            <title>{`${c.label}: ${valueFormatter(c.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
