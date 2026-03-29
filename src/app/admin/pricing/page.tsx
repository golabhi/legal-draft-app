'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'

interface TemplateGroup {
  id: string
  name: string
  description: string | null
  is_free: boolean
}

interface Template {
  id: string
  name: string
  is_free: boolean
  price: number
  template_group_id: string | null
  template_groups?: { name: string }
}

// Groups use 3-plan pricing via purchase_plans
type GroupPriceState = {
  is_free: boolean
  plan_1m: number
  plan_3m: number
  plan_6m: number
  dirty: boolean
  saved: boolean
  saving: boolean
}

// Templates use a single fixed price (1-month validity)
type TemplatePriceState = {
  is_free: boolean
  price: number
  dirty: boolean
  saved: boolean
  saving: boolean
}

const PLANS = [
  { key: 'plan_1m' as const, months: 1, badge: '1M', label: '1 Month',  cardCls: 'bg-blue-50 border-blue-100',    tagCls: 'bg-blue-100 text-blue-700' },
  { key: 'plan_3m' as const, months: 3, badge: '3M', label: '3 Months', cardCls: 'bg-purple-50 border-purple-100', tagCls: 'bg-purple-100 text-purple-700' },
  { key: 'plan_6m' as const, months: 6, badge: '6M', label: '6 Months', cardCls: 'bg-green-50 border-green-100',   tagCls: 'bg-green-100 text-green-700' },
]

// ── Group plan row (1M / 3M / 6M inputs) ───────────────────────────────────
function GroupPlanRow({ name, description, state, onUpdate, onSave }: {
  name: string
  description?: string | null
  state: GroupPriceState
  onUpdate: (patch: Partial<GroupPriceState>) => void
  onSave: () => void
}) {
  return (
    <div className="px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">{name}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>}
          {state.dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />Unsaved changes
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onUpdate({ is_free: true })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
              state.is_free ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
          >Free</button>
          <button
            onClick={() => onUpdate({ is_free: false })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
              !state.is_free ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
          >Paid</button>
        </div>
      </div>

      {state.is_free ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg w-fit">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-green-700">Free Access</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map(({ key, badge, label, cardCls, tagCls }) => (
            <div key={key} className={`border rounded-xl p-3 ${cardCls}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${tagCls}`}>{badge}</span>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  value={state[key] || ''}
                  onChange={(e) => onUpdate({ [key]: parseFloat(e.target.value) || 0 })}
                  min={0}
                  placeholder="0"
                  className="w-full pl-6 pr-2 py-1.5 border border-white bg-white rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              {state[key] === 0 && <p className="text-xs text-gray-400 mt-1">Disabled</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-3">
        {state.saving ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500">
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>Saving…
          </span>
        ) : state.saved ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>Saved
          </span>
        ) : (
          <button
            onClick={onSave}
            disabled={!state.dirty}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              state.dirty ? 'bg-navy-800 hover:bg-navy-900 text-white shadow-sm' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >Save Plans</button>
        )}
      </div>
    </div>
  )
}

// ── Template single-price row ───────────────────────────────────────────────
function TemplatePriceRow({ name, state, onUpdate, onSave }: {
  name: string
  state: TemplatePriceState
  onUpdate: (patch: Partial<TemplatePriceState>) => void
  onSave: () => void
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">{name}</p>
        {state.dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />Unsaved
          </span>
        )}
      </div>

      {/* Free / Paid toggle */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => onUpdate({ is_free: true })}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
            state.is_free ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >Free</button>
        <button
          onClick={() => onUpdate({ is_free: false })}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
            !state.is_free ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >Paid</button>
      </div>

      {/* Price input */}
      <div className="w-36 flex-shrink-0">
        {state.is_free ? (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-xs font-semibold text-green-700">Free</span>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input
              type="number"
              value={state.price || ''}
              onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
              min={0}
              placeholder="0"
              className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex-shrink-0 w-20 text-right">
        {state.saving ? (
          <svg className="animate-spin w-4 h-4 text-gray-400 inline" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : state.saved ? (
          <span className="text-xs font-medium text-green-600">✓ Saved</span>
        ) : (
          <button
            onClick={onSave}
            disabled={!state.dirty}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              state.dirty ? 'bg-navy-800 hover:bg-navy-900 text-white' : 'text-gray-300 cursor-not-allowed'
            }`}
          >Save</button>
        )}
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [groups, setGroups]       = useState<TemplateGroup[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')

  const [groupState, setGroupState]       = useState<Record<string, GroupPriceState>>({})
  const [templateState, setTemplateState] = useState<Record<string, TemplatePriceState>>({})

  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const fetchData = async () => {
    setLoading(true)
    const [{ data: g }, { data: t }, { data: plans }] = await Promise.all([
      supabase.from('template_groups').select('id, name, description, is_free').order('name'),
      supabase.from('templates').select('id, name, is_free, price, template_group_id, template_groups(name)').order('name'),
      supabase.from('purchase_plans').select('*'),
    ])

    const gList    = g     || []
    const tList    = t     || []
    const planList = plans || []

    setGroups(gList)
    setTemplates(tList)

    // Group state — uses 3 plans
    const gState: Record<string, GroupPriceState> = {}
    gList.forEach((x) => {
      const gPlans = planList.filter((p: any) => p.template_group_id === x.id)
      gState[x.id] = {
        is_free: x.is_free,
        plan_1m: gPlans.find((p: any) => p.duration_months === 1)?.price ?? 0,
        plan_3m: gPlans.find((p: any) => p.duration_months === 3)?.price ?? 0,
        plan_6m: gPlans.find((p: any) => p.duration_months === 6)?.price ?? 0,
        dirty: false, saved: false, saving: false,
      }
    })

    // Template state — single fixed price
    const tState: Record<string, TemplatePriceState> = {}
    tList.forEach((x) => {
      tState[x.id] = {
        is_free: x.is_free,
        price: x.price ?? 0,
        dirty: false, saved: false, saving: false,
      }
    })

    setGroupState(gState)
    setTemplateState(tState)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const updateGroupLocal = (id: string, patch: Partial<GroupPriceState>) =>
    setGroupState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true, saved: false } }))

  const updateTemplateLocal = (id: string, patch: Partial<TemplatePriceState>) =>
    setTemplateState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true, saved: false } }))

  const saveGroup = async (group: TemplateGroup) => {
    const s = groupState[group.id]
    if (!s) return
    setGroupState((prev) => ({ ...prev, [group.id]: { ...prev[group.id], saving: true } }))
    await supabase.from('template_groups').update({ is_free: s.is_free, price: s.is_free ? 0 : s.plan_1m }).eq('id', group.id)
    await supabase.from('purchase_plans').delete().eq('template_group_id', group.id)
    if (!s.is_free) {
      const newPlans = PLANS
        .filter(({ key }) => s[key] > 0)
        .map(({ months, key }) => ({ template_group_id: group.id, duration_months: months, price: s[key], is_active: true }))
      if (newPlans.length > 0) await supabase.from('purchase_plans').insert(newPlans)
    }
    setGroupState((prev) => ({ ...prev, [group.id]: { ...prev[group.id], saving: false, dirty: false, saved: true } }))
    setTimeout(() => setGroupState((prev) => ({ ...prev, [group.id]: { ...prev[group.id], saved: false } })), 2000)
    showToast(`"${group.name}" updated`)
  }

  const saveTemplate = async (tpl: Template) => {
    const s = templateState[tpl.id]
    if (!s) return
    setTemplateState((prev) => ({ ...prev, [tpl.id]: { ...prev[tpl.id], saving: true } }))
    const price = s.is_free ? 0 : s.price
    await supabase.from('templates').update({ is_free: s.is_free, price }).eq('id', tpl.id)
    setTemplateState((prev) => ({ ...prev, [tpl.id]: { ...prev[tpl.id], saving: false, dirty: false, saved: true } }))
    setTimeout(() => setTemplateState((prev) => ({ ...prev, [tpl.id]: { ...prev[tpl.id], saved: false } })), 2000)
    showToast(`"${tpl.name}" updated`)
  }

  const paidGroups    = groups.filter((g) => !g.is_free).length
  const freeGroups    = groups.filter((g) =>  g.is_free).length
  const paidTemplates = templates.filter((t) => !t.is_free).length
  const freeTemplates = templates.filter((t) =>  t.is_free).length

  const templateSections = useMemo(() => {
    const map: Record<string, { groupName: string; items: Template[] }> = {}
    const ungrouped: Template[] = []
    templates.forEach((t) => {
      if (t.template_group_id && t.template_groups?.name) {
        if (!map[t.template_group_id]) map[t.template_group_id] = { groupName: t.template_groups.name, items: [] }
        map[t.template_group_id].items.push(t)
      } else {
        ungrouped.push(t)
      }
    })
    return [
      ...Object.entries(map).map(([id, v]) => ({ id, ...v })),
      ...(ungrouped.length > 0 ? [{ id: 'ungrouped', groupName: 'Ungrouped Templates', items: ungrouped }] : []),
    ]
  }, [templates])

  return (
    <div>
      <Header title="Pricing" subtitle="Set plan pricing for groups and fixed prices for individual templates" />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">{toast}</div>
      )}

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Paid Groups',    value: paidGroups,    color: 'bg-blue-600',    icon: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' },
                { label: 'Free Groups',    value: freeGroups,    color: 'bg-green-600',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                { label: 'Paid Templates', value: paidTemplates, color: 'bg-purple-600',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { label: 'Free Templates', value: freeTemplates, color: 'bg-emerald-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className={`${c.color} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="text-xl font-bold text-gray-900">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Group Plans — 1M / 3M / 6M */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Template Group Plans</h2>
                <p className="text-xs text-gray-400 mt-0.5">Set 1-month, 3-month, and 6-month plan prices. Lawyers choose their duration at checkout.</p>
              </div>
              {groups.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No template groups yet</div>
              ) : (
                <div>
                  {groups.map((group) => {
                    const s = groupState[group.id]
                    if (!s) return null
                    return (
                      <GroupPlanRow
                        key={group.id}
                        name={group.name}
                        description={group.description}
                        state={s}
                        onUpdate={(patch) => updateGroupLocal(group.id, patch)}
                        onSave={() => saveGroup(group)}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Individual Template Pricing — single fixed price */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Individual Template Pricing</h2>
                <p className="text-xs text-gray-400 mt-0.5">Single fixed price per template — 1-month access from purchase date.</p>
              </div>
              {templates.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No templates yet</div>
              ) : (
                <div>
                  {templateSections.map(({ id: sectionId, groupName, items }) => (
                    <div key={sectionId}>
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50/80 border-b border-gray-100">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-600">{groupName}</span>
                        <span className="text-xs text-gray-400">— {items.length} template{items.length !== 1 ? 's' : ''}</span>
                      </div>
                      {items.map((tpl) => {
                        const s = templateState[tpl.id]
                        if (!s) return null
                        return (
                          <TemplatePriceRow
                            key={tpl.id}
                            name={tpl.name}
                            state={s}
                            onUpdate={(patch) => updateTemplateLocal(tpl.id, patch)}
                            onSave={() => saveTemplate(tpl)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">How pricing works</p>
                <ul className="text-xs text-amber-700 mt-1 space-y-1 leading-relaxed list-disc list-inside">
                  <li><strong>Template Groups</strong> — lawyers choose a 1M / 3M / 6M plan and get access to all templates in the group.</li>
                  <li><strong>Individual Templates</strong> — single fixed price, always grants 1-month access from purchase date.</li>
                  <li>Leave a group plan at ₹0 to disable that duration option.</li>
                  <li>Changes only affect new purchases, not existing active ones.</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
