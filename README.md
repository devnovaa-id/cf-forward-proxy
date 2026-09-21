# CF Forward Proxy

Forward proxy running on Cloudflare Workers edge. Pass any URL as the path and the worker relays the request with CORS headers.

## Usage

```
curl https://your-worker.workers.dev/https://api.example.com/endpoint?q=1
```

POST, PUT, DELETE, etc. are forwarded with body intact.

### Auth (optional)

Set `PROXY_TOKEN` as a secret, then send it as a header:

```bash
npx wrangler secret put PROXY_TOKEN
curl -H "X-Proxy-Token: your-secret" https://your-worker.workers.dev/https://api.example.com
```

## Develop

```bash
npm install
npm run dev          # local dev at http://localhost:8787
```

## Deploy

```bash
npx wrangler login
npm run deploy
```

## Health Check

```
curl https://your-worker.workers.dev/health
```

## Limitations

- **Redirects**: `Location` headers point to the original domain (not rewritten through the proxy).
- **WebSocket**: Not supported in v1.
- **CORS**: `Access-Control-Allow-Origin: *` (no credentials).
