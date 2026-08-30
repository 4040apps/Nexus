# Agent Readiness

## Targets

- External Agent Readiness score for deployed NEXUS domain: **>=95**.
- Lighthouse accessibility: **>=95**.
- No fake, empty or broken discovery surfaces.

## Principle

Agent readiness is part of product quality, not a last-minute SEO-style checklist. Build valid machine-readable surfaces from the first deploy and scan iteratively.

## Candidate surfaces

Only implement surfaces that are valid and maintained:

- `robots.txt`
- `sitemap.xml`
- `llms.txt`
- Schema.org structured data
- useful semantic HTML and accessible forms/actions
- markdown/content negotiation where useful
- WebMCP registration/metadata
- OpenAPI/API documentation when an HTTP API exists
- well-known agent/API metadata when valid for the implementation

## Operational loop

```text
DEPLOY -> SCAN -> IDENTIFY GAPS -> FIX -> REDEPLOY -> RESCAN
```

Begin external scanning early enough to fix structural issues before the final day.

## Provider readiness

Demo providers should share an agent-ready provider template so their semantics, accessibility, WebMCP registration and structured errors are consistent.

If the UI shows provider readiness scores:

- `external` means a real third-party scan of that deployed origin;
- `demo` means synthetic metadata used only for the proof of concept.

Never present a demo score as externally verified.

## Routing

Agent readiness may become one routing signal, but it is not a substitute for requirement fit, deadline, availability, cost or explicit user constraints.
