'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { format } from 'date-fns'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

interface Font {
  id: string
  name: string
  font_file_url: string | null
  is_active: boolean
  language: string | null
  created_at: string
}

// Known Indian language fonts with download hints
const FONT_SUGGESTIONS = [
  { name: 'Shruti',              language: 'gu', note: 'Built-in on Windows' },
  { name: 'Noto Sans Gujarati',  language: 'gu', note: 'Google Fonts' },
  { name: 'Aakar',               language: 'gu', note: 'Gujarat govt font' },
  { name: 'Mangal',              language: 'hi', note: 'Built-in on Windows' },
  { name: 'Noto Sans Devanagari',language: 'hi', note: 'Google Fonts' },
  { name: 'Kokila',              language: 'hi', note: 'Built-in on Windows' },
  { name: 'Latha',               language: 'ta', note: 'Built-in on Windows' },
  { name: 'Noto Sans Tamil',     language: 'ta', note: 'Google Fonts' },
  { name: 'Gautami',             language: 'te', note: 'Built-in on Windows' },
  { name: 'Noto Sans Telugu',    language: 'te', note: 'Google Fonts' },
  { name: 'Vrinda',              language: 'bn', note: 'Built-in on Windows' },
  { name: 'Noto Sans Bengali',   language: 'bn', note: 'Google Fonts' },
  { name: 'Raavi',               language: 'pa', note: 'Built-in on Windows' },
  { name: 'Kartika',             language: 'ml', note: 'Built-in on Windows' },
  { name: 'Tunga',               language: 'kn', note: 'Built-in on Windows' },
]

export default function FontsPage() {
  const [fonts, setFonts] = useState<Font[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Font | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ name: '', font_file_url: '', is_active: true, language: '' })
  const [previewLoaded, setPreviewLoaded] = useState(false)

  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchFonts = async () => {
    setLoading(true)
    const { data } = await supabase.from('fonts').select('*').order('name')
    setFonts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchFonts() }, [])

  // Load font for preview whenever form.font_file_url changes
  useEffect(() => {
    setPreviewLoaded(false)
    if (!form.font_file_url || !form.name) return
    const face = new FontFace(form.name, `url(${form.font_file_url})`)
    face.load().then((loaded) => {
      document.fonts.add(loaded)
      setPreviewLoaded(true)
    }).catch(() => setPreviewLoaded(false))
  }, [form.font_file_url, form.name])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', font_file_url: '', is_active: true, language: '' })
    setError('')
    setPreviewLoaded(false)
    setModalOpen(true)
  }

  const openEdit = (font: Font) => {
    setEditing(font)
    setForm({ name: font.name, font_file_url: font.font_file_url || '', is_active: font.is_active, language: font.language || '' })
    setError('')
    setPreviewLoaded(false)
    setModalOpen(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setPreviewLoaded(false)
    const fileName = `${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('fonts').upload(fileName, file)
    if (error) {
      setError('Upload failed: ' + error.message)
    } else {
      const { data: urlData } = supabase.storage.from('fonts').getPublicUrl(data.path)
      setForm((f) => ({ ...f, font_file_url: urlData.publicUrl }))
    }
    setUploading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      font_file_url: form.font_file_url || null,
      is_active: form.is_active,
      language: form.language || null,
    }
    const { error: err } = editing
      ? await supabase.from('fonts').update(payload).eq('id', editing.id)
      : await supabase.from('fonts').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    showToast(editing ? 'Font updated' : 'Font added')
    await fetchFonts()
    setModalOpen(false)
    setSaving(false)
  }

  const toggleActive = async (font: Font) => {
    await supabase.from('fonts').update({ is_active: !font.is_active }).eq('id', font.id)
    await fetchFonts()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('fonts').delete().eq('id', id)
    showToast('Font deleted')
    await fetchFonts()
  }

  const getLangInfo = (code: string | null) =>
    SUPPORTED_LANGUAGES.find((l) => l.code === code)

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy-800 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <Header
        title="Font Management"
        subtitle="Upload font files for Indian language document generation"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Font
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* Info card */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">How fonts work</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Upload a <strong>.ttf</strong> or <strong>.otf</strong> font file — this is the font file for the language script</li>
                <li>• The font name here must <strong>exactly match</strong> the font name used in your <strong>.docx template</strong> (e.g. <span className="font-mono bg-blue-100 px-1 rounded">Shruti</span>)</li>
                <li>• When a customer fills the generate form, the font loads automatically so they can type in the correct script</li>
                <li>• Windows built-in fonts (Shruti, Mangal, etc.) don't need to be uploaded — they load from the user's system</li>
              </ul>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-800 rounded-full" />
          </div>
        ) : fonts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No fonts added yet</p>
            <button onClick={openCreate} className="mt-3 text-sm text-navy-700 hover:underline">Add your first font →</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_120px_100px_100px] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
              {['Font Name', 'Language', 'Preview', 'File', 'Status', 'Actions'].map((h) => (
                <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {fonts.map((font) => {
              const langInfo = getLangInfo(font.language)
              return (
                <div key={font.id} className="grid grid-cols-[2fr_1fr_1fr_120px_100px_100px] gap-4 items-center px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  {/* Name */}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{font.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{format(new Date(font.created_at), 'dd MMM yyyy')}</p>
                  </div>

                  {/* Language */}
                  <div>
                    {langInfo ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium">
                        <span>{langInfo.flag}</span>
                        <span>{langInfo.label}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 italic">—</span>
                    )}
                  </div>

                  {/* Preview */}
                  <div>
                    {font.font_file_url ? (
                      <FontPreview fontName={font.name} fontUrl={font.font_file_url} />
                    ) : (
                      <span className="text-xs text-gray-300 italic">No file</span>
                    )}
                  </div>

                  {/* File */}
                  <div>
                    {font.font_file_url ? (
                      <a href={font.font_file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        .ttf/.otf
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs">
                        No file
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <button onClick={() => toggleActive(font)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        font.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {font.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(font)} className="px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">Edit</button>
                    <button onClick={() => handleDelete(font.id)} className="px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg">Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Font' : 'Add Font'} size="lg">
        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          {/* Quick pick */}
          {!editing && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Quick pick a known font</p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {FONT_SUGGESTIONS.map((s) => {
                  const lang = getLangInfo(s.language)
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, name: s.name, language: s.language }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        form.name === s.name
                          ? 'bg-navy-800 text-white border-navy-800'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span>{lang?.flag}</span>
                      <span>{s.name}</span>
                      <span className="opacity-60">{s.note}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Font name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Font Name <span className="text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-gray-400">Must exactly match the font name in your .docx template</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              placeholder="e.g. Shruti, Noto Sans Gujarati, Mangal"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language this font is for</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, language: '' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                  !form.language ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                General
              </button>
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en').map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setForm({ ...form, language: lang.code })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                    form.language === lang.code
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Font File
              <span className="ml-2 text-xs font-normal text-gray-400">Upload .ttf or .otf file</span>
            </label>

            {/* What file info */}
            <div className="mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-xs text-amber-700">
              <p className="font-semibold mb-1">What file to upload?</p>
              <ul className="space-y-0.5">
                <li>• <strong>.ttf</strong> (TrueType Font) or <strong>.otf</strong> (OpenType Font)</li>
                <li>• For <strong>Gujarati</strong>: download <span className="font-mono">Shruti.ttf</span> from C:\Windows\Fonts on Windows, or download <span className="font-mono">NotoSansGujarati-Regular.ttf</span> from Google Fonts</li>
                <li>• For <strong>Hindi</strong>: <span className="font-mono">Mangal.ttf</span> from C:\Windows\Fonts</li>
                <li>• The font must be the same one used when creating your .docx template in MS Word</li>
              </ul>
            </div>

            <label className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-6 cursor-pointer transition-all ${
              form.font_file_url ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-navy-300'
            }`}>
              {uploading ? (
                <>
                  <div className="animate-spin w-6 h-6 border-2 border-navy-200 border-t-navy-700 rounded-full" />
                  <p className="text-xs text-navy-600 font-medium">Uploading...</p>
                </>
              ) : form.font_file_url ? (
                <>
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-emerald-700">Font file uploaded</p>
                  <p className="text-xs text-gray-400">Click to replace</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Click to upload .ttf / .otf</p>
                </>
              )}
              <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          {/* Live preview */}
          {form.font_file_url && form.name && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Font Preview</p>
              {previewLoaded ? (
                <div>
                  <p style={{ fontFamily: `"${form.name}"`, fontSize: '18px', lineHeight: '1.6' }} className="text-gray-900">
                    {form.language === 'gu' ? 'અરજદારનું નામ — ગુજરાત હાઈ કોર્ટ' :
                     form.language === 'hi' ? 'आवेदक का नाम — उच्च न्यायालय' :
                     form.language === 'mr' ? 'अर्जदाराचे नाव — उच्च न्यायालय' :
                     form.language === 'ta' ? 'மனுதாரர் பெயர் — உயர் நீதிமன்றம்' :
                     form.language === 'te' ? 'దరఖాస్తుదారు పేరు — హైకోర్టు' :
                     form.language === 'bn' ? 'আবেদনকারীর নাম — উচ্চ আদালত' :
                     form.language === 'pa' ? 'ਅਰਜ਼ੀਕਾਰ ਦਾ ਨਾਮ — ਹਾਈ ਕੋਰਟ' :
                     'Sample Text — Legal Document'}
                  </p>
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                    </svg>
                    Font loaded successfully
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Loading preview… (enter font name above first)</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input type="checkbox" id="font_active" checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-navy-800" />
            <label htmlFor="font_active" className="text-sm text-gray-700">Active (available for document generation)</label>
          </div>

          <div className="flex gap-3 pt-1 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-navy-800 hover:bg-navy-900 rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update Font' : 'Add Font'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Renders a small live preview of the font loaded from its URL
function FontPreview({ fontName, fontUrl }: { fontName: string; fontUrl: string }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const alreadyLoaded = [...document.fonts].some(
      (f) => f.family.replace(/['"]/g, '').toLowerCase() === fontName.toLowerCase() && f.status === 'loaded'
    )
    if (alreadyLoaded) { setReady(true); return }
    const face = new FontFace(fontName, `url(${fontUrl})`)
    face.load().then((f) => { document.fonts.add(f); setReady(true) }).catch(() => {})
  }, [fontName, fontUrl])

  if (!ready) return <span className="text-xs text-gray-300 italic">loading…</span>

  return (
    <span style={{ fontFamily: `"${fontName}"`, fontSize: '14px' }} className="text-gray-800">
      અ ب ह க అ বা
    </span>
  )
}
