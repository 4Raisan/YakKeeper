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
