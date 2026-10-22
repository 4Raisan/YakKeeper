# Setup and deployment

1. Set `YAKKEEPER_LOCAL_DEMO=false`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SECRET_KEY`. Keep server secrets out of chat and client code.
3. For a new database, apply all files in [`supabase/migrations`](../supabase/migrations) in order. The existing YakKeeper database already has these upgrades; do not reapply them there.
4. Create a GitHub OAuth App using the callback shown by Supabase's GitHub settings, normally `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Enable GitHub under **Supabase Authentication → Providers** and enter its client ID/secret there. These credentials belong in Supabase, not browser code.
6. Configure the Supabase Site URL and allow `http://127.0.0.1:3000/` and `http://127.0.0.1:3000/?view=my` for local redirects. Add exact production URLs when deploying.
7. Use Supabase's default GitHub profile/email permissions. Do not add `repo`, `public_repo`, organization or repository write scopes.
8. Optional `OWNER_EMAIL` identifies the administrator's verified sign-in email. Other GitHub-connected accounts become regular publishers. Administrator roles are stored server-side.
9. Restart/rebuild after environment changes. Test real sign-in and publishing with two actual accounts before public launch.

GitHub connected means control of that account, not verified real-world identity or competence. Public personally owned repositories are supported; private and organization repositories are excluded. Import is on demand, not continuous synchronization of GitHub issues, commits or permissions. Public GitHub API rate limits apply; failures show retry controls.

## Hosting

Recommended: **Vercel + Supabase**. Keep the existing Next.js application and managed Postgres; the card grid is a presentation change and needs no new backend service. Vercel serves static assets through its CDN and runs `/api/hub` as a Node.js function. Durable records and rate-limit counters live in Supabase, not the deployment filesystem. The GitHub metadata cache is per process and may reset or be duplicated across function instances.

### Hosting on Vercel

1. Finish the GitHub OAuth setup above. Keep the GitHub client secret in Supabase provider settings. The callback is `https://<project-ref>.supabase.co/auth/v1/callback`, not the website URL.
2. Import the YakKeeper repository in Vercel, using the directory that contains `package.json`.
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

The hosted application has been checked with GitHub sign-in and public repository discovery. Local tests cover multiple personas; repeat the two-real-account workflow above for your deployment. WhatsApp delivery is not configured.


## Storage and limits

Banners accept PNG, JPEG and WebP up to 8 MB. The browser crops them to 3:1 and encodes WebP at 1200 × 400, capped at 128 KiB. Production uses a private Supabase Storage bucket; no Vercel Blob is used. Owners can replace/remove banners; signed URLs last one hour. Storage cleanup failures are logged.

Public listings load 24 at a time, up to 240. Management and application lists return the latest 100 records. GitHub public metadata is cached per process for five minutes; API rate limits apply. Repository data refreshes on save rather than continuously synchronizing GitHub activity.

Deleting a listing also removes its applications, ideas and reports. The GitHub repository is untouched. Moderator-restricted repository IDs remain blocked after deletion. See [security](../SECURITY.md) and [optional WhatsApp setup](whatsapp.md).
