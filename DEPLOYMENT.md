# CI/CD

Two workflows:

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | PRs and pushes to `main` / `dev` | Client lint + typecheck + build, server lint + unit tests, and a build of both production Docker images |
| `.github/workflows/cd.yml` | Pushes to `main`, or manual dispatch | Builds and pushes images to GHCR, then deploys to the VPS over SSH and health-checks the result |

CI replaces the old `node-ci.yml`, which could not pass: it ran `npm ci` against a
client lockfile that was out of sync with `package.json`.

## The one gotcha: `VITE_*` values are baked in at build time

Vite inlines `import.meta.env.VITE_*` into the JavaScript bundle when the bundle is
compiled. They are **not** read at runtime, so setting them as container environment
variables does nothing — by then the values are already compiled in.

This is why `VITE_API_URL` and `VITE_STRIPE_PUBLISHABLE_KEY` are GitHub secrets
consumed as Docker **build args** in `cd.yml`, not entries in the deploy `.env`.

Two consequences:

- Any `VITE_*` value must make sense to **a browser**, not to the server container.
- Changing one requires a rebuild, not just a restart. Re-run the CD workflow.

`VITE_API_URL` is the reason to leave it unset: `client/src/lib/api.ts` falls back to
the relative `/api`, and nginx proxies that to the server container. A relative path
is correct on every host and domain, so moving the deployment never needs a rebuild.
Set the secret only if you split the API onto its own hostname.

`VITE_STRIPE_PUBLISHABLE_KEY` has no such escape — it must be set as a build arg.

## Required GitHub secrets

Set under **Settings → Secrets and variables → Actions**.

### VPS access

| Secret | Required | Notes |
|---|---|---|
| `SSH_HOST` | yes | Host or IP of the VPS |
| `SSH_USER` | yes | User to deploy as; must be in the `docker` group |
| `SSH_PRIVATE_KEY` | yes | Full private key, no passphrase. Its public half goes in the VPS's `~/.ssh/authorized_keys` |
| `SSH_PORT` | no | Defaults to `22` |
| `SSH_KNOWN_HOSTS` | no | Output of `ssh-keyscan <host>`. Recommended — without it the deploy trusts the host key on first use, which is open to a spoofed host |
| `DEPLOY_PATH` | no | Defaults to `~/ecom-autoparts` |

### Client build args

| Secret | Required | Notes |
|---|---|---|
| `VITE_API_URL` | no | Leave unset. `client/src/lib/api.ts` defaults to the relative `/api`, which nginx proxies to the server container. Only set this if the API lives on a different host than the client |
| `VITE_STRIPE_PUBLISHABLE_KEY` | for checkout | Publishable (`pk_...`) key — safe to ship to the browser |

### Server runtime

| Secret | Required | Notes |
|---|---|---|
| `MONGO_USER` | yes | |
| `MONGO_PASSWORD` | yes | |
| `MONGO_DB` | no | Defaults to `ecom-autoparts` |
| `JWT_SECRET` | **yes** | No default in code. Every token check depends on it |
| `SESSION_SECRET` | **yes** | `config/config.js` falls back to the literal `'secret'` — never rely on that in production |
| `STRIPE_SECRET_KEY` | **yes** | `config/stripe.js` throws at require time when unset, so the container will not boot without it |
| `STRIPE_WEBHOOK_SECRET` | for webhooks | Payment webhook verification |
| `CLIENT_URL` | yes | Used for Stripe redirects and CORS |
| `FRONTEND_URL` | no | Defaults to `CLIENT_URL`. Used in emailed links |
| `SERVER_PUBLIC_URL` | no | Used by the shipping service |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | for email | OTP login and order emails silently stop working without these |
| `ADMIN_EMAIL`, `SUPER_ADMIN_EMAIL` | no | Notification recipients |
| `SUPER_ADMIN_PASSWORD` | for seeding | Only read by `npm run seed`, which creates the first super admin |
| `GEMINI_API_KEY` | for AI analytics | Without it the SuperAdmin AI assistant returns 502 |
| `GEMINI_MODEL` | no | Overrides the first entry in the model fallback chain |
| `HTTP_PORT` | no | Host port for the web client, default `80` |

There is no `API_PORT`. The server container is not published on the host — nginx
in the client container proxies `/api` to it over the compose network.

Anything marked required is enforced by `docker-compose.deploy.yml`, which fails
immediately with a named error rather than starting a container that crash-loops.

## VPS prerequisites

```bash
# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out and back in

# curl is used by the deploy health check
sudo apt-get install -y curl
```

Nothing else needs to be installed and the repo does not need to be cloned there —
the workflow copies `docker-compose.deploy.yml` and a generated `.env` to
`DEPLOY_PATH` on every deploy.

## How a deploy runs

1. Images are built and pushed to `ghcr.io/<owner>/<repo>/server` and `/client`,
   tagged with both the commit SHA and `latest`.
2. `docker-compose.deploy.yml` and a generated `.env` are copied to the VPS.
3. The VPS logs in to GHCR with the run-scoped `GITHUB_TOKEN`, pulls, and restarts.
4. The workflow polls `/health` **inside** the server container for up to 150s, then
   curls `/api/message` through nginx on the host to prove the proxy hop works. If
   either fails the step fails and prints the last lines of the relevant logs.

`/health` returns `503` while MongoDB is disconnected, so a server that boots without
a working database fails the deploy instead of passing a check it cannot back up.

Deploys are serialised by a concurrency group, so two merges cannot race.

## Rollback

Images are tagged by commit SHA, so rolling back is a tag change on the VPS:

```bash
cd ~/ecom-autoparts
sed -i "s|/server:.*|/server:<known-good-sha>|; s|/client:.*|/client:<known-good-sha>|" .env
docker compose pull && docker compose up -d
```

Or re-run the CD workflow from a known-good commit via **Actions → CD → Run workflow**.

## Notes

- **Typecheck is deliberately non-blocking.** The client has ~36 pre-existing
  TypeScript errors. CI reports them without blocking every PR. Once they reach
  zero, drop `continue-on-error` from the typecheck step in `ci.yml` to make it a
  hard gate.
- **MongoDB is not published to the host** in `docker-compose.deploy.yml`. Only the
  server container reaches it. Do not add a `ports:` entry for it on a public VPS.
- **`docker-compose.prod.yml` is not used for deployment.** Despite the name it
  bind-mounts the source tree over the image and publishes MongoDB on `27017`.
  `docker-compose.deploy.yml` is the production one.
- The dev images (`client/Dockerfile`, `server/Dockerfile`) are untouched and still
  back `docker-compose.dev.yml`. Production uses the `.prod` variants.
