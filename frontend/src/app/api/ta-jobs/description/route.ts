import { NextRequest, NextResponse } from 'next/server'

const CXS_BASE = 'https://uottawa.wd3.myworkdayjobs.com/wday/cxs/uottawa/uOttawa_External_Career_Site'

// Strip anything dangerous, keep structure intact for browser rendering
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // Strip inline style and class — we control all styling
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+style='[^']*'/gi, '')
    .replace(/\s+class="[^"]*"/gi, '')
    .replace(/\s+class='[^']*'/gi, '')
    .trim()
}

export async function GET(req: NextRequest) {
  const externalUrl = req.nextUrl.searchParams.get('url')
  if (!externalUrl) return NextResponse.json({ html: null }, { status: 400 })

  let externalPath: string
  try {
    const pathname = new URL(externalUrl).pathname
    externalPath = pathname.replace(/^\/en-US\/uOttawa_External_Career_Site/, '')
  } catch {
    return NextResponse.json({ html: null }, { status: 400 })
  }

  try {
    const res = await fetch(`${CXS_BASE}${externalPath}`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; UoSchedScraper/1.0)',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return NextResponse.json({ html: null })

    const data = await res.json()
    const info = data.jobPostingInfo ?? data
    const raw: string = info.jobDescription ?? ''
    const html = raw ? sanitizeHtml(raw) : null

    return NextResponse.json({ html })
  } catch {
    return NextResponse.json({ html: null })
  }
}
