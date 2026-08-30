# NEXUS Architecture

## Thesis

NEXUS is the continuity layer between independent agent-ready websites. The unit of continuity is the user's **Goal State**, not a browser page or a provider session.

```text
HUMAN INTENT
    |
    v
Provider A / WebMCP
    |
    | partial fulfillment
    v
Intent Handoff (explicit consent)
    |
    v
NEXUS Registry + Goal State
    |
    +--> Provider B / WebMCP
    +--> Provider C / WebMCP
    |
    +--> blocked provider -> reroute
    |
    v
Human approval for commitment
    |
    v
GOAL COMPLETE
```

## Modes

### Brand Mode
The user deliberately visits a provider. The agent uses that provider's WebMCP capabilities and does not silently divert equivalent demand to competitors.

### Broker Mode
The user explicitly authorizes NEXUS to continue unresolved requirements. NEXUS may discover and route remaining needs across providers.

## Goal State contract

```ts
type RequirementStatus =
  | 'PENDING'
  | 'DISCOVERED'
  | 'MATCHED'
  | 'PROPOSED'
  | 'BLOCKED'
  | 'REQUIRES_HUMAN'
  | 'FULFILLED';

type GoalState = {
  id: string;
  goal: string;
  constraints: {
    city: string;
    employees: number;
    budget: number;
    currency: 'MXN';
    deadline: string;
  };
  requirements: Requirement[];
  budgetUsed: number;
  budgetRemaining: number;
  progress: number;
  activity: ActivityEvent[];
};

type Requirement = {
  id: string;
  type: string;
  quantity?: number;
  status: RequirementStatus;
  providerId?: string;
  estimatedCost?: number;
  blocker?: {
    code: string;
    message: string;
  };
  approval?: {
    required: boolean;
    approved: boolean;
  };
  failureHistory?: Array<{
    providerId?: string;
    blocker: {
      code: string;
      message: string;
    };
    activityEventId: string;
    occurredAt: string;
  }>;
};
```

The implementation may refine this TypeScript shape, but semantic changes require documentation and tests.

`budgetUsed` is derived from the estimated cost of `FULFILLED` requirements only;
proposals and pending approvals are not commitments. `budgetRemaining` is the goal
budget minus that derived amount. `progress` is the rounded percentage of requirements
whose status is `FULFILLED` (or `0` when there are no requirements).

State changes are immutable. The caller supplies stable event IDs and timestamps so
each material transition can append a deterministic, auditable `ActivityEvent`.

## Intent Handoff contract

An Intent Handoff has three explicit lifecycle stages:

```text
PROPOSED (Brand Mode, not authorized)
  -> AUTHORIZED (explicit human consent recorded)
  -> EXECUTED (Broker Mode routing may begin)
```

The proposal and authorization records share the same minimized continuation data, but
only the executed payload is an `IntentHandoff`:

```ts
type IntentHandoff = {
  handoffId: string;
  goalId: string;
  status: 'EXECUTED';
  source: {
    providerId: string;
    mode: 'BRAND';
  };
  destination: {
    type: 'NEXUS';
    mode: 'BROKER';
  };
  authorizedByUser: true;
  authorization: {
    required: true;
    approved: true;
    approvedAt: string;
  };
  executedAt: string;
  constraints: {
    city: string;
    employees: number;
    deadline: string;
    remainingBudget: number;
    currency: 'MXN';
  };
  remainingRequirements: Array<{
    id: string;
    type: string;
    quantity?: number;
  }>;
};
```

The payload is projected from Goal State rather than copying Goal State wholesale.
Fulfilled requirements, provider assignments, estimates, blockers, catalogs, stock,
prices, activity history and unrelated customer/provider data are not transferred.
Broker routing is allowed only for a validated `EXECUTED` handoff with explicit approval.

The Goal State timeline records `HANDOFF_PROPOSED`, `HANDOFF_AUTHORIZED`, and
`HANDOFF_EXECUTED` as goal-level audit events; these do not change requirement statuses.

## Registry contract

NEXUS registry is intentionally thin:

```ts
type ProviderRegistryEntry = {
  id: string;
  name: string;
  origin: string;
  categories: string[];
  serviceAreas: string[];
  capabilities: string[];
  agentReadiness?: {
    score?: number;
    source: 'external' | 'demo';
  };
};
```

Prices, stock, installation slots and catalogs remain provider-owned and are queried through provider capabilities.

## Demo providers

- OfficePro — desks/chairs; initial Brand Mode provider.
- TechSupply — computers.
- FiberMX — internet; deliberately fails the deadline constraint.
- NetBusiness — internet fallback; succeeds before deadline.
- SecureNow — security; requires human approval before commitment.

Synthetic provider data should create meaningful tradeoffs rather than a trivial all-success path.

### Deterministic hero fixtures

Each provider app owns its own minimal fixture data and exposes it through genuine
provider-template tools. NEXUS may retain only the thin discovery metadata derived from
those tools; it does not store these prices, stock levels, or dates.

| Provider | Deterministic behavior | Mission cost |
| --- | --- | ---: |
| OfficePro | 20 desks for MXN 80,000 and 20 chairs for MXN 75,000; delivery 2026-09-20 | MXN 155,000 |
| TechSupply | 20 business laptops in stock; delivery 2026-09-22 | MXN 190,000 |
| FiberMX | Guadalajara coverage, but earliest installation 2026-10-08 produces `BLOCKED` / `DELIVERY_DEADLINE` | Not committed |
| NetBusiness | Guadalajara coverage and installation 2026-09-25 after reroute | MXN 27,500 |
| SecureNow | Package installation 2026-09-27; commitment pauses at `REQUIRES_HUMAN` until approval | MXN 37,500 |

The approved final mission cost is exactly MXN 410,000, leaving MXN 90,000 of the
MXN 500,000 budget. The FiberMX blocker remains in requirement failure history after the
NetBusiness reroute, and the SecureNow approval remains in the requirement and activity
timeline.

## State transitions

```text
PENDING
  -> DISCOVERED
  -> MATCHED
  -> PROPOSED
       |-> BLOCKED -> REROUTE -> MATCHED
       |-> REQUIRES_HUMAN -> FULFILLED
       `-> FULFILLED
```

Every material transition should append an ActivityEvent so the UI can explain what the agent did and why.

## Failure and recovery

Failures are structured outcomes, not exceptions hidden from the mission UI. Example:

```json
{
  "status": "BLOCKED",
  "providerId": "fibermx",
  "code": "DELIVERY_DEADLINE",
  "availableDate": "2026-10-08",
  "requiredBy": "2026-10-01"
}
```

NEXUS should preserve the failure in the timeline and reroute only the unresolved requirement.
When a blocked requirement is rerouted, its current blocker is cleared as it returns to
`MATCHED`, while the structured blocker remains in `failureHistory` and in the reroute
timeline event.

## Human approval boundary

Read/search/availability/planning operations may execute autonomously. Actions that create a material commitment must return `REQUIRES_HUMAN` before execution.

## Technical risk

Cross-origin WebMCP is the primary integration risk. Implement the simplest stable authorized-origin/container path first. Do not fake provider independence by moving all provider behavior behind NEXUS REST endpoints.
