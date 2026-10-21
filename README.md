# YakKeeper

<p align="center"><img src="docs/assets/yakkeeper-readme-logo.png" alt="YakKeeper" width="640"></p>

**Where projects meet their next contributors.**

A shared project board for finding teammates, practising skills and contributing to public GitHub projects. Every GitHub-connected user can publish their own public repositories. No invitation is required.

## Use it

- **Explore:** search projects, stacks and people; filter for beginner-friendly or open projects.
- **My projects:** choose a public GitHub repository, add details, publish, edit or archive it.
- **Applications:** owners review received proposals; applicants track sent requests.
- **Profile:** skills, interests, availability and timezone.
- **Reports:** administrator review. Users can report listings and block new applications from an account.

Project status, listing visibility and accepting applications are separate settings. Accepting an application does not grant GitHub access; people agree next steps through GitHub themselves.

## Architecture

![YakKeeper architecture](docs/assets/architecture.svg)

Next.js / React / TypeScript on Node.js 22. Production uses Supabase Auth and Postgres through a server-only API. GitHub REST calls read public metadata only; no repository write scopes or provider access tokens are stored by application code. Ownership uses the GitHub numeric identity supplied by verified Supabase Auth, never an editable profile field.

Public metadata is cached for five minutes with a bounded cache. Ownership and visibility are rechecked when publishing/editing. Repository results are paginated; public project reads load 24 at a time, up to 240. Management and application lists currently return the latest 100 records. Tabs refresh on focus, after mutations, across tab notices and once per visible minute. No chat, uploads, WebSocket service or background worker is required.

## Local sandbox

Run `npm ci`, copy `.env.example` to `.env.local`, and set `YAKKEEPER_LOCAL_DEMO=true`. Then run `npm run dev` and open http://127.0.0.1:3000.

Choose **Try it** and a sandbox account. Add a repository, switch accounts, apply, switch back and review. Data persists in ignored `.local/yakkeeper.sqlite`, including across server restarts. The sample repository allows testing when GitHub is unavailable; other picker entries are actual public GitHub metadata.

Sandbox identity is **not GitHub verification**. Sessions use random HttpOnly, SameSite cookies. Sandbox mode requires explicit server configuration and a loopback host; it is disabled on detected Vercel, Render and Railway deployments. Never enable it on a publicly reachable server. Node 22 labels its built-in SQLite module experimental; SQLite is used for local testing only.

## Connect real GitHub sign-in

1. Set `YAKKEEPER_LOCAL_DEMO=false`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SECRET_KEY`. Keep server secrets out of chat and client code.
3. For a new database, apply all files in `supabase/migrations` in order. The existing YakKeeper database already has these upgrades; do not reapply them there.
4. Create a GitHub OAuth App using the callback shown by Supabase's GitHub settings, normally `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Enable GitHub under **Supabase Authentication → Providers** and enter its client ID/secret there. These credentials belong in Supabase, not browser code.
6. Configure the Supabase Site URL and allow `http://127.0.0.1:3000/` and `http://127.0.0.1:3000/?view=my` for local redirects. Add exact production URLs when deploying.
7. Use Supabase's default GitHub profile/email permissions. Do not add `repo`, `public_repo`, organization or repository write scopes.
8. Optional `OWNER_EMAIL` identifies the administrator's verified sign-in email. Other GitHub-connected accounts become regular publishers. Administrator roles are stored server-side.
9. Restart/rebuild after environment changes. Test real sign-in and publishing with two actual accounts before public launch.

GitHub connected means control of that account, not verified real-world identity or competence. Public personally owned repositories are supported; private and organization repositories are excluded. Import is on demand, not continuous synchronization of GitHub issues, commits or permissions. Public GitHub API rate limits apply; failures show retry controls.

## Deploy

Recommended: **Vercel + Supabase**. Keep the existing Next.js application and managed Postgres; the card grid is a presentation change and needs no new backend service. Vercel serves static assets through its CDN and runs `/api/hub` as a Node.js function. Durable records and rate-limit counters live in Supabase, not the deployment filesystem. The GitHub metadata cache is per process and may reset or be duplicated across function instances.

### Deploy on Vercel

1. Finish the GitHub OAuth setup above. Keep the GitHub client secret in Supabase provider settings. The callback is `https://<project-ref>.supabase.co/auth/v1/callback`, not the website URL.
2. Use the current local source. When you authorize publishing it to GitHub, import that updated repository in Vercel. Alternatively, a Vercel CLI deployment can upload local source without a GitHub push; that is still a public deployment and must be deliberately initiated. Do not import an old or empty repository and expect these local changes.
3. Select **Next.js**, the folder containing `package.json`, **Node.js 22.x**, install `npm ci`, build `npm run build`, and the default Next.js output directory. Do not configure a static export or Edge runtime.
4. Add production environment variables:

   | Variable | Value / purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | YakKeeper Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key |
   | `SUPABASE_SECRET_KEY` | Server-only secret; never prefix with `NEXT_PUBLIC_` |
   | `OWNER_EMAIL` | Administrator's verified sign-in email |
   | `APP_URL` | Final HTTPS website origin |
   | `YAKKEEPER_LOCAL_DEMO` | `false` |

5. Confirm migrations match the chosen database. Apply all migrations in order only to a fresh database; the existing YakKeeper database already received them. Do not copy `.local/yakkeeper.sqlite`, `.env.local`, `node_modules` or `.next` into source control.
6. Deploy, obtain the stable production URL, set `APP_URL` to it, and redeploy if it changed. In Supabase **Authentication → URL Configuration**, set **Site URL** to that HTTPS origin and allow the exact URLs `https://<your-host>/` and `https://<your-host>/?view=my`. Use a stable staging URL for testing rather than broad redirect wildcards. Public environment-variable changes require a rebuild.
7. With two real GitHub accounts: sign in, import a personally owned public repository, publish, apply from the other account, review/accept as the owner, and confirm status after refresh. Check that users cannot edit another person's listing or read another person's inbox. Confirm archived/private listings disappear from public discovery and that logout works.
8. Start without WhatsApp. After the core hosted flow passes, optionally configure the Meta fields below and test actual delivery. Monitor Vercel errors/usage, Supabase database/egress usage, and GitHub API failures. Choose a function region near the existing Supabase database when your plan allows it; for a new database serving India, prefer nearby available regions and measure latency.

Real OAuth and a hosted deployment have not yet been verified. The last local setup had sandbox mode enabled and still needed GitHub provider credentials plus the server secret; confirm those settings before launch. These instructions do not publish, commit or push anything.

### Platform choices and resource expectations

- **Vercel + Supabase — first choice:** lowest setup effort for this Next.js app. No dedicated server or manually sized RAM allocation is needed. Vercel Hobby is for personal, non-commercial use; use an eligible paid plan for commercial operation. [Next.js support](https://vercel.com/docs/frameworks/full-stack/nextjs), [Hobby terms](https://vercel.com/docs/plans/hobby).
- **Render + Supabase — Node server alternative:** run `npm ci && npm run build`, then `node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port $PORT`. The existing `npm start` binds loopback for local use, so use the explicit hosted command. Free Render services sleep after 15 minutes without traffic; use a paid instance for an always-on service. [Render limits](https://render.com/docs/free).
- **A VPS + Supabase — more control:** possible with Node 22, HTTPS reverse proxy and a process manager, but adds updates, monitoring and recovery work. A provisional starting budget is 1 vCPU / 1 GB RAM for a small Node runtime; build separately or allow more RAM for builds. This is an estimate, not a measured capacity result.

For an initial non-commercial trial, Vercel Hobby and Supabase Free can have a $0 base hosting cost within their limits. Supabase Free currently includes 500 MB database storage and 5 GB egress and may pause after a week of low activity. Supabase Pro starts at $25/month; Vercel Pro currently lists $20/month, before extra usage, tax, domains or optional messaging. Existing Supabase organization projects can affect the bill. [Supabase pricing](https://supabase.com/pricing), [Vercel pricing](https://vercel.com/pricing).

This app stores text records and links to repositories/demos, so it does not need video storage, a separate chat server, a queue worker or a GPU. Actual capacity depends on active browsing time, request volume and database queries; account count alone is not a capacity measurement. Each continuously visible tab refreshes roughly 60 times per hour, plus focus and action refreshes. Before a large public launch, load-test the API, review query plans and pagination beyond the current limits, and add delivery retries only if reliable alerts become a requirement.

Application tables have RLS enabled, client privileges revoked and server-only access. API routes check identity and ownership. Contribution applications are unique per account/project. Submissions and reports are rate limited. Moderators can archive reported listings; owners cannot bypass that archive by republishing.

## Optional WhatsApp

Meta alerts are supported for applications to the administrator's own projects, not automatic alerts to every publisher. Configure the optional `META_*` / `WHATSAPP_*` fields, an approved three-parameter template (kind, project title, inbox URL), and `APP_URL`. Requests are saved before alert delivery is attempted. Delivery webhooks and automatic retries are not implemented.

## Validation and limits

Run `npm run typecheck`, `npm test`, `npm run build`, then `npm start`.

Tests exercise actual API handlers and persistent local SQLite data, two-account ownership and privacy, review status, reporting, blocking, validation, origin checks and stale-response protection. GitHub security/API tests use mocked transport. Live Supabase transactions check application/report/block storage and anonymous privilege denial; fixtures are rolled back.

Real OAuth sign-in still needs provider credentials and the server secret. Real WhatsApp delivery, public traffic performance and hosted deployment remain unverified. Local sandbox data is isolated from Supabase live records.
