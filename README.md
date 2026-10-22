# YakKeeper

<p align="center"><img src="docs/assets/yakkeeper-readme-banner.svg" alt="YakKeeper — Where projects meet their next contributors." width="640"></p>

**Find teammates and contribute to public GitHub projects.** YakKeeper helps project owners meet people who want to learn, share ideas and build together.

[Open YakKeeper](https://yakkeeper.vercel.app/) · [Setup and deployment](docs/setup.md) · [Report a security issue](.github/SECURITY.md)

## How it works

1. **Explore:** browse public projects, search by project, skills or owner, and filter by project type. Expand a card for its description and follow its repository link.
2. **Publish:** sign in with GitHub, select a public repository you own, and choose its type, status and visibility. The name and description come from GitHub. Add an optional banner and describe the help you need, if you want.
3. **Apply:** send an idea or a contribution request explaining what you would bring. A message is required; a blank request cannot be submitted.
4. **Review:** owners manage received requests in **Applications**; applicants track their sent requests there. Accepting records a decision in YakKeeper. Arrange the first task through GitHub; acceptance does **not** invite a collaborator or grant repository access.

**My projects** contains your own listings and editing controls. Owners can close requests, change visibility, replace banners or delete a listing. Deletion removes its YakKeeper applications, ideas, reports and banner; the GitHub repository stays untouched. **Reports** is an administrator-only queue for flagged listings.

Public listings appear in Explore. Private listings are visible only to their owner; archived listings leave public discovery. Beginner-friendly labels help contributors find suitable work. Light and dark themes and a responsive project grid are included.

## GitHub access and boundaries

GitHub handles authentication; YakKeeper never receives your GitHub password and requests no repository write permissions. Account ownership is checked server-side. Repository import supports personally owned public repositories, not private or organization repositories.

Repository details refresh when a listing is saved. YakKeeper does not continuously synchronize issues, commits or collaborator permissions. A GitHub sign-in proves control of that account, not a person's experience or real-world identity.

## Run locally

Use **Node.js 22**. From the repository root:

```sh
npm ci
```

Copy `.env.example` to `.env.local` and set `YAKKEEPER_LOCAL_DEMO=true`, then run:

```sh
npm run dev
```

Open [localhost](http://127.0.0.1:3000/). Choose **Try it / Switch account → Load test workspace** for four personas, two project owners and eight applications. Switch between accounts to try publishing, applying and reviewing. Sandbox identities are not GitHub verified; data persists in ignored `.local/yakkeeper.sqlite`.

For real GitHub login, database setup and production environment variables, follow the **[setup guide](docs/setup.md)**. Keep sandbox mode disabled in production. Never commit `.env.local` or server credentials.

## Architecture

![YakKeeper architecture](docs/assets/architecture.svg)

Next.js, React and TypeScript provide the website and Node.js API on Vercel. Supabase handles GitHub authentication, Postgres records and private banner storage. Server routes check identity, ownership and permissions before accessing records. Local sandbox mode uses SQLite instead.

Banners use Supabase Storage, **not Vercel Blob**. Optional WhatsApp administrator alerts are implemented behind a disabled setting; Meta setup and real delivery verification are still pending. See [WhatsApp setup and limits](docs/whatsapp.md).

## Repository map

| Path | Purpose |
| --- | --- |
| `src/app/` | Pages, project board, styles and API route |
| `src/lib/` | Validation, authentication, repository import, storage and notifications |
| `src/tests/` | API, permissions and multi-persona regression tests |
| `public/brand/` | Website logo and favicon |
| `supabase/migrations/` | Ordered database and storage migrations |
| `docs/` | Setup guide, design notes, banner and architecture diagram |
| `.github/` | CI workflow and security policy |

Framework configuration, the lockfile and environment template stay at the root so standard tooling works without extra setup.

## Contributing and checks

Install dependencies, make a focused change, then run:

```sh
npm run typecheck
npm test
npm run build
```

Tests cover validation, ownership, application privacy, moderation, deletion and multiple local personas. They do not replace testing OAuth with two real GitHub accounts or verifying WhatsApp delivery. Include relevant checks in your pull request; use [private security reporting](.github/SECURITY.md) for vulnerabilities.

## License

[MIT](LICENSE) — Copyright © 2026 4Raisan. Dependency licenses remain with their respective authors.
