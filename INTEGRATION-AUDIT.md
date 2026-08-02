# Reframely FE↔BE Integration Audit

**Date:** 2026-07-29  
**Workspace:** `C:\tmp\Reframely`
**Live services checked:** frontend Vite `:5173`, backend Fastify `:3000`  
**Infra (original audit):** MinIO/Postgres down; no `.env`  

### P0 remediation (same day, post-audit)

Implemented and verified live:

| Item | Status |
|------|--------|
| FE auth headers + `GET /auth/dev-token` bootstrap | Done (`AUTH_MODE=dev`) |
| `GET /projects/:id/tree` + import → `setTree` handoff | Done |
| `LayoutStyles.order` on backend schema | Done |
| Local no-Docker storage (`STORAGE_BACKEND=fs`, `IMPORT_REPO_BACKEND=file`) | Done |
| Live E2E: dev-token → zip import → snapshot → classify → tree | **PASS** (hand-hero fixture) |

Original scorecard below is the **pre-fix** snapshot.

---

## Scorecard (one line per step)

| # | Step | Result |
|---|------|--------|
| 1 | Auth wiring (AUTH_MODE=dev / real flow) | **FAIL** |
| 2 | Schema parity (FE vs BE tree types) | **FAIL** (silent drift) |
| 3 | Import flow F2 → B2/B3/B4 → canvas F3 | **FAIL** (also **BLOCKED** by infra + tree handoff) |
| 4 | Canvas + selection F3/F4 on real import | **BLOCKED** by step 3 |
| 5 | Panels + persistence F6/F7/F8 → B8/B9 | **FAIL** (round-trip incomplete; storage down) |
| 6 | Asset upload F8 → B8 | **FAIL** (FE not wired; storage down) |
| 7 | Deploy F16 → B10/B11 + export | **FAIL** / partial (API exists; FE mocks on error; storage down) |
| 8 | AI assistant F17 → B12 | **PASS** (backend shape OK; FE falls back to mock on any API error) |
| 9 | Realtime sync F15/B15 | **NOT YET WIRED** (backend only) |

---

## 1. Auth wiring — **FAIL**

### What we observed
- No `backend/.env` on disk. `AUTH_MODE` therefore defaults to **`off`** (`backend/src/config/env.ts`).
- Live `GET /health` → **200** `{"status":"ok",...}`.
- Live `GET /projects/test/versions` → **500** with `ECONNREFUSED` (object store), **not** 401 — confirms auth is currently off, not enforcing bearer tokens.
- Frontend `frontend/src/lib/api/client.ts` never sets `Authorization` on `fetch` / `XMLHttpRequest` (headers are only `content-type` for JSON; zip upload has none).
- No FE store/hook for Clerk, dev token, or `localStorage` token.
- `.env.example` recommends `AUTH_MODE=dev` + `npm run auth:seed`; that path is not connected to the UI.

### Exact failure modes
| Scenario | Result |
|----------|--------|
| Current live (`AUTH_MODE=off`) | FE can call APIs without tokens; auth “works” only by being disabled |
| Intended `AUTH_MODE=dev` | **Would 401 every FE call** — no bearer on requests |
| Production `AUTH_MODE=clerk` | **Would 401** — no Clerk session wiring |

### Likely cause
- `frontend/src/lib/api/client.ts` — `postJson` / `uploadZip` / `getDeployStatus` lack auth headers.
- Missing env boot for local dev (`backend/.env`).

### Fix-first note
This **blocks a correct B14-protected integration**. Today’s open mode hides the bug. Wire FE bearer (dev token seed or Clerk) **before** enabling `AUTH_MODE=dev` in a shared environment.

---

## 2. Schema parity — **FAIL**

Canonical claim: both mirrors of root `widget-tree-schema.ts`.

### Field-level drift found

| Area | Frontend | Backend | Root `widget-tree-schema.ts` | Severity |
|------|----------|---------|------------------------------|----------|
| `LayoutStyles.order` | **Present** (`frontend/src/lib/schema.ts:106`) | **Missing** (`backend/src/services/classifier/schema.ts` LayoutStyles ends at flex/boxSizing/gap/…) | **Present** (`widget-tree-schema.ts:132`) | **FAIL** — FE breakpoint reorder can emit `order` that BE types/validators don’t model |
| `WidgetType` / `NodeType` / `Breakpoint` enums | Same set | Same set | Same | OK |
| Widget props shapes (text/heading/image/button/icon/list/video/embed/custom-html) | Align | Align | Align | OK |
| `ResponsiveStyles` (desktop required; tablet/mobile optional) | Align | Align | Align | OK |
| `TreePatch` ops list | Align (`frontend/src/lib/tree-patch.ts` vs `backend/src/lib/tree-patch.ts`) | Align | N/A | OK at type level |
| Tree **storage envelope** | FE expects a bare `WidgetTree` in editor | Classifier stores **`ClassifiedPage`** `{ tree, stats, lowConfidence }` at `treeKey` | N/A | **FAIL** as integration contract (not TypeScript mirror, but load path) |

### Why this matters even without a crash
FE can set `styles.desktop.order` / tablet/mobile order for visual reorder (`tree-reorder-bp.ts`). Backend patch validation / future server apply paths do not declare `order`. Drift is silent until a server-side apply/export path strips or rejects it.

---

## 3. Import flow (F2 → B2/B3/B4) — **FAIL** (+ infra **BLOCKED**)

### Pipeline as coded (FE)
`import-store.ts`:
1. `POST /imports/{zip|github|url}` → `ImportResult`
2. `POST /imports/:id/snapshot`
3. `POST /imports/:id/classify` → `ClassifyImportResult`
4. Sets `phase: 'ready'` + **summary stats only**

### Critical integration gap
- Classify response gives `pages[].treeKey` (object-store key), **not** the tree JSON.
- **No FE API** to fetch `treeKey` / classified page.
- **No call** to `useTreeStore.setTree(...)` after import.
- Editor always starts with **`sampleTree`** (`tree-store.ts` initial state).

So even a successful backend import would leave the canvas on the demo fixture.

### Live probe
```
POST /imports/zip (hand-hero fixture zip)
→ HTTP 500  {"statusCode":500,"code":"ECONNREFUSED",...}
```
MinIO not running; import cannot store files. Postgres also unreachable for metadata.

### Likely causes
1. **Handoff bug:** `frontend/src/stores/import-store.ts` (~89–97) never loads tree.  
2. **Missing endpoint:** no `GET` for classified tree (or FE never uses signed URL).  
3. **Infra:** MinIO/Postgres required for real import; both down.

---

## 4. Canvas + selection (F3/F4) — **BLOCKED** by step 3

### Design (would pass against a real tree)
- Codegen stamps `vs-{nodeId}` classes (`codegen` + `bridge-script.ts`).
- Canvas bridge resolves selection via `classList` prefix `vs-` (`bridge-script.ts` `nodeIdOf`).
- Protocol uses bare `nodeId` strings (`protocol.ts`).

### Why BLOCKED
No real classified tree is ever loaded into the editor after import. Selection only exercises **sample-tree ids**, not backend UUID/`node-*` ids from classifier.

Cannot confirm id parity against a live import response until step 3 handoff exists and infra is up.

---

## 5. Panels + persistence (F6/F7/F8 → B8/B9) — **FAIL**

### What works locally (optimistic)
- Style / content / reorder mutate `tree-store` via `commit` (one undo step).
- Autosave hooks `past` growth → `scheduleVersionAutosave` → `persistTreeVersion`.

### Backend contract
- `POST /projects/:projectId/versions` with `{ tree, label?, source? }` exists (`versions.ts`).
- `GET` list + get-by-id exist on backend.
- FE **only POSTs** save; has **no client** for `GET /versions` or `GET /versions/:id` to restore after reload.
- On remote failure, FE **silently falls back to localStorage** (`version-persist.ts` lines 78–83, 96–98) — reload can show local cache while never verifying B8.

### Live probe
```
POST /projects/demo-proj/versions  { tree: ... }
→ HTTP 500  ECONNREFUSED (S3/MinIO)
```

### Round-trip requirements vs reality
| Requirement | Status |
|-------------|--------|
| Style edit local re-render | Works (local only) |
| Content edit local re-render | Works (local only) |
| Drag reorder local re-render | Works (local only) |
| Persist via B8 remote | **FAIL** (storage down + auth gap if enabled) |
| Retrieve as new version B9 on reload | **FAIL** — no FE hydrate-from-server path |
| Not just optimistic state | **FAIL** |

**Likely cause:** missing list/get version client + reload hydrate; MinIO down for put.

---

## 6. Asset upload (F8 → B8) — **FAIL**

### Backend
- `POST /projects/:projectId/assets` multipart field `file` (`routes/assets.ts`) — implemented.

### Frontend
- `api` client has **no** `uploadAsset` method.
- `image-content.tsx` reads file as **data URL** via `FileReader` (explicit stopgap comment lines 11–13, 22–34).
- No returned signed URL, no fetchability check against object storage.

### Live
Would require MinIO; currently down.

---

## 7. Deploy + export (F16 → B10/B11) — **FAIL** (partial API)

### Backend
- Deploy + domain routes implemented; share codegen with export.
- Export returns zip + signed download URL.

### Frontend
- `deploy-store.ts` tries real API then **mocks on any `ApiError`/`NetworkError`** (lines 125–137) — UI can show “live” with `usedMock: true` without a real deploy.
- Export tries real API; will fail if storage/codegen prerequisites missing.

### Live
Cannot complete real deploy/export without classified trees in object store (MinIO) and a real `projectId` from import.

### Codegen parity note
Backend deploy/export intentionally share `CodegenService`. FE also has local `lib/codegen.ts` for canvas — **two generators**. Pixel/HTML identity between canvas and deploy is not guaranteed until both use one path or tests assert equivalence.

---

## 8. AI assistant (F17 → B12) — **PASS** (with caveats)

### Live backend probe (storage not required)
```
POST /assistant
→ 200
{
  "patches": [{
    "patchId": "pat_…",
    "createdAt": "…",
    "confidence": 0.92,
    "rationale": "Update the site accent token…",
    "affectedNodeIds": [],
    "operations": [{ "op": "set_color_token", "tokenId": "color-accent", "value": "#7c3aed" }]
  }],
  "assistantMessage": "I'll update the global accent token to #7c3aed…"
}
```
Matches FE `TreePatch` / `isTreePatch` (`tree-patch.ts:261–270`).

### Frontend path
- `assistant-store.ts` calls `api.runAssistant`; on **any** network/API error, falls back to `mockAssistantPatches` (lines 109–113).
- **Accept** uses `useTreeStore.commit((tree) => applyTreePatch(tree, patch))` — **same mutation path** as manual edits (good).

### Caveats (not hard FAIL for this step)
- Accept does not go through B15 sync or force a version flush.
- With auth on and no bearer, FE would silently use mock while user thinks AI is live.
- Operates on **sampleTree** until import handoff is fixed.

---

## 9. Realtime sync (B15 / F15) — **NOT YET WIRED**

### Backend (done)
- `WS GET /projects/:projectId/pages/:pageId/sync`
- TreePatch broadcast, server revision LWW, B14 ownership on upgrade
- Tests in `backend/test/sync.test.ts` (unit + injectWS)

### Frontend
- **No** `WebSocket` client, no `/sync` usage under `frontend/src` (only unrelated “sync” comment in `code-sync.ts`).
- Multi-tab edit will **not** update peer sessions.

### Non-owner rejection
- Enforceable on backend only; cannot be exercised from FE client (none).

---

## Cross-cutting environment blockers

These are not FE/BE schema bugs but **block live E2E** for steps 3–7:

1. **MinIO not running** — all object-store ops → `ECONNREFUSED` 500  
2. **Postgres not running** — import metadata migrations/writes fail  
3. **No `backend/.env`** — defaults (`AUTH_MODE=off`, local URLs)  
4. **Docker CLI not available** in this shell (`docker` not recognized) — `docker compose up` not verifiable here  

---

## Prioritized fix list

Ordered for “unblock integration,” schema drift first as requested, then hard blockers for later steps.

### P0 — Unblocks almost everything after

1. **Import → editor tree handoff**  
   - After classify, fetch `ClassifiedPage` from `treeKey` (need signed GET or new `GET /projects/:id/tree` that returns `WidgetTree`).  
   - Call `useTreeStore.setTree(classified.tree)`.  
   - Files: `import-store.ts`, `api/client.ts`, likely new backend route or asset URL helper.

2. **FE auth headers + local dev token**  
   - Attach `Authorization: Bearer …` on all API (and future WS) calls.  
   - `AUTH_MODE=dev` + seed token in localStorage/env.  
   - Files: `api/client.ts`, small auth helper; `backend/.env` from `.env.example`.

3. **Start Postgres + MinIO** (compose) so import/versions/assets/deploy stop 500ing.

### P1 — Schema / contract correctness

4. **Add `order?: number` to backend `LayoutStyles`** (and any validators) to match FE + root schema.  
   - File: `backend/src/services/classifier/schema.ts` (+ root already has it).

5. **Document / type `ClassifiedPage` vs bare `WidgetTree`** at storage boundary so FE never treats `treeKey` JSON as a raw tree by mistake.

### P2 — Persistence & assets

6. **FE version hydrate:** `GET /projects/:id/versions` + load latest tree on editor mount (not only localStorage).  
7. **FE asset upload:** `api.uploadAsset` → set `ImageWidgetProps.src` to returned URL; drop data-URL-only path for production.  
8. **Remove or flag deploy mock** so a failed B10 call does not show a fake live URL without `usedMock` being obvious in UI.

### P3 — Realtime & polish

9. **FE WebSocket client for B15** (same origin or `ws://localhost:3000`, bearer on upgrade).  
10. **Single codegen path** or fidelity tests: FE canvas codegen vs BE deploy/export codegen.  
11. **Stop silent AI mock fallback** when status is 401/403 (surface auth errors instead of demo patches).

---

## Summary

The two halves were built to complementary milestone names, but **they do not form a closed product loop**:

- Backend has import → classify → versions → assets → deploy → assistant → WS.  
- Frontend has a polished editor on **`sampleTree`**, with API clients that often **mock or localStorage-fallback** when the server fails.  
- The single largest product gap is **never loading the classified tree into the canvas** after import.  
- The single largest silent type drift is **`LayoutStyles.order` missing on the backend**.  
- Auth is **implemented on BE, unused on FE**, currently masked by `AUTH_MODE=off`.

**Recommended next implementation slice:** P0 items 1–3 only, then re-run steps 3–6 of this checklist against a live import.
