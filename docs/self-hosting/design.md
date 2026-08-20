# Self-hosting Liftosaur

This fork adapts Liftosaur to run entirely on a single home server, with no runtime
dependency on AWS, liftosaur.com, or any other third-party service, and with every
feature that upstream sells as premium available for free.

The Android app is built and sideloaded as an APK that talks to the same home server.

## Constraints

1. No runtime network call leaves the home server. One exception is allowed at
   install time only: mirroring the public exercise-image bucket (see "Assets").
2. All upstream features are preserved unless a feature is *definitionally* an
   external service. Those are removed rather than left half-working.
3. Every premium-gated feature is free.
4. The fork stays mergeable with upstream. Upstream ships frequently, so we
   prefer adapters selected by configuration over rewrites of shared code.

## Approach: config-and-adapter, with targeted deletion

Every AWS dependency already sits behind an interface, and they are all assembled
in one place — `lambda/utils/di.ts`:

```ts
export interface IDI {
  dynamo: IDynamoUtil;
  s3: IS3Util;
  ses: ISesUtil;
  secrets: ISecretsUtil;
  lambda: ILambdaUtil;
  cloudwatch: ICloudwatchUtil;
  log: ILogUtil;
  fetch: Window["fetch"];
}
```

This is the seam the whole port hangs on. Providing local implementations of these
interfaces leaves all 24 DAOs and the 156KB router in `lambda/index.ts` untouched.

We use outright deletion only where code is genuinely dead in this deployment:
in-app purchases, payment webhooks, AI, and third-party telemetry. A disabled
paywall that still carries its plumbing is worse than no paywall.

## Topology

Upstream serves two origins: `www.liftosaur.com` (CloudFront — static assets from
S3, everything else forwarded to Lambda) and `api3.liftosaur.com` (API only).

We collapse both onto a single origin. The client already reads `__HOST__` and
`__API_HOST__` as separate constants, so pointing them at the same value makes the
CORS allowlist and the hardcoded `.liftosaur.com` cookie domain irrelevant rather
than requiring either to be fixed.

```
Phone / browser (LAN or Tailscale)
        |  https://lift.bambermumford.co.uk    <- Porkbun DNS-01 wildcard cert
        v
     Caddy  --- /app/*, /images/*, /fonts/*, /externalimages/*,
        |        /userimages/*, *.js|css|map|html   -> file_server (dist/)
        |
        \------- everything else                    -> reverse_proxy 127.0.0.1:3000
                                                            |
                                                     Node server
                                                (hardened devserver.ts)
                                                            |
                            +-------------------------------+-------------------+
                            v                               v                   v
                   DynamoDB-compatible store         Object storage        Local secrets
                   (ScyllaDB Alternator or           (MinIO or             (.env / JSON,
                    DynamoDB Local)                   filesystem)           generated on
                                                                            first run)
```

Caddy's path matchers replicate the CloudFront behaviour map close to one-for-one.
DNS is served by the existing Pi-hole so the name resolves to the LAN address, with
the Tailscale hostname as the off-network fallback. Nothing is published through the
Cloudflare Tunnel, so the instance is not reachable from the public internet.

## Component decisions

### Datastore

The 23 tables are queried through DynamoDB expression syntax — `KeyConditionExpression`,
`FilterExpression`, and several GSIs — spread across 24 DAOs. Reimplementing
`IDynamoUtil` over SQL would mean writing a DynamoDB expression parser, and any bug in
it surfaces as silently wrong query results rather than a crash.

We therefore run a DynamoDB-compatible server locally and keep `DynamoUtil` on the AWS
SDK client, pointed at a local endpoint with dummy credentials. ScyllaDB Alternator is
the preferred option (genuinely open source, production-grade); DynamoDB Local is the
fallback. Table and index definitions are ported out of `liftosaur-cdk/liftosaur-cdk.ts`
into an idempotent provisioning script.

### Object storage

Five buckets are used at runtime: caches, debugs, exceptions, storages, stats, plus the
read-only images buckets. `IS3Util` requires presigned upload and download URLs, which
`/api/imageuploadurl` depends on. A naive filesystem adapter cannot produce those without
inventing a signing scheme, so MinIO is the default choice; the filesystem adapter remains
an option if the presigned-URL paths are reworked.

### Secrets

`SecretsUtil` fetches a single JSON blob from AWS Secrets Manager. Locally it reads the
same shape from a file or environment, and the values that matter — cookie secret, crypto
key, API key, OTA signing key — are generated on first run. Apple and Google credentials
have no local equivalent and are removed along with their features.

### Email

`SesUtil` backs signup verification and password reset. For a single-user instance both
flows are replaced rather than reimplemented: accounts are auto-verified on signup, and
password reset is an admin script run on the server. No mail is sent, and no MTA is needed.

### Logging and self-invocation

`CloudwatchUtil` (admin log viewing) writes to and reads from local files.
`LambdaUtil.invoke` becomes a direct in-process call, since there is only one process.

## The paywall

There are exactly two chokepoints, and the server already contains the mechanism we need.
`lambda/index.ts` mints a `FreeUserDao` key with a ten-year expiry, annotated
"Claimed free key = active subscription". So:

- Server: auto-issue that key at account creation, and backfill it for existing accounts.
- Client: `Subscriptions_hasSubscription()` returns true unconditionally.

Features this frees: graphs on the exercise, workout and stats screens; muscle maps in
program preview; sleep and nutrition tracking; week insights; plate-calculator detail; and
API keys, which is what gates the built-in MCP server.

The six `<Locker>` call sites, the subscription screen, `react-native-iap`, the Play
Billing permission, and the Apple/Google payment webhooks and dashboards are then deleted.

## Removed features

These are removed because they are definitionally external, not because they were hard:

- **AI program generation** (`/stream/ai/liftoscript`) — converts plain English or a
  fetched URL into a Liftoscript program via Anthropic. Removing it also removes the
  entire streaming API server and `UrlContentFetcher`.
- **AI muscle inference for custom exercises** (`/api/muscles`) — built-in exercises carry
  hand-authored muscle data, so the muscle map, exercise substitution, and week insights
  are unaffected. Only custom exercises lose auto-population; their muscles are set manually.
- **Telemetry** — Rollbar, PostHog/Google Analytics, AppsFlyer, webpushr, Google Sheets,
  and the consent banner that exists to serve them.
- **Third-party identity** — Apple and Google sign-in. Email and password remain.

The `/ai/prompt` page never calls an LLM (it only assembles text for you to paste
elsewhere) and may be kept at low cost.

The `lambda/mcp/` MCP server is **kept**. It exposes your own data to an AI assistant you
point at it and never makes an outbound call itself.

## Assets

Exercise images (~735 files) are not in the repository; they are served from the public
`liftosaurimages2` S3 bucket via the `/externalimages/*` path. A bootstrap script mirrors
the bucket once into local object storage. After that the server never contacts AWS.

## Android

The app is bare React Native, so it bundles its own JavaScript and contacts the server only
for sync, identity, and OTA updates. The server address is three constants in
`src/App.native.tsx`, chosen by `__DEV__`, so release builds hardcode `www.liftosaur.com`.

This is fixed in two layers: a build-time default injected from the shared configuration
module, and an in-app "Server URL" setting so the app can be re-pointed without a rebuild.

The release build additionally needs the Play Billing and AppsFlyer dependencies removed, the
`liftosaur.com` deep-link filter repointed, a signing keystore, and an `assembleRelease`
target — the repository only provides `bundleRelease`, which produces a Play Store AAB that
cannot be sideloaded.

OTA updates are a separate decision. `lambda/updates/` already implements the Expo manifest
protocol, so a self-hosted channel is achievable with a locally generated signing key. If
the app is not going to be iterated on, disabling OTA and treating the APK as the only
update path is less machinery.

## Out of scope

The iOS and watchOS applications are left in place and untouched. Host changes shared with
Android apply to them, but they are not built, tested, or verified here. Reviving them would
need a Mac and an Apple Developer account for sideloading.

## Deployment

The instance is deployed as an independent Docker Compose project in the `home_server`
repository, following the convention used by the other services there: its own directory,
its own `.env.example`, a Caddy site block, a Pi-hole DNS entry, and a row in the service
table.

Note that `lambda/scripts` is a git submodule pointing at a private upstream repository
(`astashov/liftosaur-scripts`). It is not available through the fork and nothing in the
runtime path depends on it.
