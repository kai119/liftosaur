# Hardcoded `liftosaur.com` references left in place

Audit for issue #1 (self-host configuration module). Every match below is either
copy/SEO content specific to the upstream product, or functionality explicitly owned
by a later self-hosting issue. Routing these through config would be premature or
actively wrong before that issue's work lands.

Re-run `grep -rn "liftosaur\.com" src/ lambda/ webpack*.js` after any change and
diff against this list — a new, uncatalogued match means either a genuine gap or an
entry that needs to be added here with a reason.

## Marketing / SEO / legal copy (upstream product content, not routing)

- `src/sitemap.ts` and its build output `src/sitemap.xml` (copied verbatim to
  `dist/sitemap.xml` by `webpack.config.js`'s `CopyPlugin` entry) — sitemap entries
  are inherently about the public liftosaur.com site.
- `src/pages/**/*Html.tsx` — `canonical`, `ogUrl`, `ogImage`, and JSON-LD `url`/`@id`
  fields on every page component. These are SEO metadata for search engines and social
  previews; a self-hosted instance is LAN/Tailscale-only and never indexed, so stale
  values here are inert, not a bug.
- `src/index.html:8` (`<link rel="canonical">`) and `:33` (`og:image`) — same SEO
  metadata category as the `*Html.tsx` pages, just in the static app-shell template
  instead of a server-rendered component.
- `src/components/page.tsx:101` — JSON-LD `Organization` schema `url` field, same
  category as above.
- `src/privacy.html`, `src/terms.html`, `src/support.html`, `src/record.html`,
  `src/docs/content/docs.md` — static legal/support page content.
- `mailto:info@liftosaur.com` links and mentions (`src/components/footerPage.tsx`,
  `src/components/screenAccount.tsx:382` — an error-message string, not a link,
  `src/components/screenSettings.tsx`, `src/navigation/modals/NavModalHelp.tsx`,
  `src/navigation/modals/NavModalCorruptedState.tsx`,
  `src/pages/affiliates/affiliatesContent.tsx`) — upstream's real support address;
  self-hosters have no equivalent and these are just contact-info copy.
- `href="https://www.liftosaur.com/doc"` and similar doc-link `<a>`/`<Link>` targets,
  including the sibling `/privacy.html`, `/terms.html`, and `/licenses.html` links in
  the same settings screen (`src/components/screenSettings.tsx`,
  `src/components/help/helpEditProgramV2.tsx`,
  `src/components/tour/programTourConfig.tsx`, `src/pages/planner/plannerContent.tsx`) —
  intentionally link to upstream's hosted documentation/legal pages, which this fork
  doesn't mirror.
- `src/pages/affiliates/affiliatesContent.tsx:25` (`https://www.liftosaur.com/program`
  link and its display text) — affiliate marketing copy, same category as the rest of
  that page.
- `src/components/importerLiftosaurCsv.tsx:45`,
  `src/components/modalImportFromLink.tsx:18` — a download link and a placeholder
  string referencing the upstream site, not runtime routing.
- `lambda/utils/programImageGenerator.ts:311` — the literal string `"liftosaur.com"`
  rendered as watermark text on generated program-preview share images. Cosmetic
  branding, not a routing hardcode; changing it is a product decision out of scope here.
- `webpack.config.js` and `webpack.lambda.config.js` `__HOST__`/`__API_HOST__`/
  `__STREAMING_API_HOST__` `DefinePlugin` entries — already route through
  `config.host`/`config.apiHost`/`config.streamingApiHost` for every real build; the
  `https://stage.liftosaur.com` / `https://api3-dev.liftosaur.com` /
  `https://streaming-api-dev.liftosaur.com` literals are upstream's staging-deploy
  fallback, gated on `process.env.STAGE`, which a self-hosted build never sets. Dead
  code path here, not a self-hosting gap.
- `webpack.config.js`'s dev-server-only `localdomain`/`localapidomain` HTTPS cert
  paths (`:413-414`), the `localapi` proxy target (`:37`), and the
  `/externalimages/*` dev-server proxy to `https://www.liftosaur.com/` (`:529`) —
  local dev tooling for running against real upstream data/certs while developing;
  same territory as `devserver.ts`'s cert logic (issue #6) and out of scope for a
  literal-substitution pass.

## Owned by a later self-hosting issue

- `src/App.native.tsx:74` (`rewriteRollbarFrames`'s bundle URL) and
  `src/consent/consentEntry.ts:49`, `src/consent/trackers.ts:59,116` — Rollbar/telemetry
  code, deleted wholesale by issue #10 (telemetry no-ops). Not worth routing through
  config for code that's about to be removed.
- `src/App.native.tsx:431` (`isLiftosaurHost` deep-link filter) — explicitly called out
  in `docs/self-hosting/design.md`'s Android section as owned by issue #13/#14
  (configurable server address / sideloadable release APK).
- `src/utils/signIn.native.ts:22` (`APPLE_REDIRECT_URI`) — the whole file is dead once
  issue #11 removes Apple/Google sign-in.
- `src/models/exerciseImage.ts:757` (`imageUrl?.includes("liftosaur.com")`) — decides
  whether an image URL is external; owned by issue #12 (mirror exercise/user images
  locally), which changes what "external" means for this fork.
- `lambda/utils/email.ts:1` (`noReplyEmail`), `lambda/index.ts:1307,1327,1441`
  (`source: "info@liftosaur.com"` SES "from" addresses) — SES is bypassed entirely by
  issue #5 (neutralise SES/CloudWatch/self-invoke); these values are inert once that
  lands and not worth touching twice.

## Dev-mode templates (intentional, not a gap)

- `src/App.native.tsx:31,32,34` — the `` `https://${localdomain}.liftosaur.com:${localport}` ``-style
  templates for `nativeHost`/`nativeApiHost`/`nativeStreamingApiHost`, used only when `__DEV__` is
  true. These mirror the same per-worktree `localdomain.js` dev pattern used throughout the rest of
  the codebase (see `webpack.config.js`'s own dev-server cert/proxy logic above); not a self-hosting
  gap.

## Non-routing identifiers (leave as-is)

- `lambda/index.ts:906` — `${debugId}@debug.liftosaur.com`, a synthetic placeholder
  email for admin-debug user records. Not a real address or a routing target.
- `src/ducks/thunks.ts:2091` — `${userId}@test.liftosaur.com`, a synthetic email used
  in a test/import code path. Same category.
- `src/pages/exercise/exerciseContent.tsx:44` — `UrlUtils_build(path, "https://www.liftosaur.com")`
  inside `buildExerciseUrl`. Unlike the `UrlUtils_build` fallbacks fixed in
  `app.tsx`/`program.ts`, this base is never surfaced: the function immediately
  discards it and returns only `url.pathname + url.search` (a relative in-app link).
  The literal exists purely as a dummy base so `URL`/`UrlUtils_build` can parse a
  relative path; any placeholder string would do. Not a routing hardcode.
