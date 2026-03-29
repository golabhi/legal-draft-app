'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'

interface Template {
  id: string
  name: string
  description: string | null
  variables: string[]
  is_free: boolean
  is_restricted: boolean
  price: number
  file_url: string | null
  template_group_id: string | null
}

interface TemplateGroup {
  id: string
  name: string
  description: string | null
  is_free: boolean
  is_restricted: boolean
  price: number
  templates: Template[]
}

interface PurchaseRecord {
  template_group_id: string | null
  template_id: string | null
}

type FilterTab = 'all' | 'available' | 'purchased' | 'free'

export default function TemplateMarketplacePage() {
  const [groups, setGroups]               = useState<TemplateGroup[]>([])
  const [ungrouped, setUngrouped]         = useState<Template[]>([])
  const [purchases, setPurchases]         = useState<PurchaseRecord[]>([])
  const [loading, setLoading]             = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [buyModalOpen, setBuyModalOpen]   = useState(false)
  const [buying, setBuying]               = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')
  const [activeTab, setActiveTab]         = useState<FilterTab>('all')
  const [search, setSearch]               = useState('')

  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date().toISOString()
    const [{ data: tpls }, { data: purchaseData }, { data: groupData }, { data: accessData }] = await Promise.all([
      supabase.from('templates').select('*').order('name'),
      supabase.from('purchases').select('template_group_id, template_id').eq('lawyer_id', user.id).eq('is_active', true).or(`expiry_date.is.null,expiry_date.gt.${now}`),
      supabase.from('template_groups').select('*').order('name'),
      supabase.from('template_access').select('template_id, template_group_id').eq('lawyer_id', user.id),
    ])

    const accessGrantGroupIds    = new Set((accessData || []).map((a: any) => a.template_group_id).filter(Boolean))
    const accessGrantTemplateIds = new Set((accessData || []).map((a: any) => a.template_id).filter(Boolean))
    const restrictedGroupIds     = new Set((groupData || []).filter((g: any) => g.is_restricted === true).map((g: any) => g.id))

    // Filter templates the user is allowed to see
    const visibleTemplates = (tpls || []).filter((t: any) => {
      const tplRestricted   = t.is_restricted === true
      const groupRestricted = t.template_group_id && restrictedGroupIds.has(t.template_group_id)
      if (!tplRestricted && !groupRestricted) return true
      if (tplRestricted && accessGrantTemplateIds.has(t.id)) return true
      if (groupRestricted && accessGrantGroupIds.has(t.template_group_id)) return true
      return false
    })

    // Filter groups the user is allowed to see
    const visibleGroupData = (groupData || []).filter((g: any) => {
      if (g.is_restricted !== true) return true
      return accessGrantGroupIds.has(g.id)
    })

    setPurchases(purchaseData || [])
    const allTemplates: Template[] = visibleTemplates
    const allGroups: TemplateGroup[] = visibleGroupData.map((g: any) => ({
      ...g,
      templates: allTemplates.filter((t) => t.template_group_id === g.id),
    })).filter((g: TemplateGroup) => g.templates.length > 0)

    setGroups(allGroups)
    setUngrouped(allTemplates.filter((t) => !t.template_group_id))
    setExpandedGroups(new Set(allGroups.map((g) => g.id)))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const purchasedGroupIds   = useMemo(() => new Set(purchases.filter((p) => p.template_group_id).map((p) => p.template_group_id!)), [purchases])
  const purchasedTemplateIds = useMemo(() => new Set(purchases.filter((p) => p.template_id).map((p) => p.template_id!)), [purchases])

  const canAccess = (tpl: Template) => {
    if (tpl.is_free) return true
    if (tpl.template_group_id && purchasedGroupIds.has(tpl.template_group_id)) return true
    if (purchasedTemplateIds.has(tpl.id)) return true
    return false
  }

  const allTemplates = useMemo(() => [...groups.flatMap((g) => g.templates), ...ungrouped], [groups, ungrouped])

  // Stats
  const totalCount     = allTemplates.length
  const accessCount    = allTemplates.filter(canAccess).length
  const freeCount      = allTemplates.filter((t) => t.is_free).length
  const purchasedCount = allTemplates.filter((t) => !t.is_free && canAccess(t)).length
  const buyableCount   = allTemplates.filter((t) => !canAccess(t)).length

  // Filter templates by tab
  const passesTab = (tpl: Template): boolean => {
    if (activeTab === 'available') return !canAccess(tpl)
    if (activeTab === 'purchased') return !tpl.is_free && canAccess(tpl)
    if (activeTab === 'free') return tpl.is_free
    return true
  }

  const passesSearch = (tpl: Template) => {
    if (!search) return true
    const q = search.toLowerCase()
    return tpl.name.toLowerCase().includes(q) || (tpl.description || '').toLowerCase().includes(q)
  }

  const passesFilter = (tpl: Template) => passesTab(tpl) && passesSearch(tpl)

  // Build filtered groups
  const filteredGroups = useMemo(() => groups.map((g) => ({
    ...g,
    templates: g.templates.filter(passesFilter),
  })).filter((g) => g.templates.length > 0), [groups, activeTab, search, purchases])

  const filteredUngrouped = useMemo(() => ungrouped.filter(passesFilter), [ungrouped, activeTab, search, purchases])

  // Cart
  const allPurchasable    = allTemplates.filter((t) => !canAccess(t))
  const allSelected       = allPurchasable.length > 0 && allPurchasable.every((t) => selectedIds.has(t.id))
  const allTemplatesMap   = useMemo(() => new Map(allTemplates.map((t) => [t.id, t])), [allTemplates])
  const selectedTemplates = Array.from(selectedIds).map((id) => allTemplatesMap.get(id)).filter(Boolean) as Template[]
  const totalPrice        = selectedTemplates.reduce((s, t) => s + t.price, 0)

  const toggleExpand  = (id: string) => setExpandedGroups((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelect  = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(allPurchasable.map((t) => t.id)))
  const toggleGroup   = (group: TemplateGroup) => {
    const purchasable = group.templates.filter((t) => !canAccess(t))
    const allSel = purchasable.length > 0 && purchasable.every((t) => selectedIds.has(t.id))
    setSelectedIds((prev) => {
      const n = new Set(prev)
      allSel ? purchasable.forEach((t) => n.delete(t.id)) : purchasable.forEach((t) => n.add(t.id))
      return n
    })
  }

  const handlePurchase = async () => {
    setBuying(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)
    const inserts = selectedTemplates.map((t) => ({
      lawyer_id: user.id,
      template_id: t.id,
      template_group_id: null,
      amount_paid: t.price,
      expiry_date: expiry.toISOString(),
      is_active: true,
    }))
    const { error: err } = await supabase.from('purchases').insert(inserts)
    if (err) { setError(err.message) }
    else {
      setSuccess(`${selectedTemplates.length} template${selectedTemplates.length > 1 ? 's' : ''} purchased successfully!`)
      setSelectedIds(new Set())
      await fetchData()
      setTimeout(() => { setBuyModalOpen(false); setSuccess('') }, 2000)
    }
    setBuying(false)
  }

  const tabs: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'all',       label: 'All Templates', count: totalCount,     color: 'text-gray-600' },
    { key: 'available', label: 'Available',      count: buyableCount,   color: 'text-orange-600' },
    { key: 'purchased', label: 'Purchased',       count: purchasedCount, color: 'text-green-600' },
    { key: 'free',      label: 'Free',            count: freeCount,      color: 'text-blue-600' },
  ]

  // Template row component
  const TemplateRow = ({ tpl, indent = false }: { tpl: Template; indent?: boolean }) => {
    const accessible = canAccess(tpl)
    const selected   = selectedIds.has(tpl.id)
    const isPurchased = !tpl.is_free && purchasedTemplateIds.has(tpl.id)
    const isGroupPurchased = tpl.template_group_id ? purchasedGroupIds.has(tpl.template_group_id) : false

    return (
      <div
        className={`flex items-start gap-3 py-3.5 pr-5 border-b border-gray-50 last:border-0 transition-all ${
          indent ? 'pl-14' : 'pl-5'
        } ${selected ? 'bg-orange-50/60' : 'hover:bg-gray-50/50'} ${!accessible ? 'cursor-pointer' : ''}`}
        onClick={() => !accessible && toggleSelect(tpl.id)}
      >
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            disabled={accessible}
            onChange={() => !accessible && toggleSelect(tpl.id)}
            className="w-4 h-4 rounded border-gray-300 accent-orange-500 disabled:opacity-0 cursor-pointer"
          />
        </div>

        {/* Doc icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accessible ? 'bg-green-100' : selected ? 'bg-orange-100' : 'bg-gray-100'
        }`}>
          {accessible ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 ${selected ? 'text-orange-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-sm font-semibold truncate ${accessible ? 'text-gray-700' : 'text-gray-900'}`}>{tpl.name}</p>
              {tpl.description && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{tpl.description}</p>
              )}
            </div>
            {/* Price / Status badge */}
            <div className="flex-shrink-0">
              {tpl.is_free ? (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold">Free</span>
              ) : isGroupPurchased || isPurchased ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Purchased
                </span>
              ) : selected ? (
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold">₹{tpl.price.toLocaleString()}</span>
              ) : (
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold">₹{tpl.price.toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {(tpl.variables?.length || 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {tpl.variables.length} variable{tpl.variables.length !== 1 ? 's' : ''}
              </span>
            )}
            {tpl.file_url && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                .docx ready
              </span>
            )}
            {selected && !accessible && (
              <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Added to cart
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isEmpty = filteredGroups.length === 0 && filteredUngrouped.length === 0

  return (
    <div className="pb-24">
      <Header title="Template Marketplace" subtitle="Browse and purchase legal document templates" />

      <div className="p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : (
          <>
            {/* ── Stats row ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Templates', value: totalCount,
                  color: 'bg-navy-800', textColor: 'text-navy-800',
                  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                  sub: `${accessCount} accessible`,
                },
                {
                  label: 'Purchased', value: purchasedCount,
                  color: 'bg-green-600', textColor: 'text-green-700',
                  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                  sub: 'Active licenses',
                },
                {
                  label: 'Free Access', value: freeCount,
                  color: 'bg-blue-600', textColor: 'text-blue-700',
                  icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
                  sub: 'No purchase needed',
                },
                {
                  label: 'Available to Buy', value: buyableCount,
                  color: 'bg-orange-500', textColor: 'text-orange-600',
                  icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
                  sub: 'Ready to purchase',
                },
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
                    <p className="text-xs text-gray-400">{c.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Filters ────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                {/* Tab filters */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                        activeTab === tab.key ? `${tab.color}` : 'text-gray-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>

                {/* Select all (only when 'all' or 'available' tab) */}
                {allPurchasable.length > 0 && (activeTab === 'all' || activeTab === 'available') && (
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-orange-500 cursor-pointer"
                    />
                    Select all
                  </label>
                )}
              </div>

              {/* Empty state */}
              {isEmpty ? (
                <div className="py-20 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-600">
                    {search ? 'No templates match your search' :
                     activeTab === 'available' ? 'No templates available to purchase' :
                     activeTab === 'purchased' ? 'You haven\'t purchased any templates yet' :
                     activeTab === 'free' ? 'No free templates available' :
                     'No templates available yet'}
                  </p>
                  {activeTab === 'purchased' && (
                    <button onClick={() => setActiveTab('available')} className="mt-3 text-sm text-navy-700 hover:underline">
                      Browse available templates →
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {/* Groups */}
                  {filteredGroups.map((group) => {
                    const purchasable    = group.templates.filter((t) => !canAccess(t))
                    const groupAllSelected = purchasable.length > 0 && purchasable.every((t) => selectedIds.has(t.id))
                    const isExpanded     = expandedGroups.has(group.id)
                    const groupPurchased = purchasedGroupIds.has(group.id)
                    const accessedCount  = group.templates.filter(canAccess).length

                    return (
                      <div key={group.id} className="border-b border-gray-100 last:border-0">
                        {/* Group header */}
                        <div className={`flex items-center gap-3 px-5 py-3.5 ${groupPurchased ? 'bg-green-50/60' : 'bg-gray-50/60'} border-b border-gray-100`}>
                          {/* Group checkbox */}
                          <input
                            type="checkbox"
                            checked={groupAllSelected}
                            disabled={purchasable.length === 0}
                            onChange={() => toggleGroup(group)}
                            className="w-4 h-4 rounded border-gray-300 accent-orange-500 disabled:opacity-0 cursor-pointer flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />

                          {/* Folder icon */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${groupPurchased ? 'bg-green-200' : 'bg-navy-800'}`}>
                            <svg className={`w-4 h-4 ${groupPurchased ? 'text-green-700' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                          </div>

                          {/* Group info */}
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(group.id)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900">{group.name}</p>
                              {groupPurchased && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Group Purchased
                                </span>
                              )}
                            </div>
                            {group.description && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{group.description}</p>
                            )}
                          </div>

                          {/* Stats + expand */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
                              <span>{group.templates.length} templates</span>
                              {accessedCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">{accessedCount} owned</span>
                              )}
                            </div>
                            <button onClick={() => toggleExpand(group.id)} className="p-1">
                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Template rows */}
                        {isExpanded && (
                          <div>
                            {group.templates.map((tpl) => (
                              <TemplateRow key={tpl.id} tpl={tpl} indent />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Ungrouped */}
                  {filteredUngrouped.length > 0 && (
                    <div className={filteredGroups.length > 0 ? 'border-t border-gray-100' : ''}>
                      {filteredGroups.length > 0 && (
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50/60 border-b border-gray-100">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-500">Other Templates</span>
                          <span className="text-xs text-gray-400">— {filteredUngrouped.length}</span>
                        </div>
                      )}
                      {filteredUngrouped.map((tpl) => (
                        <TemplateRow key={tpl.id} tpl={tpl} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Sticky Cart Bar ────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pb-4">
          <div className="w-full max-w-2xl bg-navy-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center justify-between gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedIds.size} template{selectedIds.size > 1 ? 's' : ''} selected</p>
                <p className="text-xs text-white/50">Total: <span className="text-white font-bold">₹{totalPrice.toLocaleString()}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 text-xs text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                Clear
              </button>
              <button
                onClick={() => { setError(''); setSuccess(''); setBuyModalOpen(true) }}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-bold transition-colors shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Purchase · ₹{totalPrice.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Purchase Confirmation Modal ─────────────────────────────────── */}
      <Modal isOpen={buyModalOpen} onClose={() => setBuyModalOpen(false)} title="Confirm Purchase">
        <div className="space-y-4">
          {error   && <div className="bg-red-50   text-red-600   text-sm px-3 py-2.5 rounded-lg border border-red-100">{error}</div>}
          {success && <div className="bg-green-50 text-green-700 text-sm px-3 py-2.5 rounded-lg border border-green-100 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>}

          {/* Items */}
          <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden max-h-52 overflow-y-auto">
            {selectedTemplates.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-navy-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">1-year license</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 flex-shrink-0">₹{t.price.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{selectedTemplates.length} template{selectedTemplates.length > 1 ? 's' : ''} · 1-year access each</p>
              <p className="text-xs text-gray-400 mt-0.5">Access expires one year from today</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-2xl font-bold text-navy-900">₹{totalPrice.toLocaleString()}</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            In production, this connects to a payment gateway before granting access.
          </p>

          <div className="flex gap-3">
            <button onClick={() => setBuyModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={buying || !!success}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {buying ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</>
              ) : `Confirm Purchase · ₹${totalPrice.toLocaleString()}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
