# WebMCP Strategy

## Production origin mapping

The validated permission model is preserved in production. Every independent provider
registers through `document.modelContext` with exact
`exposedTo: ['https://nexus.1expert.pro']`; NEXUS discovery passes only that provider's
exact HTTPS `1expert.pro` origin in `fromOrigins`, and its iframe retains `allow="tools"`.
The ordinary build uses the corresponding localhost origins. The production build embeds
only the fail-closed production map and never uses wildcard exposure or a provider proxy.
Deployment details are in [deployment.md](deployment.md).

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

## Complete hero reproduction through human approval

Issues #19–#23 apply the validated cross-origin model through failure, recovery, human
approval, and completion. Run:

```bash
pnpm demo:hero
```

The launcher reports the demo ready only after the NEXUS, OfficePro, TechSupply, FiberMX,
NetBusiness, and SecureNow origins all respond. `pnpm demo:officepro` remains an alias for
compatibility.

Then open `http://localhost:4400` and select **Ask OfficePro**. The provider at
`http://localhost:4500` registers four genuine tools through `document.modelContext` and
exposes them only to the NEXUS origin. For genuine cross-origin discovery/invocation,
launch Chrome 151+ with `--enable-features=WebMCP`, as documented in the Issue #6 setup.

Expected enabled result: the dashboard reports **Genuine cross-origin WebMCP**, records all
four tool names in canonical Goal State activity, fulfills desks/chairs, and reaches 40%
with MXN 155,000 used. Expected unsupported result: the dashboard explicitly reports
`document.modelContext` as unavailable and uses OfficePro's normal website message flow to
invoke the same provider-owned definitions. This fallback is not represented as WebMCP.
The embedded OfficePro page also has its own working **Check the OfficePro package** action.

Neither path invokes the commitment-class `request_quote` tool or copies OfficePro
catalog/stock records into NEXUS. After furniture fulfillment, **Continue through NEXUS**
creates a continuity-layer Intent Handoff; it is not an additional provider WebMCP tool.
The user reviews the three remaining requirements and MXN 345,000 budget, then explicitly
authorizes execution. Broker Mode remains locked through `PROPOSED` and `AUTHORIZED` and
is enabled only by `EXECUTED`.

After execution, select **Find computers**. The independent TechSupply provider at
`http://localhost:4600` registers `search_computers`, `check_inventory`, and
`build_computer_package` through `document.modelContext`, with `exposedTo` limited to NEXUS.
NEXUS separately opts into that origin through `fromOrigins`, invokes only those three
read/plan tools, and validates quantity, inventory, price, currency, and delivery before
returning a Goal State update. The commitment-class `request_quote` tool is not part of the
live sequence. With WebMCP unavailable, the normal TechSupply page remains usable and the
dashboard labels the website transport rather than claiming WebMCP success.

The computer checkpoint is 60% progress, MXN 345,000 used, MXN 155,000 remaining, and
internet/security pending. Provider catalog, item and package identifiers, stock, and unit
price are not persisted by NEXUS.

Next select **Find internet**. FiberMX at `http://localhost:4700` exposes the three current
read/plan tools `check_coverage`, `check_installation_date`, and
`build_connectivity_offer`. NEXUS uses `fromOrigins: ['http://localhost:4700']`; FiberMX
uses `exposedTo: ['http://localhost:4400']`. The provider confirms coverage but returns
2026-10-08 against the 2026-10-01 deadline. The dashboard must stop at a visible
`BLOCKED` / `DELIVERY_DEADLINE` state with 60% progress and unchanged used budget.

Select **Recover with another provider**. NEXUS preserves the FiberMX failure, discovers
NetBusiness from thin metadata, and invokes the same three provider-owned capabilities at
`http://localhost:4800` using the exact-origin permission model. NetBusiness returns
2026-09-25 and MXN 27,500. Expected final Issue #22 state: internet `FULFILLED`, FiberMX in
failure history, 80% progress, MXN 372,500 used, MXN 127,500 remaining, and security still
`PENDING`. Neither provider's offer identifier or complete tool results are stored by
NEXUS. No commitment-class tool is invoked.

Without WebMCP, both independent provider websites remain functional and NEXUS explicitly
labels the normal website message transport. This is a reproducible fallback, not a claim
of cross-origin WebMCP success.

Finally select **Find security**. SecureNow at `http://localhost:4900` registers
`assess_security_requirement`, `build_security_package`, and `request_installation`, using
`exposedTo: ['http://localhost:4400']`; NEXUS opts into that exact origin with
`fromOrigins`. Only the READ/PLAN pair runs initially. The dashboard displays the MXN
37,500, Sep 27 proposal and stops at `REQUIRES_HUMAN`; the COMMIT tool has not been called.

Selecting **Not now** leaves the proposal uncommitted. Selecting **Approve and continue**
records a human approval bound to the goal, security requirement, SecureNow, expected
total, currency, `request_installation` action, and proposal scope. Only after that audit
event does NEXUS discover/invoke the COMMIT tool. The provider template and SecureNow’s
normal validation both reject missing or unrelated approval. Successful commitment reaches
100%, MXN 410,000 used, and MXN 90,000 remaining.

In an unsupported browser, SecureNow’s normal page can build the same non-binding plan but
cannot request installation. The NEXUS fallback sends the commitment to the provider only
after the same explicit approval and labels the transport as website fallback. It never
claims WebMCP success. In Chrome 151+ launched with `--enable-features=WebMCP`, the enabled
path uses genuine cross-origin discovery and execution on the SecureNow origin.

## Demo proof

The final demo must make it obvious that provider capabilities are being exposed and invoked through WebMCP. The Agent Activity Timeline should show provider + tool + outcome, including the FiberMX deadline failure, NetBusiness reroute, human approval, and SecureNow commitment.
