'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import Link from 'next/link'
import { format, differenceInDays, isAfter, startOfMonth, subMonths, parseISO } from 'date-fns'

interface Purchase {
  id: string
  lawyer_id: string
  template_group_id: string | null
  template_id: string | null
  amount_paid: number
  purchase_date: string
  expiry_date: string | null
  is_active: boolean
  profiles?: { full_name: string | null; email: string | null } | null
  template_groups?: { name: string } | null
  templates?: { name: string } | null
}

type FilterType   = 'all' | 'group' | 'template'
type FilterStatus = 'all' | 'active' | 'expired' | 'expiring'

export default function PurchasesClient({ initialPurchases }: { initialPurchases: Purchase[] }) {
  const [purchases, setPurchases]       = useState<Purchase[]>(initialPurchases)
  const [search, setSearch]             = useState('')
  const [filterType, setFilterType]     = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [actionTarget, setActionTarget] = useState<Purchase | null>(null)
  const [actionModal, setActionModal]   = useState(false)
  const [extendTarget, setExtendTarget] = useState<Purchase | null>(null)
  const [extendModal, setExtendModal]   = useState(false)
  const [extendYears, setExtendYears]   = useState(1)
  const [saving, setSaving]             = useState(false)
  const [toast, setToast]               = useState('')

  const supabase = createClient()
  const now = new Date()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const reloadPurchases = async () => {
    const { data: rawPurchases } = await supabase
      .from('purchases')
      .select('*, template_groups(name), templates(name)')
      .order('purchase_date', { ascending: false })

    const lawyerIds = [...new Set((rawPurchases || []).map((p: any) => p.lawyer_id as string))]
    const { data: profiles } = lawyerIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', lawyerIds)
      : { data: [] }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    const merged = (rawPurchases || []).map((p: any) => ({
      ...p,
      profiles: profileMap.get(p.lawyer_id) ?? null,
    }))
    setPurchases(merged)
  }

  const toggleActive = async () => {
    if (!actionTarget) return
    setSaving(true)
    const { error } = await supabase.from('purchases').update({ is_active: !actionTarget.is_active }).eq('id', actionTarget.id)
    if (!error) { showToast(actionTarget.is_active ? 'Purchase revoked' : 'Purchase restored'); await reloadPurchases() }
    setSaving(false)
    setActionModal(false)
  }

  const handleExtend = async () => {
    if (!extendTarget) return
    setSaving(true)
    const base = extendTarget.expiry_date ? new Date(extendTarget.expiry_date) : new Date()
    base.setFullYear(base.getFullYear() + extendYears)
    const { error } = await supabase.from('purchases').update({ expiry_date: base.toISOString(), is_active: true }).eq('id', extendTarget.id)
    if (!error) { showToast(`Validity extended by ${extendYears} year${extendYears > 1 ? 's' : ''}`); await reloadPurchases() }
    setSaving(false)
    setExtendModal(false)
  }

  // Stats
  const thisMonthStart   = startOfMonth(now)
  const totalRevenue     = purchases.reduce((s, p) => s + p.amount_paid, 0)
  const activeCount      = purchases.filter((p) => p.is_active).length
  const expiredCount     = purchases.filter((p) => !p.is_active).length
  const thisMonthRevenue = purchases.filter((p) => isAfter(parseISO(p.purchase_date), thisMonthStart)).reduce((s, p) => s + p.amount_paid, 0)
  const expiringSoon     = purchases.filter((p) => {
    if (!p.is_active || !p.expiry_date) return false
    const d = differenceInDays(new Date(p.expiry_date), now)
    return d >= 0 && d <= 30
  }).length

  // Monthly revenue chart
  const monthlyRevenue = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      return { label: format(d, 'MMM'), start: startOfMonth(d), revenue: 0, count: 0 }
    })
    purchases.forEach((p) => {
      const pd = parseISO(p.purchase_date)
      months.forEach((m, idx) => {
        const end = idx < 5 ? months[idx + 1].start : new Date(now.getFullYear(), now.getMonth() + 1, 1)
        if (pd >= m.start && pd < end) { m.revenue += p.amount_paid; m.count += 1 }
      })
    })
    return months
  }, [purchases])
  const maxMonthRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1)

  // Top spenders
  const userSpending = useMemo(() => {
    const map = new Map<string, { name: string; email: string; total: number; count: number }>()
    purchases.forEach((p) => {
      const key = p.lawyer_id
      const name = p.profiles?.full_name || '—'
      const email = p.profiles?.email || ''
      const ex = map.get(key)
      if (ex) { ex.total += p.amount_paid; ex.count += 1 }
      else map.set(key, { name, email, total: p.amount_paid, count: 1 })
    })
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 6)
  }, [purchases])

  // Leaderboard
  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; type: 'group' | 'template'; count: number; revenue: number }>()
    purchases.forEach((p) => {
      const key  = p.template_id || p.template_group_id || 'unknown'
      const name = p.templates?.name || p.template_groups?.name || 'Unknown'
      const type: 'group' | 'template' = p.template_id ? 'template' : 'group'
      const ex   = map.get(key)
      if (ex) { ex.count += 1; ex.revenue += p.amount_paid }
      else map.set(key, { name, type, count: 1, revenue: p.amount_paid })
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [purchases])
  const maxLeaderCount = leaderboard[0]?.count || 1

  // Filter
  const filtered = useMemo(() => purchases.filter((p) => {
    if (filterType === 'group'    && !p.template_group_id) return false
    if (filterType === 'template' && !p.template_id)       return false
    if (filterStatus === 'active'   && !p.is_active) return false
    if (filterStatus === 'expired'  && p.is_active)  return false
    if (filterStatus === 'expiring') {
      if (!p.is_active || !p.expiry_date) return false
      const d = differenceInDays(new Date(p.expiry_date), now)
      if (d < 0 || d > 30) return false
    }
    if (search) {
      const q    = search.toLowerCase()
      const name  = (p.profiles?.full_name || '').toLowerCase()
      const email = (p.profiles?.email || '').toLowerCase()
      const item  = (p.templates?.name || p.template_groups?.name || '').toLowerCase()
      if (!name.includes(q) && !email.includes(q) && !item.includes(q)) return false
    }
    return true
  }), [purchases, filterType, filterStatus, search])

  const statusCounts: Record<FilterStatus, number> = { all: purchases.length, active: activeCount, expired: expiredCount, expiring: expiringSoon }

  const ValidityBar = ({ purchase }: { purchase: Purchase }) => {
    if (!purchase.is_active) return <span className="text-xs text-gray-400">Revoked</span>
    if (!purchase.expiry_date) return <span className="text-xs text-gray-400">Lifetime</span>
    const total  = differenceInDays(new Date(purchase.expiry_date), parseISO(purchase.purchase_date))
    const used   = differenceInDays(now, parseISO(purchase.purchase_date))
    const pct    = Math.min(100, Math.max(0, Math.round((used / Math.max(total, 1)) * 100)))
    const dLeft  = differenceInDays(new Date(purchase.expiry_date), now)
    const color  = dLeft < 0 ? 'bg-red-400' : dLeft <= 7 ? 'bg-red-400' : dLeft <= 30 ? 'bg-orange-400' : 'bg-green-400'
    const label  = dLeft < 0 ? 'Expired' : `${dLeft}d left`
    const lcolor = dLeft < 0 ? 'text-red-600' : dLeft <= 30 ? 'text-orange-600' : 'text-gray-500'
    return (
      <div className="min-w-[110px]">
        <div className="flex justify-between mb-0.5">
          <span className="text-xs text-gray-400">{pct}% used</span>
          <span className={`text-xs font-medium ${lcolor}`}>{label}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>
      )}

      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Revenue',      value: `₹${totalRevenue.toLocaleString()}`,     sub: `${purchases.length} total purchases`,  color: 'bg-navy-800',                                  icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'This Month',         value: `₹${thisMonthRevenue.toLocaleString()}`, sub: format(thisMonthStart, 'MMMM yyyy'),     color: 'bg-green-600',                                 icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
            { label: 'Active',             value: activeCount,                              sub: 'valid & accessible',                   color: 'bg-blue-600',                                  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Expired / Revoked',  value: expiredCount,                             sub: 'access removed',                       color: 'bg-gray-500',                                  icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Expiring Soon',      value: expiringSoon,                             sub: 'within 30 days',                       color: expiringSoon > 0 ? 'bg-orange-500' : 'bg-gray-400', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
              <div className={`${c.color} w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{c.label}</p>
                <p className="text-lg font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-400 truncate">{c.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly bar chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Monthly Revenue (Last 6 Months)</h2>
            <div className="flex items-end gap-3 h-32">
              {monthlyRevenue.map((m) => {
                const h = maxMonthRevenue > 0 ? Math.round((m.revenue / maxMonthRevenue) * 100) : 0
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500 font-medium">
                      {m.revenue > 0 ? `₹${m.revenue >= 1000 ? Math.round(m.revenue / 1000) + 'k' : m.revenue}` : '—'}
                    </span>
                    <div className="w-full flex items-end" style={{ height: '80px' }}>
                      <div className="w-full bg-navy-800 rounded-t-md hover:bg-navy-700 transition-colors"
                        style={{ height: `${Math.max(h, m.revenue > 0 ? 4 : 0)}%` }}
                        title={`${m.count} purchases · ₹${m.revenue}`} />
                    </div>
                    <span className="text-xs text-gray-400">{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top spenders */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Customers by Spend</h2>
            {userSpending.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No purchases yet</p>
            ) : (
              <div className="space-y-3">
                {userSpending.map((u, i) => (
                  <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg p-1 -mx-1 transition-colors">
                    <span className="w-4 text-xs font-bold text-gray-400 flex-shrink-0">{i + 1}</span>
                    <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-navy-700">{(u.name !== '—' ? u.name : u.email).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{u.name !== '—' ? u.name : u.email}</p>
                      <p className="text-xs text-gray-400">{u.count} purchase{u.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-xs font-bold text-navy-800 flex-shrink-0">₹{u.total.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Most Purchased Templates / Groups</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {leaderboard.map((item, idx) => (
                <div key={item.name + idx} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-bold text-gray-400 text-right flex-shrink-0">{idx + 1}</span>
                  <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${item.type === 'group' ? 'bg-purple-100' : 'bg-navy-50'}`}>
                    <svg className={`w-3 h-3 ${item.type === 'group' ? 'text-purple-600' : 'text-navy-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.type === 'group' ? 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'} />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-800 w-36 truncate flex-shrink-0">{item.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${item.type === 'group' ? 'bg-purple-500' : 'bg-navy-700'}`} style={{ width: `${(item.count / maxLeaderCount) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-8 text-right flex-shrink-0">{item.count}x</span>
                  <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">₹{item.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchases Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-52">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer, email or template..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500" />
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              {(['all', 'template', 'group'] as FilterType[]).map((t) => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 capitalize transition-colors ${filterType === t ? 'bg-navy-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              {([{ v: 'all', label: 'All' }, { v: 'active', label: 'Active' }, { v: 'expiring', label: 'Expiring' }, { v: 'expired', label: 'Expired' }] as { v: FilterStatus; label: string }[]).map(({ v, label }) => (
                <button key={v} onClick={() => setFilterStatus(v)}
                  className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${filterStatus === v ? 'bg-navy-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                  <span className={`text-xs rounded-full px-1.5 py-0 font-bold leading-4 ${filterStatus === v ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{statusCounts[v]}</span>
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">No purchase records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs">
                  <tr>
                    {['Customer', 'Item Purchased', 'Type', 'Amount', 'Purchased', 'Expiry', 'Validity', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((p) => {
                    const isGroup       = !!p.template_group_id
                    const itemName      = p.templates?.name || p.template_groups?.name || '—'
                    const customerName  = p.profiles?.full_name || '—'
                    const customerEmail = p.profiles?.email || ''
                    const initial       = (customerName !== '—' ? customerName : customerEmail).charAt(0).toUpperCase()
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${p.lawyer_id}`} className="flex items-center gap-2.5 group">
                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-navy-700">{initial}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate group-hover:text-navy-700 transition-colors">{customerName}</div>
                              <div className="text-xs text-gray-400 truncate">{customerEmail}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px]"><span className="truncate block">{itemName}</span></td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isGroup ? 'bg-purple-100 text-purple-700' : 'bg-navy-50 text-navy-700'}`}>
                            {isGroup ? 'Group' : 'Template'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">₹{p.amount_paid.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{format(parseISO(p.purchase_date), 'dd MMM yyyy')}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {p.expiry_date ? format(new Date(p.expiry_date), 'dd MMM yyyy') : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3"><ValidityBar purchase={p} /></td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {p.is_active ? 'Active' : 'Revoked'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setExtendTarget(p); setExtendYears(1); setExtendModal(true) }}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors">Extend</button>
                            <button onClick={() => { setActionTarget(p); setActionModal(true) }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${p.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}>
                              {p.is_active ? 'Revoke' : 'Restore'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''} shown</span>
              <span className="font-semibold text-gray-900">Total: ₹{filtered.reduce((s, p) => s + p.amount_paid, 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Revoke / Restore Modal */}
      <Modal isOpen={actionModal} onClose={() => setActionModal(false)} title={actionTarget?.is_active ? 'Revoke Purchase' : 'Restore Purchase'}>
        {actionTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2.5 text-sm">
              {[
                ['Customer',    actionTarget.profiles?.full_name || actionTarget.profiles?.email || '—'],
                ['Email',       actionTarget.profiles?.email || '—'],
                ['Item',        actionTarget.templates?.name || actionTarget.template_groups?.name || '—'],
                ['Type',        actionTarget.template_id ? 'Individual Template' : 'Template Group'],
                ['Amount Paid', `₹${actionTarget.amount_paid.toLocaleString()}`],
                ['Purchased',   format(parseISO(actionTarget.purchase_date), 'dd MMM yyyy')],
                ...(actionTarget.expiry_date ? [['Expires', format(new Date(actionTarget.expiry_date), 'dd MMM yyyy')]] : []),
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 flex-shrink-0">{label}</span>
                  <span className="font-medium text-gray-900 text-right">{val}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              {actionTarget.is_active ? "Revoking will immediately remove this user's access." : "Restoring will re-enable this user's access."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setActionModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={toggleActive} disabled={saving}
                className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${actionTarget.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {saving ? 'Saving...' : actionTarget.is_active ? 'Revoke Access' : 'Restore Access'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Extend Modal */}
      <Modal isOpen={extendModal} onClose={() => setExtendModal(false)} title="Extend Validity">
        {extendTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2.5 text-sm">
              {[
                ['Customer',       extendTarget.profiles?.full_name || extendTarget.profiles?.email || '—'],
                ['Item',           extendTarget.templates?.name || extendTarget.template_groups?.name || '—'],
                ['Current Expiry', extendTarget.expiry_date ? format(new Date(extendTarget.expiry_date), 'dd MMM yyyy') : 'None'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 flex-shrink-0">{label}</span>
                  <span className="font-medium text-gray-900">{val}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 pt-2 border-t border-gray-200">
                <span className="text-gray-500 flex-shrink-0">New Expiry</span>
                <span className="font-bold text-green-700">
                  {(() => { const b = extendTarget.expiry_date ? new Date(extendTarget.expiry_date) : new Date(); b.setFullYear(b.getFullYear() + extendYears); return format(b, 'dd MMM yyyy') })()}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Extend by (years)</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((y) => (
                  <button key={y} onClick={() => setExtendYears(y)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${extendYears === y ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                    {y} Year{y > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExtendModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleExtend} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-navy-800 hover:bg-navy-900 rounded-lg disabled:opacity-50">
                {saving ? 'Extending...' : `Extend by ${extendYears} Year${extendYears > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
