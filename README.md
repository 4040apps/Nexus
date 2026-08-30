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

## Planned workspace

```text
apps/
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

## Sprint 0

Sprint 0 establishes the contracts and guardrails Codex must follow before feature implementation begins. See the Sprint 0 pull request and GitHub Issues for the executable backlog.

## Non-goals for the hackathon

- Building a global WebMCP search engine.
- Inventing a new distributed protocol or identity standard.
- Real procurement integrations or production payments.
- Large catalogs or production supplier onboarding.
- Hiding provider failures in the demo.

The proof of concept is intentionally optimized for a clear, reliable three-minute demonstration of continuity across agent-ready websites.
