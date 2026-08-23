# Self-host configuration module (issue #1)

Fork issue: `kai119/liftosaur#1`. Blocks every other self-hosting issue (see
`docs/self-hosting/design.md` and the milestone table in `CLAUDE.md`).

## Problem

Host, port, and (eventually) storage-endpoint and feature-flag values are scattered
across build config, runtime source, and infra code, and most are hardcoded to
`liftosaur.com`. Per `docs/self-hosting/design.md`, web and API collapse onto a single
origin for the self-hosted topology, which needs to be re-pointable with one change.

## Module shape

Two files, mirroring the existing `localdomain.js` / `src/localdomain.ts` split so both
CJS build tooling (webpack, Metro) and TS runtime code (`src/`, `lambda/`) can consume the
same values without a build step:

- **`config.js`** (repo root, plain CJS) — single source of truth. Branches on
  `NODE_ENV`/`IS_DEV`:
  - **Dev**: delegates to `require("./localdomain")` for `host` / `apiHost` /
    `streamingApiHost` / ports, unchanged. The per-worktree mechanism
    (`scripts/worktree-create.sh` generating `localdomain.js`) is wrapped, not replaced —
    worktree tooling keeps working exactly as today.
  - **Prod (self-hosted)**: reads env vars. `HOST` (e.g.
    `https://lift.bambermumford.co.uk`) becomes `host`, `apiHost`, and
    `streamingApiHost` alike — Caddy fronts everything on one origin, so there is no
    per-service subdomain or port in the URL. Node listens on a fixed internal port,
    `SERVER_PORT` (default `3000`), which Caddy reverse-proxies to.
  - Also carries `storage.dynamoEndpoint` / `storage.s3Endpoint` (env vars
    `DYNAMO_ENDPOINT`, `S3_ENDPOINT`, defaulted to local emulator addresses) — unread until
    issues #2/#3 wire up the DI adapters, but the shape exists now so those issues just
    import it. And `flags: {}` — empty, extensible; later issues (#7 premium unlock, #15
    OTA channel) add keys here instead of inventing new plumbing.
- **`src/config.ts`** — thin typed wrapper, the only import point for `src/` and
  `lambda/` runtime code (same pattern as `src/localdomain.ts` wrapping `localdomain.js`
  today).

## Consumers to route through it

| File | Change |
|---|---|
| `webpack.config.js` | Replace hardcoded `https://www.liftosaur.com` / `api3.liftosaur.com` / `streaming-api.liftosaur.com` fallbacks (non-STAGE branch) with `config.host` / `config.apiHost` / `config.streamingApiHost`. STAGE branch literals are left as-is — dead code for this fork, not worth touching. |
| `webpack.lambda.config.js` | Same substitution, non-STAGE branch. |
| `src/App.native.tsx` | Same substitution for the `useLocal ? ... : "https://www.liftosaur.com"` fallbacks; build-time default for the Android release build injected from config. |
| `src/utils/hostConfig.ts` | `baseHost()`'s `"https://www.liftosaur.com"` fallback becomes `config.host`. |
| `lambda/utils/response.ts` | `allowedHosts` gains the configured host:port. Cookie `domain: ".liftosaur.com"` is dropped entirely (no `domain` attribute) rather than parameterized — a single origin makes a domain-scoped cookie unnecessary. |
| `lambda/dao/buckets.ts` | `getUserImagesPrefix()`'s two hardcoded URLs collapse to one built from `config.host`. |
| `lambda/dao/programDao.ts:46` | `process.env.HOST \|\| "https://www.liftosaur.com"` → `process.env.HOST \|\| config.host`. Found during exploration, not in the issue's original list, same pattern. |
| `lambda/utils/programImageGenerator.ts:134` | Same substitution as above. |
| `devserver.ts:248` | Sets `process.env.HOST = config.host` directly instead of reconstructing the URL from `localdomain` fields inline. |

## `.env.example`

New file at repo root documenting `HOST`, `SERVER_PORT`, `DYNAMO_ENDPOINT`,
`S3_ENDPOINT`, with a comment that dev mode ignores these entirely and uses
`localdomain.js` instead. No `dotenv` dependency — matches the repo's existing
convention of env vars passed inline (`start:server` already does
`IS_DEV=true IS_LOCAL=true ... ts-node-dev`) and Docker Compose's native `.env` file
support for the eventual `home_server` deployment.

## Sweep

Beyond the issue's explicit list, grep for `liftosaur.com` across `src/`, `lambda/`,
`webpack*.js` turned up ~60 matches. Two are functional hardcodes not in the issue's
list (`programDao.ts`, `programImageGenerator.ts`, both handled above). The rest are
marketing/doc copy legitimately specific to the upstream product — `privacy.html`,
`terms.html`, `support.html`, `sitemap.ts`, blog/docs content, page `<title>`/meta tags,
etc. These are left alone with a short comment marking them as deliberate, per the
issue's acceptance criterion that a `liftosaur.com` grep return only documented matches.

## Testing

- Unit tests for `config.js`'s branching logic: dev mode falls through to
  `localdomain.js` values; prod mode reads env vars with correct defaults when unset.
- Existing tests that set `__HOST__` directly keep working unmodified — the DefinePlugin
  mechanism itself is unchanged, only what feeds it changes.

## Acceptance criteria (from the issue)

- A single configuration change (the `HOST` env var, or `localdomain.js` in dev)
  re-points the entire stack at a new hostname.
- `grep -rn "liftosaur\.com" src/ lambda/ webpack*.js` returns only deliberate,
  documented matches.
- Existing test suite still passes.
