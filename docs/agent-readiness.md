# Agent Readiness

## Targets and evidence status

- External Agent Readiness score for the deployed NEXUS domain: **target >=95**.
- Lighthouse accessibility score for the deployed NEXUS domain: **target >=95**.
- Empty, broken, or misleading discovery surfaces are defects, even if a scanner rewards them.

Issue #8 establishes the implementation baseline and scan loop before a public NEXUS
deployment exists. It does not create either external score.

| Measurement | Current result | Evidence |
| --- | --- | --- |
| Local readiness contract check | PASS | Automated repository tests and `check:readiness` CLI |
| External Agent Readiness scan | **PENDING** | No public NEXUS deployment was available for an external scan |
| Lighthouse accessibility | **PENDING** | No deployed NEXUS page was available for a Lighthouse run |

`PASS` above means only that the maintained local artifacts agree with each other. It is
not an external Agent Readiness score and is not a Lighthouse result.

## Implemented NEXUS baseline

`@nexus/app-nexus` exports a framework-independent readiness handler so the eventual web
deployment can serve the same deterministic artifacts at its configured canonical origin:

| Route | Content | Contract |
| --- | --- | --- |
| `/` | Accessible NEXUS Mission Dashboard with embedded JSON-LD | Semantic landmarks, one `h1`, ordered headings, skip link, keyboard focus, canonical Goal State visualization, real discovery links |
| `/robots.txt` | Crawler policy | Allows the public site and names the canonical sitemap |
| `/sitemap.xml` | XML sitemap | Contains the canonical NEXUS home page and no unimplemented routes |
| `/llms.txt` | AI-readable product and architecture guide | Explains Brand Mode, Broker Mode, Intent Handoff, approval, provider ownership, WebMCP, and real discovery endpoints |

The deployment must supply its own `canonicalOrigin`; there is no production default and
no hard-coded localhost identity. HTTPS is required outside localhost development. The
same origin is used by canonical HTML metadata, Schema.org data, `robots.txt`,
`sitemap.xml`, and `llms.txt` links.

The embedded Schema.org object identifies NEXUS as a `SoftwareApplication`. It describes
only implemented product behavior: Goal State progress, explicit Intent Handoff, visible
failure/rerouting, and human approval before commitments. It contains no rating, review,
scan score, or other synthetic claim.

To integrate the handler into a web framework, construct the surfaces once from the
deployment's trusted origin and map incoming pathnames through
`getNexusReadinessResponse`. Every advertised discovery URL has a corresponding `200`
response and content type; unknown routes return `404`.

## WebMCP alignment

The readiness text describes the architecture that is actually implemented and validated:

- providers register genuine tools with `document.modelContext` on independent origins;
- authorized consumers use the `fromOrigins`, `exposedTo`, and iframe `allow="tools"`
  permission model documented in [webmcp.md](webmcp.md);
- provider catalog, price, stock, availability, and constraints stay at the provider;
- NEXUS does not centralize providers behind a REST proxy;
- commitment operations require explicit human approval.

NEXUS capability names in the current foundation package are TypeScript contracts, not a
publicly registered NEXUS WebMCP tool set. The readiness surfaces therefore do not claim
that those tools can be discovered or invoked. Provider WebMCP registration remains owned
by the provider template and provider applications.

## Deliberately deferred surfaces

| Candidate | Issue #8 decision | Reason required before implementation |
| --- | --- | --- |
| `/.well-known/webmcp.json` | Deferred | The current browser implementation discovers registered `document.modelContext` tools; this repository has no maintained WebMCP manifest contract to publish |
| `/.well-known/agent-card.json` | Deferred | NEXUS has no implemented agent-card protocol or stable contract |
| `/.well-known/ai-catalog.json` | Deferred | Provider business catalogs must remain provider-owned and no supported catalog standard is implemented |
| `/openapi.json` or other API metadata | Deferred | NEXUS has no public HTTP API whose real routes, schemas, authorization, and errors could be represented truthfully |
| Markdown content negotiation | Deferred | `/llms.txt` provides the useful machine-readable overview; no maintained alternate page representation exists yet |

Add one of these only when the underlying feature exists, the format is supported, every
referenced endpoint resolves, and repository tests can prevent drift. Never add an empty
file, a placeholder schema, a fake tool, or a manifest that advertises future work.

## Deterministic local check

Build the NEXUS package and validate its generated surface graph against the intended
deployment origin:

```bash
pnpm --filter @nexus/app-nexus build
pnpm --filter @nexus/app-nexus check:readiness -- https://nexus.your-domain.example
```

For local development, `http://localhost:<port>` is accepted. The command returns JSON,
lists every checked route, and exits nonzero if a surface is empty, the sitemap references
the wrong origin, `llms.txt` links to an unavailable route, JSON-LD disagrees with the
canonical identity, or the shell loses its main landmark, `h1`, or JSON-LD block.

Automated tests additionally verify:

- the production identity is configurable and insecure non-local origins are rejected;
- every advertised route returns the expected content type;
- `robots.txt` and `sitemap.xml` are internally consistent;
- `llms.txt` describes the real mode, approval, provider-ownership, and WebMCP contracts;
- Schema.org JSON-LD parses and has no synthetic scores;
- the shell has semantic landmarks, ordered headings, a skip link, and visible focus;
- unimplemented OpenAPI and well-known routes return `404` and are not advertised;
- a broken linked endpoint fails validation.

This check is suitable for CI, but it does not replace an external scan or browser audit.

## Deploy, scan, fix, and rescan

Run this loop on the real public NEXUS deployment, not a test fixture or local-only URL:

1. **Deploy** one immutable commit with the production canonical origin configured.
2. **Verify routes** with a browser and `curl`: `/`, `/robots.txt`, `/sitemap.xml`, and
   `/llms.txt` must be public, non-empty, correctly typed, and consistent with the final
   redirected URL.
3. **Scan externally** with the selected Agent Readiness service. Record its name, version
   if exposed, timestamp, deployed commit, final URL, total score, per-check output, and
   exported report or screenshots.
4. **Identify gaps** by mapping every finding to a real missing or broken contract. Reject
   recommendations that require fabricated metadata or provider business data in NEXUS.
5. **Fix** the smallest maintained surface and add a regression test for the gap.
6. **Redeploy** the new immutable commit to the same production domain.
7. **Rescan** with the same scanner and settings. Preserve both reports; do not overwrite
   the baseline.
8. Repeat until the score is at least 95 or document the exact external limitation and its
   demo impact.

Use this evidence record for each external pass:

| Field | Required value |
| --- | --- |
| Scan status | `MEASURED` (never `demo` or inferred) |
| Deployed URL | Final public HTTPS URL after redirects |
| Git commit | Full deployed SHA |
| Deployment identifier | Host-provided deployment ID or immutable URL |
| Scanner | Product name and observable version/date |
| Timestamp | ISO 8601 with timezone |
| Overall score | Exact scanner result |
| Findings | Export or screenshots plus concise repository mapping |
| Follow-up | Fix PR and rescan evidence, or documented justified deferral |

Commit the evidence location or link it from this document once a stable public deployment
exists. A score can be labeled `external` only when this record is complete. Synthetic
demo data, local validators, unit tests, and screenshots of metadata are never external
scores.

## Lighthouse and manual accessibility audit

Run Lighthouse against the same public deployment and commit used for the external scan.
Use a fresh Chrome profile, normal desktop throttling, and the Accessibility category.
Record Chrome and Lighthouse versions, URL after redirects, timestamp, commit, numeric
score, and the HTML/JSON report. A reproducible CLI run may use:

```bash
pnpm dlx lighthouse@X.Y.Z \
  https://nexus.your-domain.example \
  --only-categories=accessibility \
  --output=html --output=json \
  --output-path=./artifacts/nexus-lighthouse
```

Replace `X.Y.Z` with the exact installed semver and retain it in the evidence
record; do not silently use an unpinned latest version. The target is >=95. Until an actual
report exists, the repository must continue to say **PENDING**.

Lighthouse is not a complete accessibility audit. On the deployed NEXUS shell, manually:

1. Navigate from the address bar using only Tab, Shift+Tab, Enter, Space, and arrow keys.
2. Confirm the skip link becomes visible on focus and moves focus to the main content.
3. Confirm focus is never hidden, trapped, or lost and remains visibly distinguishable.
4. Inspect landmarks and the heading outline: header, labelled navigation, main, footer,
   one `h1`, then logical `h2` sections.
5. At 200% and 400% zoom, confirm text reflows without clipped content or horizontal
   scrolling needed to read paragraphs.
6. Check foreground, link, and focus-indicator contrast with browser accessibility tools.
7. With VoiceOver or another screen reader, confirm page title, language, landmarks,
   headings, list structure, and meaningful link names are announced.
8. When later UI adds buttons or forms, verify every control has an accessible name,
   instructions and errors are programmatically associated, and status changes use an
   appropriate live region without stealing focus.

Record the tester, assistive technology/browser versions, date, failures, fixes, and rerun
result. Automated checks passing does not close a manual audit failure.

## Provider readiness and routing

Demo providers use the shared provider template for semantic pages, genuine WebMCP
registration, typed errors, and maintained provider-owned `robots.txt`, `sitemap.xml`,
`llms.txt`, and organization JSON-LD. The template refuses invalid origins and empty tool
sets, preventing placeholder readiness claims.

Agent readiness may become one provider-routing signal, but it never substitutes for
requirement fit, deadline, availability, cost, or explicit user constraints. If the UI
later shows provider readiness scores, `external` must mean a recorded third-party scan;
synthetic proof-of-concept data must be visibly labeled `demo`.
