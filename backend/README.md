# Vibestudio Backend

Node.js + TypeScript + Fastify backend with Clerk JWT authentication and local dev tokens.

## Layout

```
src/
  index.ts            # entry point (binds port, graceful shutdown)
  app.ts              # Fastify app factory (used by tests via inject)
  config/env.ts       # zod-validated environment config
  lib/logger.ts       # pino structured logger
  routes/health.ts    # GET /health
  routes/imports.ts   # POST /imports/zip | /imports/github | /imports/url
  routes/snapshots.ts # POST /imports/:importId/snapshot
  routes/classify.ts  # POST /imports/:importId/classify
  routes/generate.ts  # POST /imports/:importId/generate
  routes/export.ts    # POST /projects/:projectId/export | /imports/:importId/export
  routes/assets.ts    # POST /projects/:projectId/assets (B8 image upload)
  routes/versions.ts  # POST/GET /projects/:projectId/versions (B8/B9 tree checkpoints)
  routes/deploy.ts    # GET/POST deploy + POST domain (B10)
  routes/assistant.ts # POST /assistant (B12 TreePatch proposals)
  routes/cleanup.ts   # POST /cleanup + /projects/:id/cleanup (B13)
  routes/sync.ts      # WS /projects/:id/pages/:pageId/sync (B15)
  services/
    import/           # zip / GitHub / live-URL → normalized stored project
    snapshot/         # Playwright DOM snapshots (computed styles, layout, screenshots)
    classifier/       # snapshot → widget tree (pure heuristics + service wrapper)
    codegen/          # widget tree → static HTML/CSS bundle (pure generator + service wrapper)
    export/           # codegen bundle → downloadable zip + signed URL
    assets/           # multipart image upload → signed URL (B8)
    versions/         # durable widget-tree checkpoints (B8/B9)
    storage/          # Postgres + S3 persistence boundary
    deploy/           # codegen → publish snapshot + status/domain (B10)
    ai-agent/         # heuristic (or Anthropic) → TreePatch proposals (B12)
    cleanup/          # B13 "clean up this import" restructuring proposals
    auth/             # B14 JWT (Clerk) + local HS256 dev tokens
    projects/         # B14 project/import ownership checks
    sync/             # B15 ephemeral page patch hub (last-write-wins)
test/
  smoke.test.ts       # vitest smoke test
  import.test.ts      # import service (hermetic, in-memory fakes)
  snapshot.test.ts    # snapshot service (real headless Chromium, no network)
  classifier.test.ts  # classifier (pure unit tests + 6 rendered fixture sites)
  codegen.test.ts     # codegen (pure HTML/CSS generation + service wrapper)
  roundtrip.test.ts   # round-trip fidelity: import → classify → codegen → pixel diff
  export.test.ts      # export zip + signed URL
  assets.test.ts      # asset upload
  versions.test.ts    # tree versions
  deploy.test.ts      # deploy + domain
  assistant.test.ts   # AI agent heuristic patches
  cleanup.test.ts     # B13 cleanup proposals + visual parity
  auth.test.ts        # B14 JWT + ownership
  sync.test.ts        # B15 WebSocket patch hub
  fixtures/sites/     # static fixture sites (hand-written + Tailwind-style)
```


## DOM Snapshot Service

`POST /imports/:importId/snapshot` renders a completed import in headless
Chromium and stores, per reachable page (same-origin crawl, max 20 pages):

- `projects/{projectId}/snapshots/{slug}.json` — post-JS serialized HTML,
  per-element computed styles + bounding boxes, script references
- `projects/{projectId}/snapshots/{slug}.{desktop|tablet|mobile}.png`

Zip/GitHub imports are served to the browser via request interception
(no port bound, external network blocked); live-URL imports are re-rendered
from their original URL. The import row moves through
`snapshotting → snapshotted | snapshot_failed`.

Requires the Playwright Chromium binary: `npx playwright install chromium`.

Each snapshot also carries `breakpointStyles` — sparse computed-style
diffs at tablet (768) and mobile (375) widths versus the desktop
baseline, keyed by each element's pre-order index. Opaque elements
(svg, canvas, iframe, media, custom elements) keep their verbatim
`outerHTML`, and inline `<script>` sources are captured for behaviors.

## DOM → Widget Classifier

`POST /imports/:importId/classify` (requires status `snapshotted`) loads
every stored `PageSnapshot` and runs `classifySnapshot()` — a pure
function, snapshot JSON in → widget tree JSON out — storing one
`ClassifiedPage` document per page at `projects/{projectId}/tree/{slug}.json`:

- `tree` — a `WidgetTree` (schema v1: Page → Section → Row → Column →
  Widget) with per-node `meta.confidence` + rationale (`meta.notes`),
  desktop baseline styles, and tablet/mobile overrides emitted only
  where computed values actually changed.
- `stats` — widget counts by type and `cleanMappingRate` (share of
  widgets mapped to a specific type vs `custom-html`; PRD target >85%).
- `lowConfidence` — nodes under the 0.7 confidence threshold, for
  manual review / AI-assistant context.

Heuristics, in order: semantic/visual section detection → flex/grid
row+column inference (bounding boxes decide similarity) → leaf widget
mapping (img/h*/p/a/button/svg/icon-font/ul/ol/video/iframe) →
`custom-html` fallback preserving verbatim markup with subtree scripts
attached as `behaviors`. Unclaimed page scripts land on the page node.

Fixture suite baseline (test/classifier.test.ts): 79 widgets across six
sites, 93.7% clean mapping (the only fallbacks are the deliberate hard
cases: canvas, complex svg, custom element, form, table).

## Widget Tree → Static Site Codegen

`POST /imports/:importId/generate` (requires stored trees under
`projects/{projectId}/tree/`) runs `generatePage()` — a pure,
deterministic function, widget tree in → HTML + CSS out — and stores a
self-contained bundle at `projects/{projectId}/generated/`:

- `{slug}.html` + `{slug}.css` per classified page, plus all source
  assets copied through (images, media, non-page HTML like iframe
  embeds) so relative references keep resolving.
- Semantic HTML per widget type (`heading → h1-6`, `button → a/button`,
  `list → ul/ol`, sections reuse their original `header/footer/nav/...`
  tag), with accessibility props (`alt`, `ariaLabel`) emitted.
- Scoped CSS: one deterministic class per node (`vs-{nodeId}`), never
  inline styles; tablet/mobile overrides become real media queries
  (`max-width: 1024px` / `480px`). Since both breakpoint diffs are
  captured against the desktop baseline, tablet-only overrides are
  explicitly reverted inside the mobile query.
- `behaviors` scripts are re-attached next to their subtree: the owning
  element gets `id="vs-{nodeId}"` and the `<script>` carries
  `data-vs-behavior` / `data-vs-scope`. External scripts re-emit their
  `src`.
- Global design tokens compile to `:root { --token-id: ... }` custom
  properties; style values referencing tokens emit `var(--token-id)`.
- Verbatim `custom-html` / `embed` / inline-svg markup is emitted
  unwrapped — the scoped class is injected into the fragment's root tag
  so captured styles still apply without changing flow.

Round-trip fidelity (test/roundtrip.test.ts) re-renders each generated
bundle through the same hermetic snapshot pipeline and pixel-diffs the
screenshots against the originals at all three breakpoints
(pass ≤ 1.5% differing pixels).

## Export (clean HTML/CSS zip)

`POST /projects/:projectId/export` (or `/imports/:importId/export`)
bundles the generated static site into a downloadable zip and returns a
signed URL:

```json
{
  "projectId": "…", "exportId": "exp_…",
  "zipKey": "projects/…/exports/exp_….zip",
  "downloadUrl": "https://… (signed, 15 min)",
  "expiresAt": "…", "fileCount": 12, "totalBytes": 34567
}
```

Export has **no rendering path of its own**: it calls the same
`CodegenService.generateProject()` that deploy runs, then zips whatever
landed under `projects/{projectId}/generated/`. So an exported zip is
byte-for-byte the files that would go live — there is no "export-only"
output that could drift from the deployed site (a test asserts the
unzipped bytes equal a direct codegen run). The zip is stored at
`projects/{projectId}/exports/{exportId}.zip`; the download URL is a
time-limited `ObjectStore.signedUrl()` (S3 presigned GET in production,
a stable `memory://` URL in tests).

## Assets (B8)

`POST /projects/:projectId/assets` (multipart field `file`) stores an image
under `projects/{projectId}/assets/{assetId}{ext}` and returns a signed URL
the editor can write into `ImageWidgetProps.src` (replacing data-URL stopgaps).

## Tree versions (B8/B9)

`POST /projects/:projectId/versions` with `{ tree, label?, source? }` writes a
durable checkpoint at `projects/{projectId}/versions/{versionId}.json`,
separate from the frontend in-session undo stack. List with
`GET /projects/:projectId/versions`.

## Deploy (B10)

- `GET  /projects/:projectId/deploy` — lifecycle (`never` | `deploying` | `live` | …)
- `POST /projects/:projectId/deploy` — run shared codegen, snapshot the bundle
  under `projects/{id}/deploys/{deployId}/`, mark live with a preview URL
- `POST /projects/:projectId/domain` — attach a custom hostname (`pending` DNS)

Preview URLs are minted from `DEPLOY_BASE_URL` (path-style
`/{target}/{projectSlug}/`). Real CDN upload can replace the copy step later
without changing the route contract.

## AI assistant (B12)

`POST /assistant` with `{ projectId, userMessage, tree }` returns
`{ patches: TreePatch[], assistantMessage }`. Without `ANTHROPIC_API_KEY` a
deterministic heuristic proposer runs (color / heading / spacing) so the
editor Accept/Reject flow works end-to-end. Wire Anthropic Messages +
`AI_ASSISTANT_TOOLS` when a key is available.

## Authentication (B14)

All API routes except `GET /health` require a bearer token when auth is enabled.
Project and import routes also verify the authenticated JWT subject against the
project's persisted `owner_id`; inaccessible resources return 404 to avoid
revealing another user's identifiers.

- Production: set `AUTH_MODE=clerk`, `CLERK_JWKS_URL`, and `CLERK_ISSUER`.
- Local development: set `AUTH_MODE=dev`, then generate an eight-hour token:

```bash
npm run auth:seed -- --user local-user --email local@example.com
```

Copy the printed `Authorization: Bearer ...` header into API requests. New
imports created with that token are owned by `local-user`. `AUTH_MODE=off` is
available for tests and local migration work, but startup rejects it when
`NODE_ENV=production`.

## Realtime page sync (B15)

`WS GET /projects/:projectId/pages/:pageId/sync` is an **ephemeral**,
**server-ordered** patch hub for keeping multiple open editor tabs (and
AI-assistant-driven clients) in sync on the same page.

Wire protocol (JSON text frames):

| Direction | `type` | Purpose |
|-----------|--------|---------|
| server → client | `welcome` | Current `revision`, assigned `clientId`, policy flags |
| client → server | `submit_patch` | `{ patch: TreePatch, baseRevision?, clientId? }` |
| server → all | `patch_applied` | Accepted patch + new monotonic `revision` |
| client → server | `ping` | Keepalive |
| server → client | `pong` / `error` | Keepalive reply / validation failure |

- **Patch shape** is the same B12 `TreePatch` used by `/assistant` and cleanup.
- **Last-write-wins (v1):** the hub accepts every structurally valid patch in
  arrival order and assigns `revision = previous + 1`. If the client sends a
  lagging `baseRevision`, the frame is still accepted and flagged
  `stale: true` — there is no OT/CRDT merge.
- **Ephemeral:** rooms live only in process memory and drop when the last
  subscriber disconnects. Process restarts reset revisions to 0.
- **Auth:** the B14 plugin protects the upgrade via `projectId` ownership
  (send `Authorization: Bearer …` on the WebSocket handshake).

### Not real multiplayer (PRD non-goal)

For true collaborative editing later you would need at least: reject/transform
on revision mismatch (OT/CRDT), a durable event log for reconnect catch-up,
presence/cursors, finer-grained sharing than project owner, and cross-instance
fan-out (e.g. Redis). Call sites should treat v1 as “multi-tab / AI fan-out”,
not multi-user coediting.

## Development

```bash
cp .env.example .env
npm install
npm run dev          # tsx watch mode on :3000
npm test             # vitest
npm run typecheck
```

## Local infrastructure

```bash
docker compose up -d postgres minio minio-init
```

- Postgres: `localhost:5432` (vibestudio / vibestudio)
- MinIO S3 API: `http://localhost:9000`, console at `http://localhost:9001` (minioadmin / minioadmin)
- Bucket `vibestudio-dev` is created automatically by the `minio-init` job.

To run the API itself in Docker too: `docker compose up --build`.
