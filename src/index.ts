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
