# NEXUS

> **The continuity layer for the Agentic Web.**
>
> **Websites end. Human intentions don't.**

NEXUS is a WebMCP-first proof of concept for the OpenAI WebMCP Challenge. It demonstrates how a user's goal can continue across independent agent-ready websites when the first provider can only partially fulfill the intent.

## Hero mission

> Open an office for 20 people in Guadalajara before October 1, 2026 with a MXN $500,000 budget.

The demo must prove one complete flow:

`Fulfillment -> Handoff -> Recovery/Reroute -> Human Approval -> Goal Complete`

## Product principle

WebMCP gives agents tools inside a website. NEXUS lets the user's intent continue beyond it.

NEXUS does not silently divert a user away from a provider. A user who deliberately starts on a provider site remains in **Brand Mode**. Continuation to other providers requires an explicit handoff/authorization into **Broker Mode**.

## Workspace

```text
apps/
  webmcp-cross-origin-spike/
  nexus/
  officepro/
  techsupply/
  fibermx/
  netbusiness/
  securenow/
packages/
  webmcp/
  goal-state/
  intent-handoff/
  provider-template/
docs/
  architecture.md
  webmcp.md
  hackathon.md
  agent-readiness.md
AGENTS.md
README.md
```

The repository is a pnpm TypeScript workspace. Provider apps share their provider and
WebMCP contracts through `packages/provider-template` and `packages/webmcp`; mission
continuity contracts live in `packages/goal-state` and `packages/intent-handoff`.
Provider-owned catalog, price, stock, and availability data must remain inside each
provider app. The deterministic hero fixtures keep the final mission at MXN 410,000 while
preserving the FiberMX deadline failure, NetBusiness reroute, and SecureNow approval gate.

## Development

Requirements: Node.js 20 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

Run the complete foundation quality gates from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Each workspace also exposes `dev`, `typecheck`, and `build` scripts so it can be
worked on independently while consuming the shared contracts via `workspace:*`.

Run the Issue #6 cross-origin reproduction harness with `pnpm spike:webmcp`. It starts the
authorized consumer on port 4100, the independent provider on port 4200, and an unauthorized
negative control on port 4300. Exact browser requirements and validated results are in
[`docs/webmcp.md`](docs/webmcp.md#issue-6-spike-result-cross-origin-validated).

The NEXUS package also provides real `robots.txt`, `sitemap.xml`, `llms.txt`, Schema.org,
and accessible shell contracts for a configurable deployment origin. Validate them locally
after building the package:

```bash
pnpm --filter @nexus/app-nexus build
pnpm --filter @nexus/app-nexus check:readiness -- https://nexus.your-domain.example
```

The external scan and Lighthouse scores remain pending until a public NEXUS deployment is
actually measured. The evidence policy, accessibility checklist, deferred surfaces, and
deploy/scan/fix/rescan workflow are in
[`docs/agent-readiness.md`](docs/agent-readiness.md#targets-and-evidence-status).

## Sprint 0

Sprint 0 establishes the contracts and guardrails Codex must follow before feature implementation begins. See the Sprint 0 pull request and GitHub Issues for the executable backlog.

## Non-goals for the hackathon

- Building a global WebMCP search engine.
- Inventing a new distributed protocol or identity standard.
- Real procurement integrations or production payments.
- Large catalogs or production supplier onboarding.
- Hiding provider failures in the demo.

The proof of concept is intentionally optimized for a clear, reliable three-minute demonstration of continuity across agent-ready websites.
