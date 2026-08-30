# WebMCP Strategy

## Purpose

WebMCP must be architectural, not decorative. Each demo provider is an independent agent-ready site with useful tools tied to real user goals.

Preferred shape:

```text
Agent
  +-- WebMCP -> OfficePro
  +-- WebMCP -> TechSupply
  +-- WebMCP -> FiberMX / NetBusiness
  `-- WebMCP -> SecureNow
```

Avoid making the proof of concept fundamentally:

```text
Agent -> WebMCP -> NEXUS -> ordinary REST -> every provider
```

## Tool design rules

- Tools map to user goals, not arbitrary internal endpoints.
- Use clear names, descriptions and typed input/output schemas.
- Reuse provider API validation, authorization and rate limiting.
- Treat the agent as an untrusted client.
- Return structured errors and constraint failures.
- Keep read/planning actions distinct from commitment actions.
- Commitment actions require human confirmation.
- Registration should fail defensively rather than breaking the normal site.

## Initial tool candidates

### OfficePro
- `analyze_office_requirement`
- `search_furniture`
- `build_furniture_package`
- `check_delivery`
- `request_quote`

### TechSupply
- `search_computers`
- `check_inventory`
- `build_computer_package`
- `request_quote`

### FiberMX / NetBusiness
- `check_coverage`
- `check_installation_date`
- `build_connectivity_offer`

### SecureNow
- `assess_security_requirement`
- `build_security_package`
- `request_installation`

### NEXUS
- `accept_intent_handoff`
- `discover_providers`
- `route_requirement`
- `get_goal_state`

Exact tool count should stay small enough for a reliable demo. Target roughly 12–15 meaningful tools total.

## Cross-origin

Cross-origin WebMCP is a first-class technical spike. The implementation must validate the supported browser/client permission model early. Provider origins must be explicitly authorized where required. Do not postpone this validation until the final demo.

## Compatibility

Use the current supported `document.modelContext` API. Do not build new work around deprecated `navigator.modelContext` behavior.

## Demo proof

The final demo must make it obvious that provider capabilities are being exposed and invoked through WebMCP. The Agent Activity Timeline should show provider + tool + outcome, including the FiberMX deadline failure and the NetBusiness reroute.
