'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Link from 'next/link'
import { format } from 'date-fns'
import { SUPPORTED_LANGUAGES, getVarLabel, LANG_STORAGE_KEY } from '@/lib/languages'
import TransliterateInput from '@/components/TransliterateInput'

interface Template {
  id: string
  name: string
  description: string | null
  variables: string[]
  is_free: boolean
  price: number
  language: string
  template_group_id: string | null
  template_groups?: { name: string; is_free: boolean }
}

interface Document {
  id: string
  file_name: string | null
  file_url: string | null
  created_at: string
  templates?: { name: string }
}

interface CaseDetail {
  id: string
  title: string
  case_type: string | null
  status: string
  notes: string | null
  created_at: string
  clients?: { name: string; phone: string | null }
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [purchases, setPurchases] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [genModalOpen, setGenModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [genSuccess, setGenSuccess] = useState('')
  const [selectedLang, setSelectedLang] = useState('en')
  const [fontStatus, setFontStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadedFont, setLoadedFont] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved) setSelectedLang(saved)
  }, [])

  const handleLangChange = (code: string) => {
    setSelectedLang(code)
    localStorage.setItem(LANG_STORAGE_KEY, code)
  }

  // Load the template's font — checks Supabase fonts table first, then Google Fonts fallback
  const loadTemplateFont = async (fontFamily: string) => {
    if (!fontFamily || fontFamily === loadedFont) return
    setFontStatus('loading')

    try {
      // 1. Check if already loaded in browser
      const alreadyLoaded = [...document.fonts].some(
        (f) => f.family.replace(/['"]/g, '').toLowerCase() === fontFamily.toLowerCase() && f.status === 'loaded'
      )
      if (alreadyLoaded) { setLoadedFont(fontFamily); setFontStatus('ready'); return }

      // 2. Try Supabase fonts table
      const { data: fontRecord } = await supabase
        .from('fonts')
        .select('font_file_url')
        .ilike('name', fontFamily)
        .eq('is_active', true)
        .maybeSingle()

      if (fontRecord?.font_file_url) {
        const face = new FontFace(fontFamily, `url(${fontRecord.font_file_url})`)
        await face.load()
        document.fonts.add(face)
        setLoadedFont(fontFamily)
        setFontStatus('ready')
        return
      }

      // 3. Google Fonts fallback
      const linkId = `gf-${fontFamily.replace(/\s+/g, '-')}`
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`
        document.head.appendChild(link)
      }
      // Wait for Google Fonts to be usable (up to 3s)
      await document.fonts.load(`16px "${fontFamily}"`)
      setLoadedFont(fontFamily)
      setFontStatus('ready')
    } catch {
      // Font failed to load — still allow typing, just without the custom font
      setLoadedFont(fontFamily)
      setFontStatus('error')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: c }, { data: docs }, { data: tpls }, { data: purchaseData }, { data: accessData }] = await Promise.all([
      supabase.from('cases').select('*, clients(name, phone)').eq('id', id).eq('lawyer_id', user.id).single(),
      supabase.from('documents').select('*, templates(name)').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('templates').select('*, template_groups(name, is_free, is_restricted)').order('name'),
      supabase.from('purchases').select('template_group_id, template_id').eq('lawyer_id', user.id).eq('is_active', true)
        .or(`expiry_date.is.null,expiry_date.gt.${new Date().toISOString()}`),
      supabase.from('template_access').select('template_id, template_group_id').eq('lawyer_id', user.id),
    ])

    if (!c) { router.push('/dashboard/cases'); return }
    setCaseData(c)
    setDocuments(docs || [])
    // Filter out restricted templates the user has no access to
    const accessGrantIds = new Set((accessData || []).flatMap((a: any) => [a.template_id, a.template_group_id].filter(Boolean)))
    const loadedTemplates = (tpls || []).filter((t: any) => {
      const groupRestricted = t.template_groups?.is_restricted === true
      const tplRestricted   = t.is_restricted === true
      if (!tplRestricted && !groupRestricted) return true
      if (tplRestricted && accessGrantIds.has(t.id)) return true
      if (groupRestricted && t.template_group_id && accessGrantIds.has(t.template_group_id)) return true
      return false
    })
    setTemplates(loadedTemplates)
    // Collect both group IDs and individual template IDs from active purchases
    const ids = (purchaseData || []).flatMap((p: any) => [p.template_group_id, p.template_id].filter(Boolean))
    setPurchases(ids)

    // Auto-correct selectedLang: if no templates exist in the saved language, switch to
    // the first language that actually has templates so the list is never empty
    setSelectedLang((prev) => {
      const hasMatch = loadedTemplates.some((t: any) => (t.language || 'en') === prev)
      if (hasMatch) return prev
      const first = loadedTemplates[0] as any
      return first ? (first.language || 'en') : 'en'
    })

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const canUseTemplate = (tpl: Template) => {
    if (tpl.is_free) return true
    if (tpl.template_group_id && tpl.template_groups?.is_free) return true
    if (purchases.includes(tpl.id)) return true // individual template purchase
    if (tpl.template_group_id && purchases.includes(tpl.template_group_id)) return true
    return false
  }

  // Determine field type and label from variable name
  const getFieldMeta = (varName: string): { label: string; type: string; placeholder: string } => {
    const v = varName.toLowerCase()
    const dateWords = ['date', 'tarikh', 'dt', '_on', '_at']
    const numWords = ['age', 'umer', 'amount', 'rakam', 'price', 'number', 'num', 'pin', 'no', 'sal', 'year', 'count']
    const labelMap: Record<string, string> = {
      arjdar_name: 'Petitioner Name (અરજદારનું નામ)',
      arjdar_pita_name: "Petitioner's Father/Husband Name (પિતા/પતિ)",
      arjdar_umer: 'Petitioner Age (ઉંમર)',
      arjdar_address: 'Petitioner Address (સરનામું)',
      arjdar_shaher: 'Petitioner City (શહેર)',
      arjdar_pin: 'Petitioner PIN Code',
      samnawala_name: 'Respondent Name (સામેવાળા)',
      samnawala_pita_name: "Respondent's Father/Husband Name",
      samnawala_umer: 'Respondent Age',
      samnawala_address: 'Respondent Address',
      samnawala_shaher: 'Respondent City',
      samnawala_pin: 'Respondent PIN Code',
      lagna_tarikh: 'Marriage Date (લગ્ન તારીખ)',
      lagna_nondh_number: 'Marriage Registration Number',
      lagna_sthal: 'Marriage Place (લગ્ન સ્થળ)',
      judai_tarikh: 'Separation Date (છૂટાછેડા/જુદા)',
      arji_tarikh: 'Filing Date (અરજી તારીખ)',
      arji_sthal: 'Filing Place (અરજી સ્થળ)',
      arji_number: 'Arji / Case Number',
      rakam: 'Amount (₹) (રકમ)',
      court_shaher: 'Court City (કોર્ટ શહેર)',
      sal: 'Year (વર્ષ)',
      client_name: 'Client Name',
      party_name: 'Party Name',
      lawyer_name: 'Lawyer Name',
      case_number: 'Case Number',
    }

    const label = labelMap[varName]
      || varName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

    const isDate = dateWords.some((w) => v.includes(w))
    const isNum = numWords.some((w) => v.includes(w)) && !isDate
    const type = isDate ? 'date' : isNum ? 'number' : 'text'
    const placeholder = isDate ? '' : `Enter ${varName.replace(/_/g, ' ')}...`

    return { label, type, placeholder }
  }

  // Variables that are auto-injected — never shown in the form
  const AUTO_VARS = new Set(['language', 'language_name', 'font_family'])

  const openGenModal = (tpl: Template) => {
    setSelectedTemplate(tpl)
    setFontStatus('idle')
    // Start loading the template's font in background
    const fontFamily = (tpl as any).font_family as string | undefined
    if (fontFamily) loadTemplateFont(fontFamily)
    const initVars: Record<string, string> = {}
    // Exclude auto-injected vars from the form
    tpl.variables.filter((v) => !AUTO_VARS.has(v)).forEach((v) => { initVars[v] = '' })
    // Pre-fill from case data if client name is available
    if (caseData?.clients?.name) {
      if (initVars.hasOwnProperty('client_name')) initVars['client_name'] = caseData.clients.name
      if (initVars.hasOwnProperty('party_name')) initVars['party_name'] = caseData.clients.name
    }
    setVariables(initVars)
    setGenError('')
    setGenSuccess('')
    setGenModalOpen(true)
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setGenError('')
    setGenSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const response = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate!.id,
          caseId: id,
          language: selectedLang,
          variables,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setGenError(result.error || 'Failed to generate document')
      } else {
        setGenSuccess('Document generated successfully!')
        await fetchData()
        setTimeout(() => {
          setGenModalOpen(false)
          setGenSuccess('')
        }, 1500)
      }
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate document')
    }

    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
      </div>
    )
  }

  if (!caseData) return null

  const statusColors: Record<string, string> = {
    Drafting: 'bg-yellow-100 text-yellow-700',
    Active: 'bg-green-100 text-green-700',
    Pending: 'bg-blue-100 text-blue-700',
    Closed: 'bg-gray-100 text-gray-600',
  }

  return (
    <div>
      <Header
        title={caseData.title}
        subtitle="Case Details & Document Generation"
        actions={
          <Link href="/dashboard/cases" className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
            Back to Cases
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Case Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Client</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{caseData.clients?.name || 'No client'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Type</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{caseData.case_type || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</p>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[caseData.status] || 'bg-gray-100 text-gray-600'}`}>
                {caseData.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Created</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{format(new Date(caseData.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>
          {caseData.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
              <p className="text-sm text-gray-700">{caseData.notes}</p>
            </div>
          )}
        </div>

        {/* Templates for Document Generation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Generate Document</h2>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">No templates available. Ask your admin to add templates.</p>
          ) : (
            <>
              {/* Language tabs — only rendered when multiple languages exist */}
              {(() => {
                const availableLangs = SUPPORTED_LANGUAGES.filter((l) =>
                  templates.some((t) => (t.language || 'en') === l.code)
                )
                if (availableLangs.length <= 1) return null
                return (
                  <div className="mb-5 bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-2">
                      Select Template Language
                      <span className="ml-1 font-normal text-orange-500">— templates are available in multiple languages</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availableLangs.map((lang) => {
                        const count = templates.filter((t) => (t.language || 'en') === lang.code).length
                        return (
                          <button
                            key={lang.code}
                            onClick={() => handleLangChange(lang.code)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border-2 ${
                              selectedLang === lang.code
                                ? 'bg-navy-800 text-white border-navy-800'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-navy-300'
                            }`}
                          >
                            <span className="text-base leading-none">{lang.flag}</span>
                            <span>{lang.name}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                              selectedLang === lang.code ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Template grid — filtered by selected language only when multiple languages exist */}
              {(() => {
                const availableLangCodes = [...new Set(templates.map((t) => (t as any).language || 'en'))]
                const filtered = availableLangCodes.length > 1
                  ? templates.filter((t) => ((t as any).language || 'en') === selectedLang)
                  : templates
                const selectedLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                      <p className="text-sm text-gray-500 font-medium">
                        No templates in {selectedLangInfo?.name || selectedLang}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Switch to another language above to see available templates.</p>
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((tpl) => {
                      const accessible = canUseTemplate(tpl)
                      return (
                        <div key={tpl.id} className={`border rounded-xl p-4 transition-colors ${accessible ? 'border-gray-200 hover:border-navy-300 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{tpl.name}</h3>
                            {!accessible && (
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            )}
                          </div>
                          {tpl.template_groups && (
                            <p className="text-xs text-gray-400 mb-1">{tpl.template_groups.name}</p>
                          )}
                          {/* Language + font badge */}
                          <div className="flex items-center gap-1.5 mb-3">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-xs">
                              {SUPPORTED_LANGUAGES.find((l) => l.code === (tpl.language || 'en'))?.flag || '🌐'}
                              {SUPPORTED_LANGUAGES.find((l) => l.code === (tpl.language || 'en'))?.label || tpl.language}
                            </span>
                            {(tpl as any).font_family && (
                              <span className="text-xs text-gray-400 truncate">{(tpl as any).font_family}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mb-3">{tpl.variables?.length || 0} variables</p>
                          {accessible ? (
                            <button
                              onClick={() => openGenModal(tpl)}
                              className="w-full px-3 py-1.5 text-xs bg-navy-800 hover:bg-navy-900 text-white rounded-lg font-medium transition-colors"
                            >
                              Generate
                            </button>
                          ) : (
                            <Link href="/dashboard/marketplace" className="block w-full px-3 py-1.5 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg font-medium text-center">
                              Buy Access
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* Generated Documents */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Generated Documents ({documents.length})</h2>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No documents generated yet for this case.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name || doc.templates?.name || 'Document'}</p>
                    <p className="text-xs text-gray-500">{format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      download
                      className="px-3 py-1.5 text-xs bg-navy-50 hover:bg-navy-100 text-navy-700 rounded-lg font-medium"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate Document Modal */}
      {selectedTemplate && (
        <Modal
          isOpen={genModalOpen}
          onClose={() => setGenModalOpen(false)}
          title={`Generate: ${selectedTemplate.name}`}
          size="2xl"
        >
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            {/* Alerts */}
            {genError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {genError}
              </div>
            )}
            {genSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                {genSuccess}
              </div>
            )}

            {/* Template meta strip */}
            {(() => {
              const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)
              const fontName = (selectedTemplate as any).font_family || 'Times New Roman'
              const isNonLatin = selectedLang !== 'en'
              return (
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                  {/* Language + font row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {langInfo && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-orange-100 text-orange-700 rounded-xl text-xs font-semibold shadow-sm">
                        <span className="text-sm">{langInfo.flag}</span>
                        {langInfo.name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-100 text-purple-700 rounded-xl text-xs font-semibold shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16"/>
                      </svg>
                      {fontName}
                    </span>
                    {/* Font status */}
                    {fontStatus === 'loading' && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-500">
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Loading font…
                      </span>
                    )}
                    {fontStatus === 'ready' && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                        </svg>
                        Font ready
                      </span>
                    )}
                    {fontStatus === 'error' && (
                      <span className="text-xs text-amber-500">Font unavailable — using fallback</span>
                    )}
                  </div>
                  {/* Transliteration hint — shown once, only for non-Latin */}
                  {isNonLatin && (
                    <div className="flex items-center gap-2 text-xs text-orange-600">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                      </svg>
                      Type in <strong className="mx-0.5">English</strong> in any text field — {langInfo?.name} script suggestions appear automatically
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Fields */}
            {(() => {
              const visibleVars = selectedTemplate.variables.filter((v) => !AUTO_VARS.has(v))
              const templateFont = (selectedTemplate as any).font_family as string | undefined
              const fontReady = !templateFont || fontStatus === 'ready' || fontStatus === 'error'
              const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)

              if (visibleVars.length === 0) return (
                <div className="text-center py-8 text-sm text-gray-400">
                  No variables — click Generate to create the document.
                </div>
              )

              if (!fontReady) return (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                  <svg className="animate-spin w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm">Loading {langInfo?.name} font…</span>
                </div>
              )

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 items-start">
                    {visibleVars.map((v) => {
                      const { type } = getFieldMeta(v)
                      const label = getVarLabel(v, selectedLang)
                      const isDateOrNum = type === 'date' || type === 'number'
                      const inputFont = (templateFont && !isDateOrNum) ? templateFont : undefined
                      const fieldClass = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 focus:bg-white transition-all"
                      return (
                        <div key={v} className="group">
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 group-focus-within:text-orange-500 transition-colors">
                            {label}
                          </label>
                          {isDateOrNum ? (
                            <input
                              type={type}
                              value={variables[v] || ''}
                              onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                              required
                              className={fieldClass}
                            />
                          ) : (
                            <TransliterateInput
                              value={variables[v] || ''}
                              onChange={(val) => setVariables({ ...variables, [v]: val })}
                              lang={selectedLang}
                              fontFamily={inputFont}
                              required
                              placeholder={label}
                              className={fieldClass}
                            />
                          )}
                        </div>
                      )
                    })}
                </div>
              )
            })()}

            {/* Footer */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setGenModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-navy-800 hover:bg-navy-900 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Generate Document
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
