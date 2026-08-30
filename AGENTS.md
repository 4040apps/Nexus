# AGENTS.md — NEXUS

This file is the operating contract for coding agents working in this repository.

## Mission

Build the smallest reliable WebMCP-first proof of concept that demonstrates:

**Fulfillment -> Intent Handoff -> Recovery/Reroute -> Human Approval -> Goal Complete**

Hero scenario: open an office for 20 people in Guadalajara before 2026-10-01 with a MXN $500,000 budget.

## Core product thesis

**Websites end. Human intentions don't.**

WebMCP exposes useful site capabilities to an agent. NEXUS preserves and continues the user's remaining intent across independent agent-ready providers.

## Mandatory architecture rules

1. Providers must expose genuine WebMCP tools. Do not reduce the architecture to `Agent -> NEXUS -> REST providers`.
2. Provider catalog, stock, price and availability belong to the provider. NEXUS registry stores only discovery metadata/capabilities.
3. Brand Mode must not silently compare or divert to competitors.
4. Broker Mode begins only after explicit user authorization/handoff.
5. Commitment actions (purchase, reservation, signing, quote acceptance) require human approval.
6. Provider failure is a first-class state and must be visible. The hero demo deliberately includes a deadline conflict and reroute.
7. Reuse normal API validation, authorization, rate limits and typed errors for WebMCP actions.
8. Agent clients are untrusted clients.
9. Prefer deterministic demo behavior over unnecessary infrastructure.
10. Do not invent extra scope unless it materially improves the judged demo.

## Canonical requirement states

- `PENDING`
- `DISCOVERED`
- `MATCHED`
- `PROPOSED`
- `BLOCKED`
- `REQUIRES_HUMAN`
- `FULFILLED`

Canonical provider outcome states:

- `FULFILLED`
- `PARTIAL`
- `UNFULFILLED`
- `BLOCKED`
- `REQUIRES_HUMAN`

## Goal State

Goal State is the source of truth for mission progress. It must preserve constraints, requirements, provider assignments, status, costs, blockers and approvals. Changes must be auditable in an activity timeline.

## Intent Handoff

A handoff transfers only the remaining/unfulfilled requirements plus the constraints required to continue the mission. Do not transfer unnecessary provider-private data.

## Hero demo contract

The implementation must reliably produce this narrative:

1. User starts deliberately at OfficePro.
2. OfficePro fulfills desks and chairs.
3. Computers, internet and security remain.
4. User explicitly authorizes NEXUS continuation.
5. TechSupply fulfills computers.
6. FiberMX reports an installation date after the deadline and becomes `BLOCKED`.
7. NEXUS reroutes internet to NetBusiness, which can install before the deadline.
8. SecureNow reaches `REQUIRES_HUMAN` before commitment.
9. User approves.
10. Mission reaches 100% complete within budget and deadline.

## UI requirements

The NEXUS mission view must make agent work visible, including:

- mission progress;
- budget used/remaining;
- deadline;
- requirement/provider assignment;
- blocked and rerouted paths;
- pending human approvals;
- agent activity timeline.

Do not rely on chat text alone to explain the demo.

## Agent-readiness target

Target external Agent Readiness score: **>=95** for the deployed NEXUS domain.

Build valid surfaces from day one. Do not create fake or empty manifests merely to increase a score. Expected surfaces may include `robots.txt`, `sitemap.xml`, `llms.txt`, structured data, markdown/content negotiation, WebMCP metadata, OpenAPI/API metadata and accessibility where they are real and valid.

Target Lighthouse accessibility: >=95.

## Engineering quality gates

Before marking an implementation issue complete:

- lint passes;
- typecheck passes;
- tests for changed contracts/logic pass;
- build passes;
- no secrets are committed;
- errors are typed/structured where practical;
- sensitive writes require explicit approval;
- README/docs are updated if behavior or contracts change.

## Scope guardrail

Before implementing a feature, ask: **Does this materially help demonstrate Fulfillment -> Handoff -> Reroute -> Human Approval -> Goal Complete?**

If not, defer it until after the hackathon.
