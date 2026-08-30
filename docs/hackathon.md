# Hackathon Execution Plan

## Objective

Build a Top-10-caliber WebMCP proof of concept by maximizing WebMCP leverage, execution quality, potential impact, and creativity without exceeding the scope needed for a reliable demo.

## One story only

The submission demo centers on one mission:

> Open an office for 20 people in Guadalajara before October 1, 2026 with MXN $500,000.

```text
USER GOAL
  |
OfficePro -> furniture OK
  |
explicit NEXUS handoff
  |
TechSupply -> computers OK
  |
FiberMX -> BLOCKED: deadline
  |
NEXUS reroute
  |
NetBusiness -> internet OK
  |
SecureNow -> REQUIRES_HUMAN
  |
user approves
  |
GOAL 100% COMPLETE
```

## Memorable moments

1. **Partial fulfillment** — the first website helps but cannot finish the human goal.
2. **Intent continuity** — unresolved requirements survive the website boundary.
3. **Visible failure** — FiberMX misses the deadline.
4. **Recovery** — NEXUS reroutes only the blocked requirement.
5. **Human control** — SecureNow pauses before commitment.
6. **Goal completion** — progress reaches 100% while respecting budget/deadline.

## Demo UI

The NEXUS mission dashboard should show:

- progress percentage;
- budget used and remaining;
- deadline;
- Goal Graph / requirement list;
- assigned provider;
- blocked/rerouted path;
- approval state;
- Agent Activity Timeline.

## Implemented first segments: OfficePro and Intent Handoff

The live dashboard now begins where the user deliberately chose OfficePro. **Ask
OfficePro** runs the four provider-owned furniture tools, visibly records their outcomes,
and moves only desks and chairs through the canonical states to `FULFILLED`. The checkpoint
is deterministic: 40% complete, MXN 155,000 used, MXN 345,000 remaining, and delivery on
2026-09-20 before the mission deadline.

Computers, internet, and security remain `PENDING`. **Continue through NEXUS** proposes a
minimized Intent Handoff and presents an explicit authorization decision. **Stay with
OfficePro** leaves Brand Mode active. **Authorize NEXUS to continue** records human consent,
executes the handoff, and visibly enables Broker Mode while progress and budget remain
unchanged. Provider discovery and TechSupply fulfillment begin in the next issue.

## Scope budget

Prioritize roughly in this order:

1. contracts and deterministic state machine;
2. provider template;
3. OfficePro end-to-end;
4. intent handoff;
5. remaining providers;
6. deadline failure + reroute;
7. human approval;
8. mission dashboard/timeline;
9. cross-origin hardening;
10. agent-readiness hardening;
11. deployment and demo recording.

## Submission readiness

Before submission:

- live working deployment;
- repository made public when submission rules require it;
- concise project description;
- architecture diagram;
- reliable demo script/video;
- WebMCP usage clearly visible;
- accessibility and agent-readiness scans recorded;
- no unsupported score claims.

## Anti-scope

Defer unrelated authentication complexity, production billing, real supplier onboarding, generalized workflow builders, global provider crawling, cryptographic identity, distributed discovery standards, and multi-scenario demos.
