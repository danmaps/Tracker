# Deploy Plan for `tracker.dannymcvey.com`

## Current state
The upstream repo is not yet a deploy-ready app.

Current contents are essentially:
- `diabetic-tracker.jsx`
- `README.md`

The code appears to be a prototype built for a Claude artifact-like environment.

### Main blocker
The component uses `window.storage`, which is not a normal web deployment primitive.

That means the repo cannot be dropped directly onto a domain and expected to work.

## Goal
Create a hosted prototype at:
- `tracker.dannymcvey.com`

Without losing the ability to:
- track upstream work by Adrian
- selectively sync useful changes later

## Working branch
All deploy adaptation work should happen on:
- `dan/deploy-prototype`

Not on `main`.

## Phase 1 — make it a real app
Turn the prototype into a standard React app.

### Tasks
- create a Vite + React scaffold
- move `diabetic-tracker.jsx` into app structure
- add package metadata and scripts
- confirm the app renders locally

### Likely files to add
- `package.json`
- `vite.config.*`
- `index.html`
- `src/main.*`
- `src/App.*`
- optional `public/` assets

## Phase 2 — replace artifact-only storage
Replace `window.storage` usage with something deployable.

### First useful choice
Use `localStorage` everywhere for now.

Why:
- fastest path to a hosted prototype
- no backend needed initially
- enough for single-user testing/demo use

### Tradeoff
This will not provide:
- multi-device sync
- user accounts
- shared server-side persistence

That is acceptable for prototype phase.

## Phase 3 — confirm build/runtime
Need to verify:
- app boots locally
- map tab works
- chart rendering works
- storage changes persist in browser
- no Claude-runtime assumptions remain

## Phase 4 — deploy shape
Two likely options.

### Option A — static build served by Caddy
Use Vite build output and serve static assets.

Pros:
- simple
- low moving parts
- good fit if app is browser-only

### Option B — app server behind Caddy
Run the app on a local port and reverse proxy it.

Suggested host port:
- `localhost:3010`

Caddy block would look like:
```caddy
tracker.dannymcvey.com {
    reverse_proxy localhost:3010
}
```

## Recommended initial deploy path
Prefer **Option A** if the app is fully static after conversion.

Prefer **Option B** only if the final scaffold or chosen runtime makes that simpler.

## Phase 5 — domain wiring
Needed:
- DNS record for `tracker.dannymcvey.com`
- add Caddy host entry
- reload/restart Caddy
- verify HTTPS and route behavior

## Phase 6 — later improvements
After the prototype is live, possible next steps:
- import/export
- backend persistence
- user accounts
- physician/share view
- mobile polish
- PWA/offline support

## Working principle
Do the smallest transformation that gets the prototype live.

Do not overbuild backend/auth/sync infrastructure before the app can run as a normal web application.

## Immediate next implementation step
On `dan/deploy-prototype`:
1. scaffold a Vite React app
2. move prototype into that structure
3. replace `window.storage` with `localStorage`
4. get local dev server working
