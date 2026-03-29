'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'

interface Purchase {
  id: string
  template_group_id: string | null
  template_id: string | null
  amount_paid: number
  purchase_date: string
  expiry_date: string | null
  is_active: boolean
  duration_months: number
  template_groups?: { name: string; description: string | null } | null
  templates?: { name: string; description: string | null } | null
}

interface GroupTemplates {
  [groupId: string]: { id: string; name: string }[]
}

const PLAN_STYLE: Record<number, { label: string; badge: string; tag: string; bar: string }> = {
  1: { label: '1 Month',  badge: '1M', tag: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500' },
  3: { label: '3 Months', badge: '3M', tag: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
  6: { label: '6 Months', badge: '6M', tag: 'bg-green-100 text-green-700',  bar: 'bg-green-500' },
}

export default function PurchasesPage() {
  const [purchases, setPurchases]       = useState<Purchase[]>([])
  const [groupTemplates, setGroupTemplates] = useState<GroupTemplates>({})
  const [loading, setLoading]           = useState(true)

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('purchases')
      .select('*, template_groups(name, description), templates(name, description)')
      .eq('lawyer_id', user.id)
      .order('purchase_date', { ascending: false })

    const rows = data || []
    setPurchases(rows)

    // Load templates for group purchases
    const groupIds = [...new Set(rows.filter((p) => p.template_group_id).map((p) => p.template_group_id as string))]
    if (groupIds.length > 0) {
      const { data: tpls } = await supabase
        .from('templates')
        .select('id, name, template_group_id')
        .in('template_group_id', groupIds)
      if (tpls) {
        const map: GroupTemplates = {}
        tpls.forEach((t: any) => {
          if (!map[t.template_group_id]) map[t.template_group_id] = []
          map[t.template_group_id].push({ id: t.id, name: t.name })
        })
        setGroupTemplates(map)
      }
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const now = new Date()
  const active  = purchases.filter((p) => {
    if (!p.is_active) return false
    if (p.expiry_date && new Date(p.expiry_date) < now) return false
    return true
  })
  const expired = purchases.filter((p) => !p.is_active || (p.expiry_date && new Date(p.expiry_date) < now))

  const ValidityBar = ({ p }: { p: Purchase }) => {
    if (!p.is_active) return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Revoked</span>
      </div>
    )
    if (!p.expiry_date) return <span className="text-xs text-green-600 font-medium">Lifetime access</span>

    const totalDays = (p.duration_months || 1) * 30
    const daysUsed  = differenceInDays(now, new Date(p.purchase_date))
    const daysLeft  = differenceInDays(new Date(p.expiry_date), now)
    const pct       = Math.min(100, Math.max(0, Math.round((daysUsed / totalDays) * 100)))
    const barColor  = daysLeft < 0 ? 'bg-red-400' : daysLeft <= 7 ? 'bg-red-400' : daysLeft <= 30 ? 'bg-orange-400' : 'bg-green-400'
    const lblColor  = daysLeft < 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-orange-600' : 'text-green-700'

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">{pct}% used</span>
          <span className={`font-semibold ${lblColor}`}>
            {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const PurchaseCard = ({ p }: { p: Purchase }) => {
    const isGroup  = !!p.template_group_id
    const name     = isGroup ? p.template_groups?.name : p.templates?.name
    const desc     = isGroup ? p.template_groups?.description : p.templates?.description
    const style    = PLAN_STYLE[p.duration_months] || PLAN_STYLE[1]
    const isActive = p.is_active && (!p.expiry_date || new Date(p.expiry_date) >= now)
    const templates = isGroup && p.template_group_id ? (groupTemplates[p.template_group_id] || []) : []

    return (
      <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${isActive ? 'border-gray-100' : 'border-gray-100 opacity-70'}`}>
        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isGroup ? 'bg-purple-100' : 'bg-navy-50'}`}>
            {isGroup ? (
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="font-semibold text-gray-900 text-sm">{name || '—'}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.tag}`}>{style.label}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {isActive ? 'Active' : 'Expired'}
              </span>
            </div>
            {desc && <p className="text-xs text-gray-500 line-clamp-1">{desc}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold text-gray-900">₹{p.amount_paid.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{format(new Date(p.purchase_date), 'dd MMM yyyy')}</p>
          </div>
        </div>

        {/* Validity */}
        <div className="px-5 pb-4">
          <ValidityBar p={p} />
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>Purchased: {format(new Date(p.purchase_date), 'dd MMM yyyy')}</span>
            {p.expiry_date && <span>Expires: {format(new Date(p.expiry_date), 'dd MMM yyyy')}</span>}
          </div>
        </div>

        {/* Included templates for group purchases */}
        {isGroup && templates.length > 0 && (
          <div className="px-5 pb-4 border-t border-gray-50 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {templates.length} Template{templates.length !== 1 ? 's' : ''} Included
            </p>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Header
        title="My Purchases"
        subtitle="Your active plans and purchase history"
        actions={
          <Link
            href="/dashboard/marketplace"
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Browse Marketplace
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold mb-1">No purchases yet</p>
            <p className="text-gray-400 text-sm mb-4">Visit the marketplace to purchase template access</p>
            <Link
              href="/dashboard/marketplace"
              className="inline-flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              Go to Marketplace →
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Active Plans ({active.length})
                </h2>
                <div className="space-y-3">
                  {active.map((p) => <PurchaseCard key={p.id} p={p} />)}
                </div>
              </div>
            )}

            {expired.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-300 rounded-full" />
                  Expired / Revoked ({expired.length})
                </h2>
                <div className="space-y-3">
                  {expired.map((p) => <PurchaseCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
