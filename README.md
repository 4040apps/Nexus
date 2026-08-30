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

Preview the Mission Dashboard after building the NEXUS package:

```bash
pnpm --filter @nexus/app-nexus build
pnpm --filter @nexus/app-nexus preview:dashboard
```

Open `http://localhost:4400`. Deterministic visual snapshots are selected with the
`state` query parameter: `initial`, `officepro-partial`, `fibermx-blocked`,
`internet-rerouted`, `approval-required`, or `complete`. For example:

```text
http://localhost:4400/?state=approval-required
```

The dashboard renders canonical Goal State directly; the preview snapshots do not execute
provider orchestration or commitment actions.

Run the live OfficePro → handoff → TechSupply → FiberMX → NetBusiness segment on five
independent local origins:

```bash
pnpm demo:officepro
```

Open `http://localhost:4400` and choose **Ask OfficePro**. NEXUS embeds the independent
OfficePro site from `http://localhost:4500` with `allow="tools"`. In Chrome 151+ launched
with `--enable-features=WebMCP`, NEXUS discovers and invokes the four genuine provider
tools using `document.modelContext`. In a browser without WebMCP, the UI explicitly labels
the normal provider-website fallback; it does not claim WebMCP success. The result is the
canonical 40% Goal State with MXN 155,000 used. Choose **Continue through NEXUS** to create
a minimized `PROPOSED` Intent Handoff, review the remaining intent, and explicitly select
**Authorize NEXUS to continue**. Only the resulting `EXECUTED` handoff enables Broker Mode;
then choose **Find computers**. TechSupply runs independently at `http://localhost:4600`,
exposes `search_computers`, `check_inventory`, and `build_computer_package`, and fulfills 20
computers for MXN 190,000 with delivery on 2026-09-22. The live checkpoint is 60% complete,
MXN 345,000 used, and MXN 155,000 remaining. Choose **Find internet** to invoke FiberMX at
`http://localhost:4700`. Its valid Guadalajara coverage cannot overcome its provider-owned
2026-10-08 installation date, so Goal State visibly records `BLOCKED` /
`DELIVERY_DEADLINE` against the 2026-10-01 deadline without counting the offer toward used
budget. Choose **Recover with another provider** to reroute only internet to NetBusiness at
`http://localhost:4800`. Its 2026-09-25 installation fulfills internet for MXN 27,500;
the checkpoint becomes 80%, MXN 372,500 used, and MXN 127,500 remaining while the FiberMX
failure remains auditable and security stays pending. Snapshot URLs remain available by
adding `?state=<name>`.

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
