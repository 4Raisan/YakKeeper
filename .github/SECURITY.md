# Security

Report vulnerabilities privately through [GitHub security advisories](https://github.com/4Raisan/YakKeeper/security/advisories/new). Do not put credentials, personal records or exploit details in public issues.

Only the current main branch is maintained. Keep Node.js and locked dependencies updated; run `npm ci`, `npm audit`, `npm test` and `npm run build` before deploying.

Production uses GitHub OAuth only; disable the unused email/password provider in Supabase.

Production must keep `YAKKEEPER_LOCAL_DEMO=false`. Server secrets belong in the hosting environment, never Git or `NEXT_PUBLIC_*` variables. `.env.example` intentionally contains empty credential values. Supabase publishable keys are public identifiers; application tables deny direct anonymous/authenticated access and are accessed through authenticated server routes. Banners use private storage.

YakKeeper requests no GitHub repository write access. GitHub identity is verified server-side; listing ownership and administrator permissions are checked on each API action. Project deletion never deletes a GitHub repository. Moderator-restricted repository IDs remain restricted after listing deletion.

The October 22, 2026 audit found no Gitleaks detections in reachable Git history or current source and no npm advisory findings at that time. These checks are point-in-time results, not a guarantee that the application is free of vulnerabilities. Live multi-account OAuth and a full external penetration test remain outside the automated test coverage.
