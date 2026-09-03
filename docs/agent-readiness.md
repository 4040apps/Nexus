# Agent Readiness

## Targets and measured baseline

- External Agent Readiness target for `https://nexus.1expert.pro`: **>=95**.
- Lighthouse accessibility target for the same deployed commit: **>=95**.
- Empty, broken, or misleading discovery surfaces are defects, even when a scanner
  rewards them.

The first real Ora scan was recorded in the
[Issue #34 implementation comment](https://github.com/4040apps/Nexus/issues/34#issuecomment-5519205005).
After the first truthful implementation pass was deployed, the recorded
[follow-up scan](https://github.com/4040apps/Nexus/issues/34#issuecomment-5520083380)
measured 61/100. That is the latest external score and the starting point for this final
polish; the repository does not infer a score from local checks.

| Measurement | Current evidence | Result |
| --- | --- | --- |
| Ora external audit | Recorded follow-up scan | **61/100 (C)**; initial baseline **39/100 (D)** |
| Ora discovery layer | Recorded follow-up scan | **6/12** |
| Ora access layer | Recorded follow-up scan | **45/60** |
| Ora usability layer | Recorded follow-up scan | **33/60** |
| Ora WebMCP check | Recorded follow-up scan | **PASS, 5/5** |
| Local readiness contract | Repository tests and `check:readiness` | **PASS** |
| Lighthouse production baseline | Lighthouse 13.4.1 / Headless Chrome 152, commit `dd2cc98`, 2026-09-03T05:44:59Z | **Performance 93, Accessibility 100, Best Practices 96, SEO 92** |

The Ora comments were posted on 2026-09-03 UTC. They do not preserve an observable CLI
version or complete scan artifacts in the repository, so this document does not invent
either value. The 39/100 baseline and 61/100 follow-up are external evidence; local
validation is not a replacement or an inferred rescore. No additional force scan was run
for the final polish documented below.

Ora also surfaced unrelated packages and projects with “Nexus” in their name. The npm
`nexus` package, PyPI `nexus-cli`, skills.sh `nexus-llm-lang`, and npm
`@agent-nexus/mcp-server` are not this product and are not claimed as NEXUS integrations.

## Truthful implementation pass

Issue #34 implements only the high-confidence fixes named in the baseline comment. The
framework-independent NEXUS readiness handler now maintains these routes:

| Route | Truthful content |
| --- | --- |
| `/` | Accessible mission dashboard, public-sandbox disclosure, canonical and Open Graph metadata, linked JSON-LD, and discovery links |
| `/developers` | WebMCP architecture, independent provider origins, permission/approval boundaries, local and production usage, and source links qualified as access-controlled |
| `/about` | Product thesis, canonical hero mission, and explicit proof-of-concept limits |
| `/contact` | Access-controlled GitHub issue path and a warning not to submit sensitive or real procurement data |
| `/privacy` | The demo's actual browser-state/data boundaries and hosting qualification |
| `/sandbox` | Existing deterministic hero-demo scope, controls, synthetic-data boundary, and explicit statement that this is not an API sandbox |
| `/index.md` | Canonical Markdown representation of the product, mission, safety rules, and maintained resources |
| `/developers.md`, `/about.md`, `/contact.md`, `/privacy.md`, `/sandbox.md` | Frontmatter-bearing Markdown twins of the corresponding substantive HTML pages |
| `/llms.txt` | Concrete “When to use NEXUS” guidance, WebMCP/runtime facts, and links to maintained docs and discovery files |
| `/developers/llms.txt` | Scoped developer context covering the real WebMCP origins, runtime flag, approval boundary, and deliberately absent public API/auth surfaces |
| `/robots.txt` | Standards-valid public crawler policy, canonical sitemap, and an informational comment pointing to the separately advertised ARD manifest |
| `/sitemap.xml` | Canonical maintained pages with explicit `lastmod` values |
| `/.well-known/ard.json` | ARD entries for only the maintained Markdown documentation and real hero skill artifact |
| `/.well-known/agent-skills/index.json` | Agent Skills Discovery v0.2.0 index for one actual hero-flow skill, including its byte-accurate SHA-256 digest |
| `/.well-known/agent-skills/continue-procurement-mission/SKILL.md` | Installable instructions for the implemented deterministic hero flow and its approval boundaries |
| `/favicon.svg` | Maintained NEXUS site icon referenced explicitly by every HTML page |
| `/og-image.svg` | Maintained NEXUS social-preview image referenced by the page metadata |

Unknown routes return an HTML `404` with an actual HTTP 404 status, a plain explanation,
and recovery links to the maintained documentation and sandbox. Each substantive HTML
page advertises its matching Markdown twin with
`rel="alternate" type="text/markdown"`; production HTTP `Link` headers advertise that
representation plus ARD and Agent Skills discovery. The `.well-known` resources are
CORS-readable and use their required content types.

The JSON-LD graph contains only real `Organization`, `WebSite`, and
`SoftwareApplication` nodes, plus a developer-page `FAQPage` whose questions and answers
are also visible on that page. It links to the actual
[4040apps organization](https://github.com/4040apps) and
[NEXUS repository](https://github.com/4040apps/Nexus), and contains no synthetic rating,
review, readiness score, pricing, or commercial offer.

The repository URL reported by the readiness scan was checked directly through GitHub.
It is the real `4040apps/Nexus` repository, but it is access-controlled. The link is
retained as the authoritative source location and the rendered pages qualify that GitHub
access is required; they do not claim that the source or its Issues are public.

## Agent Skills and ARD validity

The Agent Skills index follows the published discovery v0.2.0 shape: `$schema`, a
`skills` array, `skill-md` type, same-origin artifact URL, and a `sha256:` digest computed
from the exact served `SKILL.md` bytes. The artifact has the required YAML frontmatter and
describes how to run the existing hero flow; it does not advertise an API or autonomous
commitment authority.

The ARD manifest declares published `specVersion` `1.0` and uses an `entries` envelope.
Each entry has a domain-anchored identifier,
display name, media type, exactly one URL reference, capabilities, description, and two
representative queries. It advertises only `/index.md` and the skill artifact. It does not
pretend NEXUS is an ARD registry or expose registry search endpoints.

Repository validation recomputes the skill digest and rejects drift between the index and
artifact. Production preflight repeats the digest check against the generated files.

## WebMCP alignment

The already passing WebMCP architecture is unchanged:

- providers register genuine tools with `document.modelContext` on independent origins;
- authorized consumers use the validated `fromOrigins`, `exposedTo`, and iframe
  `allow="tools"` permission model;
- provider catalog, price, stock, availability, constraints, and validation stay at the
  provider;
- NEXUS never centralizes provider business logic behind a REST proxy;
- Broker Mode requires explicit Intent Handoff;
- commitment operations require a separate proposal-bound human approval.

Cross-origin WebMCP is validated for the controlled NEXUS demo environment when Chrome
151+ is launched with `--enable-features=WebMCP`. NEXUS does not claim WebMCP is enabled
by default in Chrome 151. See [webmcp.md](webmcp.md) for the recorded positive and
unauthorized-origin results.

## Deliberately absent surfaces

The following remain absent because their underlying products or protocols do not exist in
NEXUS:

- REST APIs and OpenAPI descriptions;
- OAuth, login, delegated authorization, or auth metadata;
- an HTTP MCP server or MCP registry entry;
- A2A agents or agent cards;
- NLWeb endpoints;
- payments, checkout protocols, pricing plans, or real offers;
- SDKs, CLIs, package-registry claims, or third-party registry entries;
- a WebMCP manifest invented outside the supported `document.modelContext` browser API.

The readiness handler continues to return `404` for representative fake paths including
`/openapi.json`, `/.well-known/webmcp.json`, and
`/.well-known/mcp/server-card.json`. NEXUS capability names in TypeScript remain internal
contracts, not a publicly registered NEXUS tool server.

## Deterministic checks and production assets

Build the package and validate the entire surface graph against a deployment origin:

```bash
pnpm --filter @nexus/app-nexus build
pnpm --filter @nexus/app-nexus check:readiness -- https://nexus.1expert.pro
pnpm build:production
pnpm preflight:production
```

The local validator checks every maintained route, canonical identities and Markdown
frontmatter, sitemap dates, Markdown links, JSON-LD linkage, ARD structure and version,
Agent Skills schema/digest agreement,
metadata discovery links, sandbox disclosure, semantic main content, and the helpful 404.
Production preflight ensures every generated asset exists, contains no localhost or
insecure production origin, and preserves the Agent Skill digest and CORS/Link headers.

## Deploy, rescan, and record the outcome

The latest external result remains 61/100. This final polish does not claim another score
and must not trigger an Ora force scan. If a normal future measurement is deliberately
scheduled after the PR's immutable commit is deployed to the same production domain:

1. Verify `/`, all sitemap pages, `/index.md`, `/llms.txt`, both `.well-known` indexes, and
   the linked `SKILL.md` return the expected status and content type.
2. Run Ora with the same command and preserve the complete JSON output.
3. Record the deployed commit, Cloudflare deployment ID, final redirected URL, observable
   scanner version, ISO 8601 timestamp, overall score, layer scores, and findings.
4. Compare against the 61/100 latest result and retain the original 39/100 baseline. Do
   not relabel local checks as an external score.
5. If the score remains below 95, accept only fixes backed by real implemented behavior;
   document all intentionally absent surfaces instead of fabricating them.

## Lighthouse baseline and evidence-backed fixes

Issue #38 captured the required production baseline before changing application code. The
full JSON report is versioned as [`lighthouse-nexus.json`](../lighthouse-nexus.json).

| Category | Production baseline |
| --- | ---: |
| Performance | **93** |
| Accessibility | **100** |
| Best Practices | **96** |
| SEO | **92** |

The run used Lighthouse 13.4.1 and Headless Chrome 152 against the final displayed URL
`https://nexus.1expert.pro/` at 2026-09-03T05:44:59Z. It reported no run warnings and no
audit warnings. The scored or actionable findings were:

- missing `/favicon.ico`, producing the only browser-console error;
- the non-standard `Agentmap:` line in `robots.txt`, which Lighthouse rejected as an
  unknown directive;
- FCP 2.2s, LCP 2.7s, Speed Index 3.4s, and TTI 2.7s;
- an estimated 149ms LCP opportunity from preconnecting the immediately embedded
  OfficePro origin;
- `Cache-Control: no-store` preventing the static main document from entering the
  back/forward cache.

The report's 4 KiB cache-lifetime finding belongs to Cloudflare's injected analytics
beacon, not a repository asset. The remaining no-store network finding also names an
infrastructure-injected request. This implementation does not claim to control those
third-party headers.

Each source change maps directly to that evidence: the shell now declares and serves a
real SVG favicon; `robots.txt` keeps standard directives only while ARD discovery remains
available through HTML and HTTP `Link` metadata; the production shell preconnects the
exact OfficePro origin supplied by the environment map; and deterministic static assets
use `public, max-age=0, must-revalidate` instead of `no-store`. The revalidation policy
avoids stale unfingerprinted assets while allowing browser history restoration.

The user requested review before deployment, so this PR does not claim a post-change
production score. After the reviewed commit is deployed, rerun the exact Lighthouse
command and record the four final production scores. The >=95 production target remains
pending until that measurement exists.

A post-build smoke run against the generated NEXUS static assets scored 100 in all four
categories and confirmed that the favicon console error, invalid robots directive,
back/forward-cache failure, and OfficePro preconnect opportunity were absent. That local
result validates the generated artifacts, but it is not presented as a production score
because it cannot reproduce Cloudflare latency, headers, or injected analytics.

## Manual accessibility audit

Manual verification must also cover keyboard navigation, the skip link, visible focus,
landmarks and heading order, 200%/400% reflow, contrast, and screen-reader announcements.
The hero controls must keep their accessible names and status messages, and state changes
must never rely on color alone.

## Provider readiness and routing

Demo providers retain their existing semantic pages, genuine WebMCP registration, typed
errors, and provider-owned discovery surfaces. Agent readiness may inform future routing,
but it never substitutes for requirement fit, deadline, availability, cost, or explicit
user constraints. A displayed score may be called `external` only when backed by a
recorded third-party scan; deterministic proof-of-concept data must remain labelled as
demo data.
