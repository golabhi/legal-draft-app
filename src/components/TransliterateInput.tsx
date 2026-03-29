'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  onChange: (val: string) => void
  lang: string
  fontFamily?: string
  placeholder?: string
  required?: boolean
  className?: string
}

const TRANSLITERABLE_LANGS = new Set(['gu', 'hi', 'mr', 'ta', 'te', 'kn', 'ml', 'bn', 'pa'])

const LANG_NAMES: Record<string, string> = {
  gu: 'Gujarati', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil',
  te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', bn: 'Bengali', pa: 'Punjabi',
}

function isLatinText(text: string) {
  return text.length > 0 && /^[a-zA-Z\s.,'"-]+$/.test(text)
}

export default function TransliterateInput({
  value, onChange, lang, fontFamily, placeholder, required, className,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const canTransliterate = TRANSLITERABLE_LANGS.has(lang)

  const updatePos = useCallback(() => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 6, left: r.left, width: r.width })
  }, [])

  const fetchSuggestions = async (text: string) => {
    if (!TRANSLITERABLE_LANGS.has(lang) || !text.trim()) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch('/api/transliterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), lang }),
      })
      const data = await res.json()
      const list: string[] = (data.suggestions || []).filter((s: string) => s.toLowerCase() !== text.toLowerCase())
      setSuggestions(list)
      if (list.length > 0) { updatePos(); setOpen(true) }
      else setOpen(false)
    } catch {
      setSuggestions([]); setOpen(false)
    }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    if (!canTransliterate) return
    clearTimeout(timerRef.current)
    if (isLatinText(val)) {
      timerRef.current = setTimeout(() => fetchSuggestions(val), 400)
    } else {
      setSuggestions([]); setOpen(false)
    }
  }

  const pick = (s: string) => {
    onChange(s)
    setSuggestions([]); setOpen(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const inputStyle: React.CSSProperties = {
    ...(fontFamily ? { fontFamily: `"${fontFamily}", sans-serif`, fontSize: '15px', lineHeight: '1.8', paddingTop: '10px', paddingBottom: '10px' } : {}),
    ...(canTransliterate ? { paddingRight: '2.25rem' } : {}),
  }

  const dropdown = open && suggestions.length > 0 && typeof window !== 'undefined'
    ? createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 280), zIndex: 9999 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-orange-700 flex-1">
              {LANG_NAMES[lang] || lang} suggestions
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-orange-300 hover:text-orange-600 hover:bg-orange-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          {/* Chips */}
          <div className="flex flex-wrap gap-1.5 p-3">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pick(s)}
                style={fontFamily ? { fontFamily: `"${fontFamily}", sans-serif`, fontSize: '14px' } : undefined}
                className="px-3 py-1.5 bg-white hover:bg-orange-50 active:scale-95 text-gray-800 hover:text-orange-700 border border-gray-200 hover:border-orange-300 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => { if (suggestions.length > 0) { updatePos(); setOpen(true) } }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        required={required}
        lang={lang}
        style={inputStyle}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Right-side indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {loading ? (
          <svg className="animate-spin w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : canTransliterate ? (
          <svg className="w-4 h-4 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
          </svg>
        ) : null}
      </div>

      {dropdown}
    </div>
  )
}
