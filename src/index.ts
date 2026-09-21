import { Hono } from 'hono'
import { logger } from 'hono/logger'

type Bindings = {
	PROXY_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,PATCH,OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Expose-Headers': '*',
	'Access-Control-Max-Age': '86400',
}

/** Browser fingerprint headers injected on outgoing requests to bypass bot detection. */
const BROWSER_HEADERS: Record<string, string> = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9',
	'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
	'sec-ch-ua-mobile': '?0',
	'sec-ch-ua-platform': '"Windows"',
	'sec-fetch-dest': 'document',
	'sec-fetch-mode': 'navigate',
	'sec-fetch-site': 'none',
	'sec-fetch-user': '?1',
	'upgrade-insecure-requests': '1',
}

/** Attach CORS headers to every response, including errors. */
app.use('*', async (c, next) => {
	await next()
	for (const [k, v] of Object.entries(CORS_HEADERS)) {
		c.res.headers.set(k, v)
	}
})

/**
 * Extract and validate the target URL from the incoming request path.
 * Incoming path format: /<full-target-url>
 */
export function parseTarget(rawUrl: string): { target: string; parsed: URL } | null {
	let url: URL
	try {
		url = new URL(rawUrl)
	} catch {
		return null
	}

	const targetStr = url.pathname.slice(1) + url.search
	if (!targetStr) return null

	let parsed: URL
	try {
		parsed = new URL(targetStr)
	} catch {
		return null
	}

	if (!parsed.hostname) return null
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

	return { target: targetStr, parsed }
}

app.get('/health', (c) => {
	return c.json({ status: 'ok', ts: new Date().toISOString() })
})

app.options('/*', () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS })
})

app.all('/*', async (c) => {
	const result = parseTarget(c.req.raw.url)
	if (!result) {
		return c.json(
			{ error: 'Invalid or missing target URL. Usage: GET /https://example.com/path' },
			400,
		)
	}
	const { parsed } = result

	const token = c.env.PROXY_TOKEN
	if (token) {
		if (c.req.header('X-Proxy-Token') !== token) {
			return c.json({ error: 'Unauthorized' }, 401)
		}
	}

	const proxyReq = new Request(parsed, c.req.raw)
	proxyReq.headers.set('Origin', parsed.origin)

	for (const [k, v] of Object.entries(BROWSER_HEADERS)) {
		proxyReq.headers.set(k, v)
	}

	for (const key of [...proxyReq.headers.keys()]) {
		if (/^(host|cf-|x-forwarded-|cdn-)/i.test(key)) {
			proxyReq.headers.delete(key)
		}
	}

	const upstream = await fetch(proxyReq)
	const out = new Response(upstream.body, upstream)

	for (const [k, v] of Object.entries(CORS_HEADERS)) {
		out.headers.set(k, v)
	}

	return out
})

app.onError((err, c) => {
	console.error('Proxy error:', err)
	return c.json({ error: 'Bad gateway' }, 502)
})

export default app
