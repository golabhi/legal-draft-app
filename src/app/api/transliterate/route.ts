import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const LANG_CODES: Record<string, string> = {
  gu: 'gu-t-i0-und',
  hi: 'hi-t-i0-und',
  mr: 'mr-t-i0-und',
  ta: 'ta-t-i0-und',
  te: 'te-t-i0-und',
  kn: 'kn-t-i0-und',
  ml: 'ml-t-i0-und',
  bn: 'bn-t-i0-und',
  pa: 'pa-t-i0-und',
}

export async function POST(req: NextRequest) {
  try {
    const { text, lang } = await req.json()
    if (!text || !lang) return NextResponse.json({ suggestions: [] })

    const langCode = LANG_CODES[lang]
    if (!langCode) return NextResponse.json({ suggestions: [] })

    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${langCode}&num=8&cp=0&cs=1&ie=utf-8&oe=utf-8`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.google.com/',
        'Origin': 'https://www.google.com',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      console.error('Transliterate API error:', res.status, await res.text())
      return NextResponse.json({ suggestions: [] })
    }

    const raw = await res.text()
    console.log('Transliterate raw:', raw.slice(0, 500))
    let data: any
    try { data = JSON.parse(raw) } catch { return NextResponse.json({ suggestions: [], debug: 'parse_error', raw: raw.slice(0, 300) }) }

    // Format: ["SUCCESS", [["word", ["s1","s2",...], {}, {}]]]
    if (data?.[0] === 'SUCCESS' && Array.isArray(data[1]?.[0]?.[1])) {
      return NextResponse.json({ suggestions: data[1][0][1] as string[] })
    }

    return NextResponse.json({ suggestions: [], debug: 'not_success', status: data?.[0], raw: raw.slice(0, 300) })
  } catch (e) {
    console.error('Transliterate proxy error:', e)
    return NextResponse.json({ suggestions: [] })
  }
}
