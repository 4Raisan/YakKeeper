# YakKeeper

<p align="center">
  <img src="docs/assets/yakkeeper-readme-logo.png" alt="YakKeeper" width="640">
</p>

Where projects meet their next contributors.

A simple place to share my projects, collect ideas, and connect with people who want to contribute. Selected colleagues can publish their work in a separate Community section.

## Features

- Personal and community project boards, search, and status filters.
- Source and demo links, project details, and next steps.
- Ideas and contribution requests without a visitor account.
- Email-link sign-in for publishers and a private request inbox.
- Email-bound, single-use invitations that expire after seven days.
- Project updates across tabs, on focus, and every 30 seconds while visible.
- Optional owner notifications through Meta WhatsApp Cloud API.

## Stack

Next.js, React, TypeScript, Supabase, and Vercel. Node.js 22 is required.

## Run locally

```sh
npm ci
cp .env.example .env.local
```

Set these values in `.env.local`:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key |
| `OWNER_EMAIL` | Email used by the project owner |

For a new database, apply `supabase/migrations/20261019055704_yakkeeper_initial_schema.sql` once. Skip this if that migration is already applied.

```sh
npm run dev
```

Open http://127.0.0.1:3000. Without database configuration, localhost shows a labeled preview. It does not save projects or send requests. Hosted environments show a connection-pending state instead.

## Deploy on Vercel

1. Import this repository, select Next.js, and use Node.js 22.
2. Add the four environment variables above in Vercel. Never expose the server secret with a `NEXT_PUBLIC_` prefix.
3. Enable email-link authentication with email confirmation in Supabase. Set the Site URL to the production origin and allow the exact `/?view=workspace` redirect for production and local testing. Configure SMTP for reliable email delivery.
4. Deploy and sign in with `OWNER_EMAIL`. The first verified matching account becomes the owner.
5. Add projects and invite colleagues from the workspace.

## Access

Public visitors can browse and submit ideas or contribution requests. Publishers can manage their own projects. The owner manages invitations and can access all project requests.

Application tables have RLS enabled and direct anonymous/authenticated access disabled. Server routes verify Supabase user tokens and check ownership before reads and writes. Invitation codes are hashed and consumed in a database transaction. Public submissions have input validation, origin checks, a honeypot, and a database-backed network rate limit.

## WhatsApp notifications

Set the optional `META_*` and `WHATSAPP_*` values from `.env.example`. Use a supported Meta Graph API version and an approved template with three text parameters: submission kind, project title, and inbox URL. The recipient must opt in.

Requests are saved before an alert is sent. Meta acceptance is not a delivery receipt. Delivery webhooks, automatic retries, and separate colleague alerts are not included.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same checks. Tests cover API routes with a mock Supabase transport, validation, ownership, inbox privacy, invitations, origin checks, and stale-response protection.

Live database transactions have also checked project updates, invitation activation/expiry/reuse, inbox persistence, and database permissions, with test data rolled back. Full app-to-database login and submission flows, email delivery, Vercel deployment, and WhatsApp delivery still require configured credentials and end-to-end verification.

Project syncing means refreshing data stored in Supabase. GitHub repository import is not included; the Source field links to a repository.
