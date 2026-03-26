# Branching Strategy for Danny's Tracker Adaptation

## Purpose
This repo is upstream work by Adrian.

Danny wants to:
- keep syncing upstream changes when useful
- build a deployable version for `tracker.dannymcvey.com`
- avoid rewriting upstream history or muddying Adrian's mainline prototype flow

## Current local branch model

### `main`
Treat `main` as the clean upstream-tracking branch.

Rules:
- do not do Danny-specific deploy adaptation work directly on `main`
- use `main` to pull/fetch upstream changes from Adrian's repo
- keep it as close to upstream as practical

### `danmaps/deploy`
This is Danny's working branch for turning the prototype into a real hosted app.

Use this branch for:
- scaffolding a real React/Vite app
- replacing Claude artifact storage APIs
- adding build/deploy files
- preparing Caddy/domain deployment for `tracker.dannymcvey.com`
- any Danny-specific product or hosting changes

## Why this model
The repo currently looks like a single-file prototype, not a deploy-ready app.

Branching lets us:
- preserve upstream intent
- make structural changes safely
- selectively merge future upstream ideas later

## Recommended remote model
Right now, the local repo may still point only at Adrian's GitHub repo.

Preferred long-term remote setup:
- `origin` = Danny's fork
- `upstream` = Adrian's repo

That gives a standard workflow:
- fetch upstream updates from Adrian
- push Danny's branch work to Danny's fork

## Suggested commands once Danny has a fork
```bash
git remote rename origin upstream
git remote add origin https://github.com/danmaps/Tracker.git
git fetch --all
```

## Daily workflow
### Work on Danny's deploy branch
```bash
git checkout danmaps/deploy
```

### See upstream changes
```bash
git checkout main
git pull --ff-only upstream main
```

### Bring upstream changes into Danny's branch
Option A: merge
```bash
git checkout danmaps/deploy
git merge main
```

Option B: cherry-pick specific commits
```bash
git checkout danmaps/deploy
git cherry-pick <commit>
```

## Merge philosophy
Do not blindly merge everything from upstream after the repo structure changes.

Once the deploy branch becomes a real app scaffold, upstream single-file changes may need:
- manual integration
- selective cherry-picking
- reimplementation instead of direct merge

That is expected.

## Decision rule
If Adrian changes:
- copy/content/labels/features inside the prototype UI → probably worth reviewing and porting
- prototype-only storage/runtime assumptions → may not apply directly
- repo structure in a way that helps deployment → probably worth merging

## Deployment target
Planned target:
- `tracker.dannymcvey.com`

Likely deploy shape:
- app served behind Caddy on a dedicated local port, or
- built static assets served directly by Caddy

## Status
Current branch setup:
- `main` = upstream tracking branch
- `danmaps/deploy` = Danny deploy/adaptation branch
