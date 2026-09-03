# Cloudflare production deployment

NEXUS uses six independent Cloudflare Workers Static Assets deployments. This is the
smallest free-tier-compatible shape for the existing deterministic browser demo: no
database, Worker backend, proxy, KV, D1, R2, Durable Objects, Queues, or paid Cloudflare
primitive is required. Each provider bundle still registers its own genuine WebMCP tools
with `document.modelContext`; provider business logic stays in that provider bundle.

## Production topology

| Worker | Required custom domain | Role |
| --- | --- | --- |
| `nexus-hero` | `nexus.1expert.pro` | Mission UI, Goal State orchestration, readiness surfaces |
| `nexus-officepro` | `officepro.1expert.pro` | Independent OfficePro provider and WebMCP tools |
| `nexus-techsupply` | `techsupply.1expert.pro` | Independent TechSupply provider and WebMCP tools |
| `nexus-fibermx` | `fibermx.1expert.pro` | Independent FiberMX provider and WebMCP tools |
| `nexus-netbusiness` | `netbusiness.1expert.pro` | Independent NetBusiness provider and WebMCP tools |
| `nexus-securenow` | `securenow.1expert.pro` | Independent SecureNow provider and WebMCP tools |

All public production traffic must use HTTPS. Local development keeps the six HTTP
localhost origins on ports 4400 through 4900.

## AUTOMATED BY REPOSITORY

From the repository root:

```bash
# Unchanged local six-origin demo
pnpm demo:hero

# Build production bundles/assets and run the fail-closed preflight
pnpm build:production

# Deploy all six static-asset Workers (explicit; never run by pnpm build)
pnpm deploy:production

# Check all six exact public origins plus every maintained NEXUS readiness route
pnpm verify:production
```

`pnpm build:production` selects `PRODUCTION`, embeds only the exact production origins,
generates `dist/cloudflare/<app>`, and rejects insecure, localhost, incomplete, duplicate,
or wildcard permission configuration. It also verifies that each provider bundle contains
the exact `exposedTo` NEXUS origin and that the NEXUS runtime contains all five exact
`fromOrigins` provider origins. A normal `pnpm build` defaults to `LOCAL` and does not
publish or produce production assets.

The six audited Wrangler files are under `cloudflare/<app>/wrangler.jsonc`. Deployment
first creates or updates the named Workers on the account's `workers.dev` hostname. The
repository intentionally does not declare custom-domain routes, because doing so would
modify account DNS/domain state.

## MANUAL CLOUDFLARE ACCOUNT STEPS

1. Confirm `1expert.pro` is an active zone in the intended Cloudflare account.
2. Authenticate interactively with `pnpm exec wrangler login`. For CI instead, provide
   `CLOUDFLARE_API_TOKEN` through the CI secret store; never write it to this repository.
3. Run `pnpm build:production` and `pnpm deploy:production`.
4. In **Workers & Pages**, open each Worker, then **Settings → Domains & Routes → Add →
   Custom Domain**, and attach the exact domain from the topology table. Cloudflare creates
   the DNS record and certificate. Remove or resolve any conflicting existing DNS record
   first; do not use a wildcard domain.
5. Wait until all six certificates are active, then run `pnpm verify:production`.
6. Launch Chrome 151+ with `--enable-features=WebMCP`, open
   `https://nexus.1expert.pro`, and replay the sequence in [demo.md](demo.md). Confirm the
   UI labels genuine WebMCP transport and the browser console shows no mixed-content or
   origin-permission failure.

Production permission boundaries are exact:

- every provider registers with `exposedTo: ['https://nexus.1expert.pro']`;
- NEXUS requests discovery with the specific provider HTTPS origin in `fromOrigins`;
- provider iframes retain `allow="tools"`;
- there is no wildcard exposure and no NEXUS provider proxy.

The deployed NEXUS origin serves substantive `/developers`, `/about`, `/contact`,
`/privacy`, and `/sandbox` pages; frontmatter-bearing Markdown twins; `/robots.txt`,
`/sitemap.xml`, `/llms.txt`, and `/developers/llms.txt`; a versioned ARD manifest and
integrity-bound Agent Skill under `/.well-known`; canonical/Open Graph metadata; semantic
HTML; and linked Schema.org JSON-LD using
`https://nexus.1expert.pro`. Provider pages publish canonical metadata using their own
production origins. No unimplemented API, auth, MCP-server, A2A, payment, pricing, SDK,
CLI, or registry surface is advertised.

## Failure behavior

Build or preflight failure exits nonzero before Wrangler runs. Deployment stops on the
first failed Worker. Verification exits nonzero if any required origin or NEXUS readiness
route is unavailable; it never reports a partial deployment as successful. Unknown
environments and non-HTTPS production origins fail closed.

WebMCP remains explicitly experimental in the validated runtime. Chrome 151 does not
enable it by default; use the flag above. Provider sites remain normal usable websites
when `document.modelContext` is unavailable, and the UI must not call that fallback
WebMCP.
