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

### Issue #6 spike result: CROSS-ORIGIN VALIDATED

**Decision A — CROSS-ORIGIN VALIDATED (2026-08-30).** Cross-origin WebMCP was validated
end-to-end in the controlled NEXUS demo environment using Chrome 151 with WebMCP explicitly
enabled via `--enable-features=WebMCP`. The validated architecture uses the
standards-supported permission and origin controls described below. This result does not
mean WebMCP is enabled by default in Chrome 151 or in every Chrome runtime.

This decision is based on the current [Chrome imperative API documentation][chrome-api],
the [Chrome WebMCP security documentation][chrome-security], and the experimental
[Puppeteer WebMCP runtime requirements][puppeteer-webmcp]. It does not rely on the old
`navigator.modelContext` API.

### Reproduction architecture

The executable spike is `apps/webmcp-cross-origin-spike` and uses independent browsing
origins:

| Role | Local origin | Responsibility |
| --- | --- | --- |
| Authorized NEXUS consumer | `http://localhost:4100` | Embeds Provider B, explicitly requests its tools, and invokes one tool. |
| Independent Example Provider | `http://localhost:4200` | Owns availability data and logic and registers `check_availability`. |
| Unauthorized negative control | `http://localhost:4300` | Requests the same provider tool but is absent from the provider allowlist. |

`localhost` is used only as a potentially trustworthy local-development context. Deployed
origins must use HTTPS. The server sends `Origin-Agent-Cluster: ?1`, does not use
`document.domain`, and keeps every document origin-isolated as WebMCP requires.

The provider is a real cross-origin iframe, not a NEXUS proxy:

```html
<iframe src="http://localhost:4200" allow="tools"></iframe>
```

The `tools` Permissions Policy defaults to `self`, so `allow="tools"` is required for the
provider to register from a cross-origin iframe. Provider-owned catalog and availability
remain in the provider bundle. The same provider service powers the normal website button
and the registered WebMCP tool.

### Current API and dual origin authorization

Provider B registers with `document.modelContext.registerTool()` and exposes the tool only
to Origin A:

```ts
await document.modelContext.registerTool(tool, {
  exposedTo: ['http://localhost:4100'],
});
```

Origin A must separately opt in to discovery:

```ts
const tools = await document.modelContext.getTools({
  fromOrigins: ['http://localhost:4200'],
});
const tool = tools.find(
  ({ name, origin }) =>
    name === 'check_availability' && origin === 'http://localhost:4200',
);
const result = await document.modelContext.executeTool(
  tool,
  JSON.stringify({ itemId: 'desk-20', city: 'Guadalajara' }),
);
```

Both checks are required. `exposedTo` is supported by the current registration API and
restricts which secure consumer origins may see and execute a tool. `fromOrigins` is
supported by the current discovery API and restricts which secure hosting origins the
consumer is asking to include. Merely embedding the provider, setting `allow="tools"`, or
satisfying only one of these origin lists is insufficient.

The provider's `execute` callback runs in the provider's browsing context. The spike makes
that visible by incrementing `Provider-owned invocations` inside the provider iframe before
returning the typed availability result to the consumer.

### Exact runtime requirements

Both the initial unflagged check and the successful manual validation used this Chrome 151
user agent on the Mac Studio:

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36
```

The initial Codex in-app browser was not launched with the experimental WebMCP feature
enabled. In that runtime, the provider iframe did not expose `document.modelContext`;
registration returned `UNSUPPORTED`, while the normal provider availability button still
returned:

```json
{"itemId":"desk-20","city":"Guadalajara","available":true}
```

The successful end-to-end validation launched Chrome 151 with
`--enable-features=WebMCP`. Current Puppeteer documentation specifies Chrome 151+ plus this
flag. A compatible Chrome origin-trial configuration may also expose the API, but the demo
must verify the API rather than infer support from the Chrome version alone.

### Observed end-to-end validation

The manual preflight was executed on the Mac Studio after PR #14 merged. These are observed
browser results, not mocked expectations.

At the authorized consumer, `http://localhost:4100`:

- provider registration: `REGISTERED` from the independent provider at
  `http://localhost:4200`;
- provider tool: `check_availability`;
- WebMCP discovery succeeded through `getTools({ fromOrigins })`;
- WebMCP invocation succeeded through `executeTool()`;
- outcome: `AUTHORIZED_SUCCESS`;
- provider-owned invocation count changed from `0` to `1`;
- returned provider-owned result:

```json
{
  "ok": true,
  "data": {
    "itemId": "desk-20",
    "city": "Guadalajara",
    "available": true
  }
}
```

This proves execution reached provider-owned logic on the independent provider origin. It
was not a NEXUS-side simulation or REST proxy.

At the unauthorized consumer, `http://localhost:4300`:

- expected access: `UNAUTHORIZED`;
- provider registration remained `REGISTERED` at `http://localhost:4200`;
- outcome: `UNAUTHORIZED_BLOCKED`;
- browser/harness message:
  `check_availability was not exposed to http://localhost:4300.`;
- provider-owned invocation count remained `0`.

This proves the provider's `exposedTo` boundary prevented an origin outside its allowlist
from discovering or invoking the provider tool.

### Setup and manual verification

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm spike:webmcp
```

Launch a separate Chrome 151+ profile with WebMCP enabled. On macOS, adjust the executable
path to the installed Chrome 151+ channel:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir=/tmp/nexus-webmcp-issue-6 \
  --enable-features=WebMCP \
  http://localhost:4100
```

Then reproduce the recorded results:

1. At `http://localhost:4100`, confirm provider registration is `REGISTERED`.
2. Select **Discover and invoke provider tool**.
3. The validated positive output is `AUTHORIZED_SUCCESS`, a typed availability result, and a
   provider iframe invocation count of `1`.
4. Open `http://localhost:4300` in the same enabled profile.
5. Select **Discover and invoke provider tool**.
6. The validated negative output is `UNAUTHORIZED_BLOCKED`; `check_availability` must not be
   discoverable and provider-owned logic must not run.
7. Repeat without the WebMCP flag. Both consumers must report `UNSUPPORTED`, while **Check
   website availability** on the provider page must still work.

If the authorized path reports `AUTHORIZED_TOOL_NOT_VISIBLE`, `AUTHORIZED_FAILED`, or
`UNSUPPORTED`, the environment is not demo-ready. If the unauthorized path reports
`SECURITY_FAILURE`, stop: that runtime did not enforce the expected boundary.

### Automated coverage

Unit tests verify the deterministic parts of the contract: distinct origins, the iframe
Permissions Policy declaration, current `fromOrigins` discovery and JSON-string invocation
shape, the real provider page surface, and the provider-template behavior. They deliberately
do not mock browser permission enforcement. The browser permission boundary was validated
separately with the real manual harness because the repository's automation runtime cannot
add the experimental browser launch flag.

### Known limitations and hackathon fallback

- WebMCP remains experimental and subject to API/runtime changes.
- Chrome 151 without the feature flag is not sufficient, as the recorded run demonstrates.
- `exposedTo` and `fromOrigins` accept secure origins; production must use exact HTTPS
  origins rather than wildcards.
- A live browsing context is required; this is not a headless provider RPC mechanism.

For the hackathon, use the now-validated controlled NEXUS container at the authorized
origin, launch Chrome 151+ with WebMCP enabled, embed each independent HTTPS provider with
`allow="tools"`, and require the positive/negative preflight before presenting. If the
judged runtime cannot pass that preflight, fall back to visiting each independent provider
in an authorized browser/extension context and invoke its genuine page-owned WebMCP tools
there. Do not proxy provider tools or provider business data through NEXUS, and do not
represent this fallback as direct cross-origin invocation.

[chrome-api]: https://developer.chrome.com/docs/ai/webmcp/imperative-api
[chrome-security]: https://developer.chrome.com/docs/ai/webmcp/secure-tools
[puppeteer-webmcp]: https://pptr.dev/guides/webmcp

## Compatibility

Use the current supported `document.modelContext` API. Do not build new work around deprecated `navigator.modelContext` behavior.

The shared provider template registers each provider's own tools directly from its page:

```ts
await document.modelContext.registerTool(tool, {
  signal: abortController.signal,
  exposedTo: ['https://explicitly-authorized-agent.example'],
});
```

Registration is feature-detected and defensive. An unsupported browser or rejected tool
registration produces a typed result while the normal provider site remains usable.

## Provider template conventions

`@nexus/provider-template` defines three tool operation classes:

- `READ` — provider-owned lookup operations that do not change state;
- `PLAN` — provider-owned analysis/package construction without commitment;
- `COMMIT` — quote, reservation, installation or purchase actions.

Every tool reuses a provider-supplied validation function before invoking its normal
handler and returns the shared structured result/error shape. `COMMIT` definitions must
declare `requiresHumanApproval: true`; the template returns `REQUIRES_HUMAN` without
calling the handler until a validated approval record is present.

The template stores no catalog, price, stock, availability or provider constraint data.
Those remain behind injected provider services. The included development example exposes
a real `check_availability` WebMCP tool whose availability lookup is implemented by the
example provider service.

## Demo proof

The final demo must make it obvious that provider capabilities are being exposed and invoked through WebMCP. The Agent Activity Timeline should show provider + tool + outcome, including the FiberMX deadline failure and the NetBusiness reroute.
