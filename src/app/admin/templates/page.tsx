'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { format } from 'date-fns'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

interface Template {
  id: string
  name: string
  description: string | null
  file_url: string | null
  variables: string[]
  template_group_id: string | null
  is_free: boolean
  price: number
  language: string
  font_family: string
  created_at: string
  template_groups?: { name: string }
}

interface TemplateGroup {
  id: string
  name: string
  is_free: boolean
}

export default function TemplatesPage() {
  const [templates, setTemplates]         = useState<Template[]>([])
  const [groups, setGroups]               = useState<TemplateGroup[]>([])
  const [loading, setLoading]             = useState(true)
  const [modalOpen, setModalOpen]         = useState(false)
  const [editing, setEditing]             = useState<Template | null>(null)
  const [saving, setSaving]               = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [error, setError]                 = useState('')
  const [toast, setToast]                 = useState('')
  const [variableInput, setVariableInput] = useState('')
  const [autoExtracted, setAutoExtracted] = useState(0)
  const [search, setSearch]               = useState('')
  const [filterGroup, setFilterGroup]     = useState('all')
  const [filterPrice, setFilterPrice]     = useState<'all' | 'free' | 'paid'>('all')
  const [deleteModal, setDeleteModal]     = useState(false)
  const [deleteTarget, setDeleteTarget]   = useState<Template | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [deleteError, setDeleteError]     = useState('')
  const [expandedVars, setExpandedVars]   = useState<Set<string>>(new Set())

  const [form, setForm] = useState({
    name: '',
    description: '',
    template_group_id: '',
    is_free: true,
    price: 0,
    language: 'en',
    font_family: 'Times New Roman',
    variables: [] as string[],
    file_url: '',
  })

  const supabase = createClient()

  // Suggested fonts per language
  const LANG_FONTS: Record<string, string[]> = {
    en: ['Times New Roman', 'Arial', 'Calibri', 'Georgia'],
    gu: ['Noto Sans Gujarati', 'Shruti', 'Aakar', 'Rekha'],
    hi: ['Mangal', 'Noto Sans Devanagari', 'Kokila', 'Aparajita'],
    mr: ['Mangal', 'Noto Sans Devanagari', 'Shivaji', 'Saraswati'],
    ta: ['Noto Sans Tamil', 'Latha', 'Vijaya', 'TAMu_Kadambri'],
    te: ['Noto Sans Telugu', 'Gautami', 'Vani', 'Telugu MN'],
    kn: ['Noto Sans Kannada', 'Tunga', 'Kedage', 'Sampige'],
    ml: ['Noto Sans Malayalam', 'Kartika', 'Rachana', 'AnjaliOldLipi'],
    bn: ['Noto Sans Bengali', 'Vrinda', 'SolaimanLipi', 'Kalpurush'],
    pa: ['Noto Sans Gurmukhi', 'Raavi', 'Gurbani Lipi', 'AnmolUni'],
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchData = async () => {
    setLoading(true)
    const [{ data: tData }, { data: gData }] = await Promise.all([
      supabase.from('templates').select('*, template_groups(name)').order('created_at', { ascending: false }),
      supabase.from('template_groups').select('id, name, is_free').order('name'),
    ])
    setTemplates(tData || [])
    setGroups(gData || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', template_group_id: '', is_free: true, price: 0, language: 'en', font_family: 'Times New Roman', variables: [], file_url: '' })
    setVariableInput('')
    setAutoExtracted(0)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (tpl: Template) => {
    setEditing(tpl)
    setForm({
      name: tpl.name,
      description: tpl.description || '',
      template_group_id: tpl.template_group_id || '',
      is_free: tpl.is_free,
      price: tpl.price,
      language: tpl.language || 'en',
      font_family: tpl.font_family || 'Times New Roman',
      variables: tpl.variables || [],
      file_url: tpl.file_url || '',
    })
    setVariableInput('')
    setAutoExtracted(0)
    setError('')
    setModalOpen(true)
  }

  const extractVariablesFromDocx = async (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const PizZip = (await import('pizzip')).default
          const arrayBuffer = e.target?.result as ArrayBuffer
          const zip = new PizZip(arrayBuffer)
          const xmlContent = zip.file('word/document.xml')?.asText() || ''
          const matches = xmlContent.match(/\{\{([^}]+)\}\}/g) || []
          const vars = [...new Set(matches.map((m) => m.replace(/^\{\{|\}\}$/g, '').trim()))]
          resolve(vars)
        } catch { resolve([]) }
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const extractedVars = await extractVariablesFromDocx(file)
    if (extractedVars.length > 0) {
      setForm((prev) => {
        const merged = [...new Set([...prev.variables, ...extractedVars])]
        const newCount = merged.length - prev.variables.length
        if (newCount > 0) setAutoExtracted(newCount)
        return { ...prev, variables: merged }
      })
    }
    const fileName = `${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('templates').upload(fileName, file)
    if (error) { setError('Upload failed: ' + error.message) }
    else {
      const { data: urlData } = supabase.storage.from('templates').getPublicUrl(data.path)
      setForm((prev) => ({ ...prev, file_url: urlData.publicUrl }))
    }
    setUploading(false)
  }

  const addVariable = () => {
    const v = variableInput.trim()
    if (v && !form.variables.includes(v)) setForm({ ...form, variables: [...form.variables, v] })
    setVariableInput('')
  }

  const removeVariable = (v: string) => setForm({ ...form, variables: form.variables.filter((x) => x !== v) })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      description: form.description || null,
      template_group_id: form.template_group_id || null,
      is_free: form.is_free,
      price: form.is_free ? 0 : form.price,
      language: form.language || 'en',
      font_family: form.font_family || 'Times New Roman',
      variables: form.variables,
      file_url: form.file_url || null,
    }
    const { error: err } = editing
      ? await supabase.from('templates').update(payload).eq('id', editing.id)
      : await supabase.from('templates').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    showToast(editing ? 'Template updated' : 'Template created')
    await fetchData()
    setModalOpen(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')

    // Nullify FK references in documents and purchases before deleting
    await Promise.all([
      supabase.from('documents').update({ template_id: null }).eq('template_id', deleteTarget.id),
      supabase.from('purchases').update({ template_id: null }).eq('template_id', deleteTarget.id),
    ])

    const { error: err } = await supabase.from('templates').delete().eq('id', deleteTarget.id)
    if (err) {
      setDeleteError(err.message)
      setDeleting(false)
      return
    }

    showToast('Template deleted')
    await fetchData()
    setDeleting(false)
    setDeleteModal(false)
  }

  const toggleVars = (id: string) => {
    setExpandedVars((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Summary stats
  const totalTemplates = templates.length
  const freeTemplates  = templates.filter((t) => t.is_free).length
  const paidTemplates  = templates.filter((t) => !t.is_free).length
  const withFile       = templates.filter((t) => !!t.file_url).length
  const totalVars      = templates.reduce((s, t) => s + (t.variables?.length || 0), 0)

  // Filter
  const filtered = useMemo(() => templates.filter((t) => {
    const q = search.toLowerCase()
    if (q && !t.name.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false
    if (filterGroup !== 'all' && (t.template_group_id || 'ungrouped') !== filterGroup) return false
    if (filterPrice === 'free' && !t.is_free) return false
    if (filterPrice === 'paid' && t.is_free) return false
    return true
  }), [templates, search, filterGroup, filterPrice])

  // Group sections
  const sections = useMemo(() => {
    const groupMap: Record<string, { groupName: string; is_free: boolean; items: Template[] }> = {}
    const ungrouped: Template[] = []
    filtered.forEach((tpl) => {
      if (tpl.template_group_id && tpl.template_groups?.name) {
        const key = tpl.template_group_id
        if (!groupMap[key]) {
          const g = groups.find((g) => g.id === key)
          groupMap[key] = { groupName: tpl.template_groups.name, is_free: g?.is_free ?? false, items: [] }
        }
        groupMap[key].items.push(tpl)
      } else {
        ungrouped.push(tpl)
      }
    })
    return [
      ...Object.entries(groupMap).map(([id, v]) => ({ id, ...v })),
      ...(ungrouped.length > 0 ? [{ id: 'ungrouped', groupName: 'Ungrouped', is_free: false, items: ungrouped }] : []),
    ]
  }, [filtered, groups])

  return (
    <div>
      <Header
        title="Templates"
        subtitle="Manage legal document templates"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </button>
        }
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : (
          <>
            {/* ── Summary Stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total',       value: totalTemplates, color: 'bg-navy-800',    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { label: 'Free',        value: freeTemplates,  color: 'bg-green-600',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                { label: 'Paid',        value: paidTemplates,  color: 'bg-blue-600',    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { label: 'With File',   value: withFile,       color: 'bg-emerald-600', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                { label: 'Variables',   value: totalVars,      color: 'bg-purple-600',  icon: 'M4 6h16M4 12h16M4 18h7' },
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

            {/* ── Filters ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
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
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white text-gray-700"
                >
                  <option value="all">All Groups</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  <option value="ungrouped">Ungrouped</option>
                </select>
                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg gap-0.5">
                  {(['all', 'free', 'paid'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFilterPrice(v)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                        filterPrice === v ? 'bg-white text-navy-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-gray-400">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Empty state */}
              {filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">
                    {search || filterGroup !== 'all' || filterPrice !== 'all' ? 'No templates match your filters' : 'No templates yet'}
                  </p>
                  {!search && filterGroup === 'all' && filterPrice === 'all' && (
                    <button onClick={openCreate} className="mt-3 text-sm text-navy-700 hover:underline">Add your first template →</button>
                  )}
                </div>
              ) : (
                /* ── Table ──────────────────────────────────────────────── */
                <div>
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1fr_90px_120px_120px_100px_130px] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                    {['Template', 'Group', 'Language', 'Variables', 'Price', 'File', 'Actions'].map((h) => (
                      <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>

                  {sections.map(({ id, groupName, is_free, items }) => (
                    <div key={id}>
                      {/* Group separator */}
                      <div className={`flex items-center gap-2 px-5 py-2 border-b border-gray-100 ${
                        id === 'ungrouped' ? 'bg-gray-50' : is_free ? 'bg-green-50' : 'bg-blue-50'
                      }`}>
                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${id === 'ungrouped' ? 'text-gray-400' : is_free ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                        <span className={`text-xs font-semibold ${id === 'ungrouped' ? 'text-gray-500' : is_free ? 'text-green-700' : 'text-blue-700'}`}>{groupName}</span>
                        <span className="text-xs text-gray-400">— {items.length} template{items.length !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Template rows */}
                      {items.map((tpl) => {
                        const varsExpanded = expandedVars.has(tpl.id)
                        const varCount = tpl.variables?.length || 0
                        return (
                          <div key={tpl.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors group">
                            <div className="grid grid-cols-[2fr_1fr_90px_120px_120px_100px_130px] gap-4 items-center px-5 py-3.5">
                              {/* Template name */}
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{tpl.name}</p>
                                {tpl.description && (
                                  <p className="text-xs text-gray-400 truncate mt-0.5">{tpl.description}</p>
                                )}
                                <p className="text-xs text-gray-300 mt-0.5">{format(new Date(tpl.created_at), 'dd MMM yyyy')}</p>
                              </div>

                              {/* Group */}
                              <div className="min-w-0">
                                {tpl.template_groups?.name ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium truncate max-w-full ${
                                    is_free ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                                  }`}>
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                                    </svg>
                                    <span className="truncate">{tpl.template_groups.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300 italic">No group</span>
                                )}
                              </div>

                              {/* Language */}
                              <div className="min-w-0">
                                {(() => {
                                  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === (tpl.language || 'en'))
                                  return (
                                    <div>
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium">
                                        <span>{lang?.flag || '🌐'}</span>
                                        <span>{lang?.label || tpl.language || 'en'}</span>
                                      </span>
                                      {tpl.font_family && (
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{tpl.font_family}</p>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>

                              {/* Variables column */}
                              <div>
                                {varCount === 0 ? (
                                  <span className="text-xs text-gray-300">—</span>
                                ) : (
                                  <button
                                    onClick={() => toggleVars(tpl.id)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                      varsExpanded
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                    }`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                    </svg>
                                    {varCount} var{varCount !== 1 ? 's' : ''}
                                    <svg className={`w-3 h-3 transition-transform ${varsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {/* Price */}
                              <div>
                                {tpl.is_free ? (
                                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">Free</span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">₹{tpl.price.toLocaleString()}</span>
                                )}
                              </div>

                              {/* File */}
                              <div>
                                {tpl.file_url ? (
                                  <a
                                    href={tpl.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    .docx
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    No file
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEdit(tpl)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setDeleteTarget(tpl); setDeleteModal(true) }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </div>

                            {/* Variables expanded panel */}
                            {varsExpanded && varCount > 0 && (
                              <div className="px-5 pb-4 -mt-1">
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                  <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                    </svg>
                                    Template Variables ({varCount})
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {tpl.variables.map((v) => (
                                      <span key={v} className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-mono shadow-sm">
                                        {'{{'}{v}{'}}'}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Template' : 'New Template'} size="xl">
        <form onSubmit={handleSave} className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg border border-red-100">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              placeholder="e.g., Sale Deed Agreement"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
              placeholder="Brief description of this template..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Template Group</label>
              <select
                value={form.template_group_id}
                onChange={(e) => setForm({ ...form, template_group_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white"
              >
                <option value="">— No Group —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pricing</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_free: true })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    form.is_free ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
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
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    !form.is_free ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
                  </svg>
                  Paid
                </button>
              </div>
            </div>
          </div>

          {/* Language + Font */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-800">Template Language &amp; Font</p>
            <p className="text-xs text-orange-600">
              Select the language this template is written in. The font name will be auto-injected as{' '}
              <span className="font-mono bg-orange-100 px-1 rounded">{'{{font_family}}'}</span> and{' '}
              <span className="font-mono bg-orange-100 px-1 rounded">{'{{language_name}}'}</span> when generating — no manual entry needed.
            </p>

            <div>
              <label className="block text-xs font-medium text-orange-700 mb-2">Language</label>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      const suggested = (LANG_FONTS[lang.code] || ['Times New Roman'])[0]
                      setForm({ ...form, language: lang.code, font_family: suggested })
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                      form.language === lang.code
                        ? 'border-orange-500 bg-white text-orange-700 shadow-sm'
                        : 'border-transparent bg-white/60 text-gray-500 hover:bg-white'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-orange-700 mb-1.5">
                Font Family
                <span className="ml-2 font-normal text-orange-500">(used in the .docx template)</span>
              </label>
              <input
                type="text"
                value={form.font_family}
                onChange={(e) => setForm({ ...form, font_family: e.target.value })}
                className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                placeholder="e.g. Noto Sans Gujarati"
              />
              {LANG_FONTS[form.language]?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="text-xs text-orange-500">Suggestions:</span>
                  {LANG_FONTS[form.language].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setForm({ ...form, font_family: f })}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        form.font_family === f
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!form.is_free && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  min={0}
                  required
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template File (.docx)</label>
            <label className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-6 cursor-pointer transition-all ${
              form.file_url ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-navy-300 hover:bg-navy-50/30'
            }`}>
              {uploading ? (
                <>
                  <div className="animate-spin w-6 h-6 border-2 border-navy-200 border-t-navy-700 rounded-full" />
                  <p className="text-xs text-navy-600 font-medium">Uploading & extracting variables...</p>
                </>
              ) : form.file_url ? (
                <>
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-emerald-700">File uploaded</p>
                  {autoExtracted > 0 && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                      {autoExtracted} new variable{autoExtracted !== 1 ? 's' : ''} auto-extracted
                    </span>
                  )}
                  <p className="text-xs text-gray-400">Click to replace file</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Click to upload .docx</p>
                  <p className="text-xs text-gray-400">
                    Variables like <span className="font-mono text-indigo-500">{'{{party_name}}'}</span> are auto-extracted
                  </p>
                </>
              )}
              <input type="file" accept=".docx" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          {/* Variables */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Template Variables</label>
              {form.variables.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  {form.variables.length} variable{form.variables.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex gap-2 mb-2.5">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-mono">{'{{'}</span>
                <input
                  type="text"
                  value={variableInput}
                  onChange={(e) => setVariableInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVariable())}
                  className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="variable_name"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-mono">{'}}'}</span>
              </div>
              <button
                type="button"
                onClick={addVariable}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>

            {form.variables.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                {form.variables.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-mono shadow-sm">
                    {'{{'}{v}{'}}'}
                    <button type="button" onClick={() => removeVariable(v)} className="text-indigo-300 hover:text-red-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="py-5 text-center border border-dashed border-gray-200 rounded-xl">
                <p className="text-xs text-gray-400">No variables yet — upload a .docx to auto-extract</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || uploading || !form.name.trim()} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-navy-800 hover:bg-navy-900 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
              ) : editing ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <Modal isOpen={deleteModal} onClose={() => { setDeleteModal(false); setDeleteError('') }} title="Delete Template">
        {deleteTarget && (
          <div className="space-y-4">
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                {deleteError}
              </div>
            )}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Delete "{deleteTarget.name}"?</p>
                <p className="text-xs text-red-600 mt-1">
                  This will permanently remove the template. Any documents generated from it will keep their files but lose the template link.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteModal(false); setDeleteError('') }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Deleting...</>
                ) : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
