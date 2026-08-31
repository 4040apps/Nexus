# NEXUS Hero Demo Walkthrough

## Start

```bash
pnpm demo:hero
```

Wait for all six checkmarks and `Hero demo ready`, then open
<http://localhost:4400>. The command builds the workspace, starts NEXUS and all five
independent providers, and verifies every origin before declaring the demo ready.

## Exact click sequence

1. **Ask OfficePro** — furniture fulfilled, **40%**.
2. **Continue through NEXUS** — Intent Handoff is `PROPOSED`.
3. **Authorize NEXUS to continue** — human authorization is recorded and Broker Mode begins.
4. **Find computers** — TechSupply fulfills computers, **60%**.
5. **Find internet** — FiberMX becomes **BLOCKED · DELIVERY_DEADLINE**.
6. **Recover with another provider** — NetBusiness fulfills internet, **80%**.
7. **Find security** — SecureNow planning stops at **REQUIRES_HUMAN**; `request_installation` has not run.
8. **Approve and continue** — the approved commitment runs once and the mission reaches **100%**.

Final totals are **MXN 410,000 used** and **MXN 90,000 remaining**. The final screen and
canonical activity timeline retain the FiberMX failure, NetBusiness recovery, and
SecureNow human approval.

## WebMCP and fallback

Chrome 151+ launched with `--enable-features=WebMCP` can show **Genuine cross-origin
WebMCP** using the documented `document.modelContext`, `fromOrigins`, `exposedTo`, and
iframe `allow="tools"` model. Other browsers use the same provider-owned definitions via
the **Normal provider website fallback**. The UI never labels fallback activity as WebMCP.

## Reset and repeat

Choose **Reset mission** at any checkpoint. Reset returns to Brand Mode, 0% progress,
MXN 0 used, MXN 500,000 remaining, all requirements `PENDING`, and an empty canonical
activity timeline. It also clears the handoff, FiberMX history, SecureNow approval, and
ephemeral provider contexts. The full click sequence can then be run again without
restarting the six servers.

Snapshot query parameters remain available only for development and presentation testing;
the judged flow always starts at the query-free URL above.

For the production six-origin build, Cloudflare deployment, exact custom domains, and
post-deploy verification, see [deployment.md](deployment.md). The local walkthrough and
deterministic hero values remain unchanged.
