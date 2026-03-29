'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { format } from 'date-fns'

interface TemplateGroup {
  id: string
  name: string
  description: string | null
  is_free: boolean
  is_restricted: boolean
  price: number
  created_at: string
}

interface AccessGrant {
  id: string
  lawyer_id: string
}

interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
}

interface GroupStats {
  templateCount: number
  purchaseCount: number
  revenue: number
  activeCount: number
}

export default function TemplateGroupsPage() {
  const [groups, setGroups]         = useState<TemplateGroup[]>([])
  const [statsMap, setStatsMap]     = useState<Record<string, GroupStats>>({})
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<TemplateGroup | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TemplateGroup | null>(null)
  const [error, setError]           = useState('')
  const [toast, setToast]           = useState('')
  const [search, setSearch]         = useState('')
  const [form, setForm]             = useState({ name: '', description: '', is_free: false, is_restricted: false, plan_1m: 0, plan_3m: 0, plan_6m: 0 })

  // Access management
  const [accessModal, setAccessModal]     = useState(false)
  const [accessTarget, setAccessTarget]   = useState<TemplateGroup | null>(null)
  const [accessGrants, setAccessGrants]   = useState<AccessGrant[]>([])
  const [allUsers, setAllUsers]           = useState<UserProfile[]>([])
  const [userSearch, setUserSearch]       = useState('')
  const [addingUser, setAddingUser]       = useState<string | null>(null)
  const [removingGrant, setRemovingGrant] = useState<string | null>(null)

  const supabase = createClient()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchData = async () => {
    setLoading(true)
    const [{ data: groupData }, { data: templateData }, { data: purchaseData }] = await Promise.all([
      supabase.from('template_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('templates').select('id, template_group_id'),
      supabase.from('purchases').select('template_group_id, amount_paid, is_active'),
    ])

    setGroups(groupData || [])

    // Build stats per group
    const stats: Record<string, GroupStats> = {}
    for (const g of groupData || []) {
      const templates  = (templateData || []).filter((t) => t.template_group_id === g.id)
      const purchases  = (purchaseData  || []).filter((p) => p.template_group_id === g.id)
      stats[g.id] = {
        templateCount: templates.length,
        purchaseCount: purchases.length,
        activeCount:   purchases.filter((p) => p.is_active).length,
        revenue:       purchases.reduce((s, p) => s + (p.amount_paid || 0), 0),
      }
    }
    setStatsMap(stats)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', is_free: false, is_restricted: false, plan_1m: 0, plan_3m: 0, plan_6m: 0 })
    setError('')
    setModalOpen(true)
  }

  const openEdit = async (group: TemplateGroup) => {
    setEditing(group)
    setForm({ name: group.name, description: group.description || '', is_free: group.is_free, is_restricted: group.is_restricted ?? false, plan_1m: 0, plan_3m: 0, plan_6m: 0 })
    setError('')
    setModalOpen(true)
    // Load existing plans
    const { data: plans } = await supabase.from('purchase_plans').select('duration_months, price').eq('template_group_id', group.id)
    if (plans) {
      setForm((prev) => ({
        ...prev,
        plan_1m: plans.find((p) => p.duration_months === 1)?.price ?? 0,
        plan_3m: plans.find((p) => p.duration_months === 3)?.price ?? 0,
        plan_6m: plans.find((p) => p.duration_months === 6)?.price ?? 0,
      }))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      description: form.description || null,
      is_free: form.is_free,
      is_restricted: form.is_restricted,
      price: form.is_free ? 0 : form.plan_1m,
    }

    let groupId: string
    if (editing) {
      const { error: err } = await supabase.from('template_groups').update(payload).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
      groupId = editing.id
    } else {
      const { data, error: err } = await supabase.from('template_groups').insert(payload).select('id').single()
      if (err || !data) { setError(err?.message || 'Failed to create'); setSaving(false); return }
      groupId = data.id
    }

    // Upsert purchase plans
    if (!form.is_free) {
      await supabase.from('purchase_plans').delete().eq('template_group_id', groupId)
      const plans = [
        { duration_months: 1, price: form.plan_1m },
        { duration_months: 3, price: form.plan_3m },
        { duration_months: 6, price: form.plan_6m },
      ].filter((p) => p.price > 0).map((p) => ({ ...p, template_group_id: groupId, is_active: true }))
      if (plans.length > 0) await supabase.from('purchase_plans').insert(plans)
    }

    showToast(editing ? 'Group updated' : 'Group created')
    await fetchData()
    setModalOpen(false)
    setSaving(false)
  }

  const confirmDelete = (group: TemplateGroup) => {
    setDeleteTarget(group)
    setDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(deleteTarget.id)
    await supabase.from('template_groups').delete().eq('id', deleteTarget.id)
    showToast('Group deleted')
    await fetchData()
    setDeleting(null)
    setDeleteModal(false)
  }

  // ── Access Management ────────────────────────────────────────────────
  const openAccessModal = async (group: TemplateGroup) => {
    setAccessTarget(group)
    setAccessGrants([])
    setAllUsers([])
    setUserSearch('')
    setAccessModal(true)
    const [{ data: grants }, { data: users }] = await Promise.all([
      supabase.from('template_access').select('id, lawyer_id').eq('template_group_id', group.id),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'lawyer').order('full_name'),
    ])
    setAccessGrants(grants || [])
    setAllUsers(users || [])
  }

  const addUserAccess = async (userId: string) => {
    if (!accessTarget) return
    setAddingUser(userId)
    await supabase.from('template_access').insert({ lawyer_id: userId, template_group_id: accessTarget.id })
    const { data } = await supabase.from('template_access').select('id, lawyer_id').eq('template_group_id', accessTarget.id)
    setAccessGrants(data || [])
    setAddingUser(null)
  }

  const removeUserAccess = async (grantId: string) => {
    setRemovingGrant(grantId)
    await supabase.from('template_access').delete().eq('id', grantId)
    setAccessGrants((prev) => prev.filter((g) => g.id !== grantId))
    setRemovingGrant(null)
  }

  // Summary stats
  const totalGroups   = groups.length
  const freeGroups    = groups.filter((g) => g.is_free).length
  const paidGroups    = groups.filter((g) => !g.is_free).length
  const totalRevenue  = Object.values(statsMap).reduce((s, v) => s + v.revenue, 0)
  const totalPurchases = Object.values(statsMap).reduce((s, v) => s + v.purchaseCount, 0)

  const filtered = useMemo(() =>
    groups.filter((g) =>
      !search ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(search.toLowerCase())
    ), [groups, search])

  return (
    <div>
      <Header
        title="Template Groups"
        subtitle="Organise templates into purchasable bundles"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        }
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : (
          <>
            {/* ── Summary Stats ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Groups',    value: totalGroups,                          color: 'bg-navy-800',  icon: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' },
                { label: 'Paid Groups',     value: paidGroups,                           color: 'bg-blue-600',  icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { label: 'Free Groups',     value: freeGroups,                           color: 'bg-green-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                { label: 'Total Purchases', value: totalPurchases,                       color: 'bg-purple-600',icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
                { label: 'Total Revenue',   value: `₹${totalRevenue.toLocaleString()}`,  color: 'bg-orange-500',icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
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

            {/* ── Search + List ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Toolbar */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search groups..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <span className="text-xs text-gray-400 ml-auto">{filtered.length} group{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Empty state */}
              {filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">
                    {search ? 'No groups match your search' : 'No template groups yet'}
                  </p>
                  {!search && (
                    <button onClick={openCreate} className="mt-3 text-sm text-navy-700 hover:underline">
                      Create your first group →
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map((group) => {
                    const s = statsMap[group.id] || { templateCount: 0, purchaseCount: 0, activeCount: 0, revenue: 0 }
                    return (
                      <div key={group.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50/60 transition-colors group">
                        {/* Icon */}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${group.is_free ? 'bg-green-100' : 'bg-navy-50'}`}>
                          <svg className={`w-5 h-5 ${group.is_free ? 'text-green-600' : 'text-navy-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h3 className="font-semibold text-gray-900 text-sm">{group.name}</h3>
                            {group.is_free ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Free</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                {group.price > 0 ? `from ₹${group.price.toLocaleString()}` : 'Paid'}
                              </span>
                            )}
                            {group.is_restricted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Restricted
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 mb-2">{group.description}</p>
                          )}

                          {/* Stat pills */}
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {s.templateCount} template{s.templateCount !== 1 ? 's' : ''}
                            </span>
                            <span className="text-gray-200">|</span>
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {s.purchaseCount} purchase{s.purchaseCount !== 1 ? 's' : ''}
                              {s.activeCount > 0 && (
                                <span className="ml-0.5 px-1.5 py-0 bg-green-100 text-green-700 rounded-full text-xs font-medium">{s.activeCount} active</span>
                              )}
                            </span>
                            {!group.is_free && s.revenue > 0 && (
                              <>
                                <span className="text-gray-200">|</span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-navy-700">
                                  ₹{s.revenue.toLocaleString()} earned
                                </span>
                              </>
                            )}
                            <span className="text-gray-200">|</span>
                            <span className="text-xs text-gray-400">
                              Created {format(new Date(group.created_at), 'dd MMM yyyy')}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {group.is_restricted && (
                            <button
                              onClick={() => openAccessModal(group)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Manage Access
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(group)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => confirmDelete(group)}
                            disabled={deleting === group.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>

                        {/* Always-visible edit button (mobile fallback) */}
                        <div className="flex items-center gap-2 flex-shrink-0 lg:hidden">
                          {group.is_restricted && (
                            <button onClick={() => openAccessModal(group)} className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg">Access</button>
                          )}
                          <button onClick={() => openEdit(group)} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg">Edit</button>
                          <button onClick={() => confirmDelete(group)} className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg">Delete</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Template Group' : 'New Template Group'}
      >
        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Group Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              placeholder="e.g., Property Law Bundle"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
              placeholder="Brief description of what templates are in this group..."
            />
          </div>

          {/* Pricing toggle */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <p className="text-sm font-medium text-gray-700">Pricing</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_free: true })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  form.is_free ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Free
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_free: false })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  !form.is_free ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
                </svg>
                Paid
              </button>
            </div>

            {!form.is_free && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan Prices</p>
                {([
                  { key: 'plan_1m', label: '1 Month',  badge: '1M', color: 'text-blue-600 bg-blue-50' },
                  { key: 'plan_3m', label: '3 Months', badge: '3M', color: 'text-purple-600 bg-purple-50' },
                  { key: 'plan_6m', label: '6 Months', badge: '6M', color: 'text-green-600 bg-green-50' },
                ] as const).map(({ key, label, badge, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg w-10 text-center flex-shrink-0 ${color}`}>{badge}</span>
                    <span className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                      <input
                        type="number"
                        value={form[key] || ''}
                        onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
                        min={0}
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-1">Leave 0 to disable that plan duration.</p>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Visibility</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_restricted: false })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  !form.is_restricted ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                All Users
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_restricted: true })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  form.is_restricted ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Specific Users Only
              </button>
            </div>
            {form.is_restricted && (
              <p className="text-xs text-amber-600 mt-2">
                This group will be hidden from all users. Use "Manage Access" to assign it to specific users after saving.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-navy-800 hover:bg-navy-900 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : editing ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Template Group">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Delete "{deleteTarget.name}"?</p>
                  <p className="text-xs text-red-600 mt-1">
                    This will delete the group permanently.
                    {(statsMap[deleteTarget.id]?.templateCount || 0) > 0 && (
                      <> The {statsMap[deleteTarget.id].templateCount} template{statsMap[deleteTarget.id].templateCount !== 1 ? 's' : ''} inside will become ungrouped.</>
                    )}
                    {(statsMap[deleteTarget.id]?.purchaseCount || 0) > 0 && (
                      <> {statsMap[deleteTarget.id].purchaseCount} purchase record{statsMap[deleteTarget.id].purchaseCount !== 1 ? 's' : ''} will lose their group reference.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!!deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Manage User Access Modal ─────────────────────────────────────── */}
      <Modal isOpen={accessModal} onClose={() => setAccessModal(false)} title={`Manage Access — ${accessTarget?.name}`} size="lg">
        {accessTarget && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              This group is <strong>restricted</strong>. Only users listed below can see and use its templates.
            </div>

            {/* Current users with access */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Users with Access ({accessGrants.length})
              </p>
              {accessGrants.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
                  No users assigned yet — search below to add users.
                </p>
              ) : (
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                  {accessGrants.map((g) => {
                    const profile = allUsers.find((u) => u.id === g.lawyer_id)
                    const name  = profile?.full_name || '—'
                    const email = profile?.email || ''
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-amber-700">
                            {(name !== '—' ? name : email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          <p className="text-xs text-gray-400 truncate">{email}</p>
                        </div>
                        <button
                          onClick={() => removeUserAccess(g.id)}
                          disabled={removingGrant === g.id}
                          className="px-2.5 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {removingGrant === g.id ? '...' : 'Remove'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Add users */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add User</p>
              <div className="relative mb-2">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              {(() => {
                const grantedIds = new Set(accessGrants.map((g) => g.lawyer_id))
                const filtered = allUsers.filter((u) => {
                  if (grantedIds.has(u.id)) return false
                  if (!userSearch) return true
                  const q = userSearch.toLowerCase()
                  return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                })
                if (allUsers.length === 0) return (
                  <div className="text-center py-4 text-sm text-gray-400">Loading users…</div>
                )
                if (filtered.length === 0) return (
                  <div className="text-center py-4 text-sm text-gray-400">
                    {userSearch ? 'No users match your search' : 'All lawyers already have access'}
                  </div>
                )
                return (
                  <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                    {filtered.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50">
                        <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-gray-500">
                            {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || '—'}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                        <button
                          onClick={() => addUserAccess(u.id)}
                          disabled={addingUser === u.id}
                          className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {addingUser === u.id ? '…' : '+ Grant'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            <button
              onClick={() => setAccessModal(false)}
              className="w-full px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
