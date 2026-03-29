'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { addMonths, format, differenceInDays } from 'date-fns'

interface Plan {
  id: string
  duration_months: number
  price: number
}

interface Group {
  id: string
  name: string
  description: string | null
  templateCount: number
  plans: Plan[]
}

interface StandaloneTemplate {
  id: string
  name: string
  description: string | null
  price: number
}

interface ActivePurchase {
  id: string
  template_group_id: string | null
  template_id: string | null
  expiry_date: string | null
  duration_months: number
  purchase_date: string
}

const PLAN_STYLE: Record<number, { label: string; badge: string; cardBg: string; btnBg: string; tag: string }> = {
  1: { label: '1 Month',  badge: '1M', cardBg: 'bg-blue-50 border-blue-100',   btnBg: 'bg-blue-600 hover:bg-blue-700',   tag: 'bg-blue-100 text-blue-700' },
  3: { label: '3 Months', badge: '3M', cardBg: 'bg-purple-50 border-purple-100', btnBg: 'bg-purple-600 hover:bg-purple-700', tag: 'bg-purple-100 text-purple-700' },
  6: { label: '6 Months', badge: '6M', cardBg: 'bg-green-50 border-green-100',  btnBg: 'bg-green-600 hover:bg-green-700',  tag: 'bg-green-100 text-green-700' },
}

export default function MarketplacePage() {
  const [groups, setGroups]                 = useState<Group[]>([])
  const [templates, setTemplates]           = useState<StandaloneTemplate[]>([])
  const [activePurchases, setActivePurchases] = useState<ActivePurchase[]>([])
  const [loading, setLoading]               = useState(true)
  const [buyTarget, setBuyTarget]           = useState<{ type: 'group' | 'template'; id: string; name: string; plan: Plan } | null>(null)
  const [purchasing, setPurchasing]         = useState(false)
  const [toast, setToast]                   = useState('')

  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date().toISOString()

    const [
      { data: groupData },
      { data: templateData },
      { data: plansData },
      { data: purchaseData },
      { data: tplCountData },
      { data: accessData },
    ] = await Promise.all([
      supabase.from('template_groups').select('id, name, description, is_restricted').neq('is_free', true),
      supabase.from('templates').select('id, name, description, template_group_id, is_restricted, price').eq('is_free', false).is('template_group_id', null).gt('price', 0),
      supabase.from('purchase_plans').select('*').eq('is_active', true).gt('price', 0),
      supabase.from('purchases').select('id, template_group_id, template_id, expiry_date, duration_months, purchase_date')
        .eq('lawyer_id', user.id).eq('is_active', true)
        .or(`expiry_date.is.null,expiry_date.gt.${now}`),
      supabase.from('templates').select('id, template_group_id'),
      supabase.from('template_access').select('template_id, template_group_id').eq('lawyer_id', user.id),
    ])

    const accessGrantIds = new Set((accessData || []).flatMap((a: any) => [a.template_id, a.template_group_id].filter(Boolean)))

    const builtGroups: Group[] = (groupData || [])
      .filter((g: any) => {
        // Hide restricted groups unless user has been granted access
        if (g.is_restricted === true && !accessGrantIds.has(g.id)) return false
        return true
      })
      .map((g) => ({
        ...g,
        templateCount: (tplCountData || []).filter((t) => t.template_group_id === g.id).length,
        plans: (plansData || []).filter((p) => p.template_group_id === g.id).sort((a, b) => a.duration_months - b.duration_months),
      }))
      .filter((g) => g.plans.length > 0)

    const builtTemplates: StandaloneTemplate[] = (templateData || [])
      .filter((t: any) => {
        if (t.is_restricted === true && !accessGrantIds.has(t.id)) return false
        return true
      })
      .map((t: any) => ({ id: t.id, name: t.name, description: t.description, price: t.price }))

    setGroups(builtGroups)
    setTemplates(builtTemplates)
    setActivePurchases(purchaseData || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const getActivePurchase = (type: 'group' | 'template', entityId: string) =>
    activePurchases.find((p) =>
      type === 'group' ? p.template_group_id === entityId : p.template_id === entityId
    )

  const handlePurchase = async () => {
    if (!buyTarget) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setPurchasing(true)
    const now = new Date()
    const expiry = addMonths(now, buyTarget.plan.duration_months)
    const payload: any = {
      lawyer_id: user.id,
      amount_paid: buyTarget.plan.price,
      duration_months: buyTarget.plan.duration_months,
      purchase_date: now.toISOString(),
      expiry_date: expiry.toISOString(),
      is_active: true,
    }
    if (buyTarget.type === 'group') payload.template_group_id = buyTarget.id
    else payload.template_id = buyTarget.id

    const { error } = await supabase.from('purchases').insert(payload)
    setPurchasing(false)
    setBuyTarget(null)
    if (error) showToast('Purchase failed: ' + error.message)
    else { showToast('✓ Access granted! You can now generate documents.'); await fetchData() }
  }

  // ── Validity badge ──────────────────────────────────────────────────────
  const ValidityBadge = ({ purchase }: { purchase: ActivePurchase }) => {
    if (!purchase.expiry_date) return <span className="text-xs text-green-600 font-medium">Lifetime</span>
    const days = differenceInDays(new Date(purchase.expiry_date), new Date())
    const color = days <= 7 ? 'text-red-600 bg-red-50' : days <= 30 ? 'text-orange-600 bg-orange-50' : 'text-green-700 bg-green-50'
    return (
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>
        {days <= 0 ? 'Expiring today' : `${days} days left`}
      </span>
    )
  }

  if (loading) return (
    <div>
      <Header title="Template Marketplace" subtitle="Purchase access to templates and groups" />
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
      </div>
    </div>
  )

  return (
    <div>
      <Header title="Template Marketplace" subtitle="Choose a plan to access premium templates" />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-3 rounded-xl text-sm shadow-xl">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-8">

        {/* ── Active plans ─────────────────────────────────────────────── */}
        {activePurchases.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              Your Active Plans ({activePurchases.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activePurchases.map((p) => {
                const style = PLAN_STYLE[p.duration_months] || PLAN_STYLE[1]
                const name = '—' // name resolved below via groups/templates
                return (
                  <div key={p.id} className="bg-white border border-green-100 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {p.template_group_id
                            ? (groups.find((g) => g.id === p.template_group_id)?.name || 'Group')
                            : (templates.find((t) => t.id === p.template_id)?.name || 'Template')}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${style.tag}`}>{style.badge}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        Purchased {format(new Date(p.purchase_date), 'dd MMM yyyy')}
                        {p.expiry_date && ` · Expires ${format(new Date(p.expiry_date), 'dd MMM yyyy')}`}
                      </p>
                      <ValidityBadge purchase={p} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Template Groups ───────────────────────────────────────────── */}
        {groups.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Template Groups</h2>
                <p className="text-xs text-gray-400">Buy a group to access all templates inside it</p>
              </div>
            </div>

            <div className="space-y-4">
              {groups.map((group) => {
                const active = getActivePurchase('group', group.id)
                return (
                  <div key={group.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    {/* Group header */}
                    <div className="px-5 py-4 border-b border-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-gray-900">{group.name}</h3>
                            {active && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                Active
                              </span>
                            )}
                          </div>
                          {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            {group.templateCount} template{group.templateCount !== 1 ? 's' : ''} included
                          </p>
                        </div>
                        {active && (
                          <div className="text-right flex-shrink-0">
                            <ValidityBadge purchase={active} />
                            {active.expiry_date && (
                              <p className="text-xs text-gray-400 mt-1">
                                Expires {format(new Date(active.expiry_date), 'dd MMM yyyy')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Plan options */}
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Choose a Plan</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {group.plans.map((plan) => {
                          const style = PLAN_STYLE[plan.duration_months] || PLAN_STYLE[1]
                          const alreadyActive = !!active
                          return (
                            <div key={plan.id} className={`border rounded-xl p-4 ${style.cardBg}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.tag}`}>{style.label}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 mb-3">₹{plan.price.toLocaleString()}</p>
                              <button
                                onClick={() => setBuyTarget({ type: 'group', id: group.id, name: group.name, plan })}
                                className={`w-full py-2 rounded-lg text-white text-xs font-semibold transition-colors ${
                                  alreadyActive
                                    ? 'bg-gray-200 text-gray-500 cursor-default'
                                    : `${style.btnBg} cursor-pointer`
                                }`}
                                disabled={alreadyActive}
                              >
                                {alreadyActive ? 'Already Active' : 'Buy Now'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Individual Templates ──────────────────────────────────────── */}
        {templates.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-navy-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Individual Templates</h2>
                <p className="text-xs text-gray-400">Purchase access to a single template</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => {
                const active = getActivePurchase('template', tpl.id)
                return (
                  <div key={tpl.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-gray-900 text-sm">{tpl.name}</h3>
                            {active && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                Active
                              </span>
                            )}
                          </div>
                          {tpl.description && <p className="text-xs text-gray-500">{tpl.description}</p>}
                        </div>
                        {active && <ValidityBadge purchase={active} />}
                      </div>
                    </div>
                    <div className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">1 Month</span>
                        <span className="text-lg font-bold text-gray-900">₹{tpl.price.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => !active && setBuyTarget({
                          type: 'template', id: tpl.id, name: tpl.name,
                          plan: { id: tpl.id, duration_months: 1, price: tpl.price },
                        })}
                        disabled={!!active}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-gray-100 text-gray-400 cursor-default'
                            : 'bg-navy-800 hover:bg-navy-900 text-white cursor-pointer'
                        }`}
                      >
                        {active ? 'Purchased' : 'Buy Now'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && templates.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No paid templates available yet</p>
            <p className="text-gray-400 text-sm mt-1">All available templates are currently free.</p>
          </div>
        )}
      </div>

      {/* ── Purchase Confirmation Modal ───────────────────────────────── */}
      {buyTarget && (
        <Modal isOpen onClose={() => setBuyTarget(null)} title="Confirm Purchase" size="sm">
          <div className="space-y-4">
            {(() => {
              const style = PLAN_STYLE[buyTarget.plan.duration_months] || PLAN_STYLE[1]
              const expiry = format(addMonths(new Date(), buyTarget.plan.duration_months), 'dd MMM yyyy')
              return (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Item</span>
                      <span className="font-semibold text-gray-900 text-right max-w-[180px]">{buyTarget.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Type</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.tag}`}>{buyTarget.type === 'group' ? 'Group Bundle' : 'Single Template'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Duration</span>
                      <span className="font-semibold text-gray-900">{style.label}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Valid Until</span>
                      <span className="font-semibold text-gray-900">{expiry}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                      <span className="font-semibold text-gray-700">Amount</span>
                      <span className="text-xl font-bold text-gray-900">₹{buyTarget.plan.price.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBuyTarget(null)}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 ${style.btnBg}`}
                    >
                      {purchasing ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Processing…
                        </>
                      ) : `Confirm — ₹${buyTarget.plan.price.toLocaleString()}`}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </Modal>
      )}
    </div>
  )
}
