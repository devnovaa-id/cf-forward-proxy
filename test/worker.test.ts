import { describe, it, expect } from 'vitest'
import { parseTarget } from '../src/index'

describe('parseTarget', () => {
	it('parses valid https URL with query string', () => {
		const r = parseTarget('https://proxy.dev/https://api.example.com/x?q=1')
		expect(r).not.toBeNull()
		expect(r!.target).toBe('https://api.example.com/x?q=1')
		expect(r!.parsed.origin).toBe('https://api.example.com')
	})

	it('parses valid http URL without query', () => {
		const r = parseTarget('https://proxy.dev/http://example.com/path')
		expect(r).not.toBeNull()
		expect(r!.target).toBe('http://example.com/path')
	})

	it('rejects empty path', () => {
		expect(parseTarget('https://proxy.dev/')).toBeNull()
	})

	it('rejects ftp scheme', () => {
		expect(parseTarget('https://proxy.dev/ftp://example.com/file')).toBeNull()
	})

	it('rejects malformed target', () => {
		expect(parseTarget('https://proxy.dev/not-a-url')).toBeNull()
	})
})
