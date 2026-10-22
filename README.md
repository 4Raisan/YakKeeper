# YakKeeper

<p align="center"><img src="docs/assets/yakkeeper-readme-banner.svg" alt="YakKeeper — Where projects meet their next contributors." width="640"></p>

Find teammates and contribute to public GitHub projects.

**[Open YakKeeper](https://yakkeeper.vercel.app/)**

- Sign in with GitHub and choose one of your public repositories.
- Publish a listing with the help you need, then receive ideas and join requests.
- Review applications and agree on next steps. GitHub repository access stays under your control.

Repository details come from GitHub. YakKeeper never receives your GitHub password or requests repository write access.

## Run locally

Use Node.js 22. Run `npm ci`, copy `.env.example` to `.env.local`, and set `YAKKEEPER_LOCAL_DEMO=true`.

```sh
npm run dev
```

Open [localhost](http://127.0.0.1:3000/). Use **Try it / Switch account → Load test workspace** to test four personas, two project owners and eight applications. Sandbox data persists locally in ignored `.local/yakkeeper.sqlite`; these accounts are not GitHub verified. Keep sandbox mode disabled on hosted deployments.

## Architecture

![YakKeeper architecture](docs/assets/architecture.svg)

Next.js, React and TypeScript on Vercel; Supabase handles GitHub authentication, Postgres and private banner storage. Server routes enforce ownership and permissions.

For real sign-in and hosting, follow the **[setup guide](docs/setup.md)**. WhatsApp alerts are optional and currently deferred: [setup and limits](docs/whatsapp.md).

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover ownership, application privacy, moderation, deletion and multiple local personas. Real multi-account OAuth and WhatsApp delivery need separate integration checks.

[Security policy](SECURITY.md) · [Design notes](docs/design.md)
