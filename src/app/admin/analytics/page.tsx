'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import { format, startOfMonth, startOfWeek, subMonths } from 'date-fns'

// ── Raw DB types ─────────────────────────────────────────────────────────────
interface GroupRow    { id: string; name: string; description: string | null; is_free: boolean }
interface TemplateRow { id: string; name: string; template_group_id: string | null; is_free: boolean }
interface PurchaseRow { template_group_id: string | null; template_id: string | null; amount_paid: number; purchase_date: string; is_active: boolean }
interface DocumentRow { template_id: string; created_at: string }

// ── Computed stats ────────────────────────────────────────────────────────────
interface GroupStat {
  id: string; name: string; description: string | null; is_free: boolean
  purchases: number; activePurchases: number; revenue: number
  docCount: number; lastPurchase: string | null
}
interface TemplateStat {
  id: string; name: string; groupName: string | null; is_free: boolean
  purchases: number; revenue: number; docCount: number; lastPurchase: string | null
}

type SortKey = 'purchases' | 'revenue' | 'docCount'
type Period  = 'all' | 'month' | 'week' | '3months'

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'purchases', label: 'Most Purchased', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { key: 'docCount',  label: 'Most Used',      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'revenue',   label: 'Top Revenue',    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
]

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'all',     label: 'All Time' },
  { key: 'month',   label: 'This Month' },
  { key: 'week',    label: 'This Week' },
  { key: '3months', label: 'Last 3 Months' },
]

const RANK_STYLE = [
  'bg-yellow-400 text-yellow-900',  // 1st — gold
  'bg-gray-300 text-gray-700',      // 2nd — silver
  'bg-amber-500 text-amber-900',    // 3rd — bronze
]

export default function AnalyticsPage() {
  const [groups,    setGroups]    = useState<GroupRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [sortKey,   setSortKey]   = useState<SortKey>('purchases')
  const [period,    setPeriod]    = useState<Period>('all')

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [{ data: g }, { data: t }, { data: p }, { data: d }] = await Promise.all([
        supabase.from('template_groups').select('id, name, description, is_free').order('name'),
        supabase.from('templates').select('id, name, template_group_id, is_free').order('name'),
        supabase.from('purchases').select('template_group_id, template_id, amount_paid, purchase_date, is_active'),
        supabase.from('documents').select('template_id, created_at'),
      ])
      setGroups(g || [])
      setTemplates(t || [])
      setPurchases(p || [])
      setDocuments(d || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // ── Date cutoff based on period ───────────────────────────────────────────
  const cutoff = useMemo((): Date | null => {
    const now = new Date()
    if (period === 'month')   return startOfMonth(now)
    if (period === 'week')    return startOfWeek(now, { weekStartsOn: 1 })
    if (period === '3months') return startOfMonth(subMonths(now, 2))
    return null
  }, [period])

  const filteredPurchases = useMemo(() =>
    cutoff ? purchases.filter((p) => new Date(p.purchase_date) >= cutoff!) : purchases,
    [purchases, cutoff]
  )

  const filteredDocuments = useMemo(() =>
    cutoff ? documents.filter((d) => new Date(d.created_at) >= cutoff!) : documents,
    [documents, cutoff]
  )

  // ── Build group stats ─────────────────────────────────────────────────────
  const groupStats = useMemo((): GroupStat[] => {
    return groups.map((g) => {
      const gPurchases = filteredPurchases.filter((p) => p.template_group_id === g.id)
      const groupTplIds = templates.filter((t) => t.template_group_id === g.id).map((t) => t.id)
      const docCount = filteredDocuments.filter((d) => groupTplIds.includes(d.template_id)).length
      const sortedDates = gPurchases.map((p) => p.purchase_date).sort().reverse()
      return {
        id: g.id, name: g.name, description: g.description, is_free: g.is_free,
        purchases:       gPurchases.length,
        activePurchases: gPurchases.filter((p) => p.is_active).length,
        revenue:         gPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0),
        docCount,
        lastPurchase: sortedDates[0] || null,
      }
    })
  }, [groups, templates, filteredPurchases, filteredDocuments])

  // ── Build template stats ──────────────────────────────────────────────────
  const templateStats = useMemo((): TemplateStat[] => {
    const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]))
    return templates.map((t) => {
      const tPurchases = filteredPurchases.filter((p) => p.template_id === t.id)
      const docCount   = filteredDocuments.filter((d) => d.template_id === t.id).length
      const sortedDates = tPurchases.map((p) => p.purchase_date).sort().reverse()
      return {
        id: t.id, name: t.name, is_free: t.is_free,
        groupName: t.template_group_id ? groupMap[t.template_group_id] || null : null,
        purchases: tPurchases.length,
        revenue:   tPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0),
        docCount,
        lastPurchase: sortedDates[0] || null,
      }
    })
  }, [templates, groups, filteredPurchases, filteredDocuments])

  const sortedGroups    = useMemo(() => [...groupStats].sort((a, b) => b[sortKey] - a[sortKey]), [groupStats, sortKey])
  const sortedTemplates = useMemo(() => [...templateStats].sort((a, b) => b[sortKey] - a[sortKey]), [templateStats, sortKey])

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalPurchases = filteredPurchases.length
  const totalRevenue   = filteredPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const totalDocs      = filteredDocuments.length
  const topGroup       = sortedGroups[0]
  const topTemplate    = sortedTemplates[0]

  // Max values for progress bars
  const maxGroupVal    = Math.max(1, ...sortedGroups.map((g) => g[sortKey]))
  const maxTplVal      = Math.max(1, ...sortedTemplates.map((t) => t[sortKey]))

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtDate = (d: string | null) => d ? format(new Date(d), 'dd MMM yy') : '—'
  const fmtNum  = (n: number) => n.toLocaleString()

  const metricLabel = sortKey === 'purchases' ? 'Purchases' : sortKey === 'revenue' ? 'Revenue' : 'Documents'
  const metricVal   = (stat: GroupStat | TemplateStat) =>
    sortKey === 'revenue' ? `₹${fmtNum(stat.revenue)}` : fmtNum(stat[sortKey])

  return (
    <div>
      <Header title="Analytics" subtitle="Discover which groups and templates are most popular" />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : (
          <>
            {/* ── Summary ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Purchases', value: fmtNum(totalPurchases),
                  sub: period === 'all' ? 'All time' : PERIOD_OPTIONS.find((p) => p.key === period)?.label,
                  color: 'bg-navy-800', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
                },
                {
                  label: 'Total Revenue', value: `₹${fmtNum(totalRevenue)}`,
                  sub: 'From purchases',
                  color: 'bg-green-600', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
                },
                {
                  label: 'Documents Generated', value: fmtNum(totalDocs),
                  sub: 'Template usages',
                  color: 'bg-blue-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                },
                {
                  label: 'Top Item', value: topGroup?.name || topTemplate?.name || '—',
                  sub: topGroup ? 'Group' : 'Template',
                  color: 'bg-orange-500', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
                },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className={`${c.color} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="text-lg font-bold text-gray-900 truncate">{c.value}</p>
                    <p className="text-xs text-gray-400">{c.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Controls ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Sort tabs */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortKey(opt.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sortKey === opt.key
                        ? 'bg-navy-800 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                    </svg>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Period filter */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-xl shadow-sm ml-auto">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setPeriod(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      period === opt.key
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Two-column ranking ───────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Groups Ranking */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Template Groups</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Ranked by {metricLabel.toLowerCase()}</p>
                  </div>
                  <span className="text-xs text-gray-400">{sortedGroups.length} groups</span>
                </div>

                {sortedGroups.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">No groups yet</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {sortedGroups.map((g, i) => {
                      const pct = Math.round((g[sortKey] / maxGroupVal) * 100)
                      return (
                        <div key={g.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {/* Rank badge */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              i < 3 ? RANK_STYLE[i] : 'bg-gray-100 text-gray-500'
                            }`}>
                              {i + 1}
                            </div>

                            {/* Name + group info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                                {g.is_free && (
                                  <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Free</span>
                                )}
                                {i === 0 && g[sortKey] > 0 && (
                                  <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-semibold">🏆 Top</span>
                                )}
                              </div>
                              {/* Progress bar */}
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    sortKey === 'revenue' ? 'bg-green-500' : sortKey === 'docCount' ? 'bg-blue-500' : 'bg-navy-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex-shrink-0 text-right">
                              <p className={`text-sm font-bold ${
                                sortKey === 'revenue' ? 'text-green-700' : sortKey === 'docCount' ? 'text-blue-700' : 'text-navy-800'
                              }`}>{metricVal(g)}</p>
                              <p className="text-xs text-gray-400">{metricLabel}</p>
                            </div>
                          </div>

                          {/* Secondary stats row */}
                          <div className="flex items-center gap-4 mt-2 pl-10 flex-wrap">
                            {sortKey !== 'purchases' && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
                                </svg>
                                {g.purchases} purchase{g.purchases !== 1 ? 's' : ''}
                              </span>
                            )}
                            {sortKey !== 'docCount' && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6" />
                                </svg>
                                {g.docCount} docs generated
                              </span>
                            )}
                            {sortKey !== 'revenue' && !g.is_free && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                ₹{fmtNum(g.revenue)}
                              </span>
                            )}
                            {g.lastPurchase && (
                              <span className="text-xs text-gray-400">Last: {fmtDate(g.lastPurchase)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Templates Ranking */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Individual Templates</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Ranked by {metricLabel.toLowerCase()}</p>
                  </div>
                  <span className="text-xs text-gray-400">{sortedTemplates.length} templates</span>
                </div>

                {sortedTemplates.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">No templates yet</div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {sortedTemplates.map((t, i) => {
                      const pct = Math.round((t[sortKey] / maxTplVal) * 100)
                      return (
                        <div key={t.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {/* Rank badge */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              i < 3 ? RANK_STYLE[i] : 'bg-gray-100 text-gray-500'
                            }`}>
                              {i + 1}
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                                {t.is_free && (
                                  <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Free</span>
                                )}
                                {i === 0 && t[sortKey] > 0 && (
                                  <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-semibold">🏆 Top</span>
                                )}
                              </div>
                              {t.groupName && (
                                <p className="text-xs text-gray-400 truncate mb-0.5">{t.groupName}</p>
                              )}
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    sortKey === 'revenue' ? 'bg-green-500' : sortKey === 'docCount' ? 'bg-blue-500' : 'bg-navy-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex-shrink-0 text-right">
                              <p className={`text-sm font-bold ${
                                sortKey === 'revenue' ? 'text-green-700' : sortKey === 'docCount' ? 'text-blue-700' : 'text-navy-800'
                              }`}>{metricVal(t)}</p>
                              <p className="text-xs text-gray-400">{metricLabel}</p>
                            </div>
                          </div>

                          {/* Secondary stats */}
                          <div className="flex items-center gap-4 mt-2 pl-10 flex-wrap">
                            {sortKey !== 'purchases' && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
                                </svg>
                                {t.purchases} purchase{t.purchases !== 1 ? 's' : ''}
                              </span>
                            )}
                            {sortKey !== 'docCount' && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6" />
                                </svg>
                                {t.docCount} docs
                              </span>
                            )}
                            {sortKey !== 'revenue' && !t.is_free && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                ₹{fmtNum(t.revenue)}
                              </span>
                            )}
                            {t.lastPurchase && (
                              <span className="text-xs text-gray-400">Last: {fmtDate(t.lastPurchase)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* ── Zero-activity note ───────────────────────────────────── */}
            {totalPurchases === 0 && totalDocs === 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                <p className="text-sm text-blue-700 font-medium">No activity found for the selected period.</p>
                <p className="text-xs text-blue-500 mt-1">Try switching to "All Time" to see historical data.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
