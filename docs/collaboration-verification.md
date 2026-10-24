# Collaboration improvements — 24 October 2026

## Implemented behavior

- **Members:** owner-only GitHub username lookup and account confirmation; in-app invitations bound to verified GitHub numeric IDs; recipient acceptance/decline; per-project member removal and invitation cancellation. Existing accepted contributors are backfilled. Declining an application revokes membership derived from that application. Membership and My projects no longer depend on the newest 100 applications.
- **Admission:** public projects can use open applications or invite only. Invite-only joining is enforced by the API, not just the disabled button. Ideas remain available when requests are open. Private listings remain owner-only; existing privacy is preserved. Owners can remove members without republishing a private listing.
- **Share:** stable `/projects/<uuid>` URLs, copy-link controls, and owner-selected starter task/effort/optional GitHub issue. Issue links must belong to the connected repository. Team tasks and member lists are never returned to anonymous visitors.
- **Tasks:** creator/owner title and description editing; owner-only archive/restore, paginated archives, retained participation, and a database-enforced limit of 200 active tasks. Archives do not consume active capacity. Normal updates reject archived tasks.
- **Applications:** one identity and message, a visible task-board action, and secondary controls under More. Account-wide blocking is explicitly labeled.

No GitHub write scopes, repository permission changes, email/WhatsApp delivery, or invitations to real users are involved in automated tests.

## Automated API tests

Run `npm test` and `npm run typecheck`. The collaboration regressions cover invitation access/identity, pending access denial, cancellation, replays after removal, project isolation, private listing privacy, member removal, membership beyond 100 applications, task author/owner authorization, archive/restore with participants, active capacity, archive pagination, share data isolation, and invalid starter issue URLs. Existing authentication, application privacy, moderation, deletion and origin tests continue to run.

## Repeatable browser check

Use an isolated local SQLite file and local-demo mode. Build first, then start on `127.0.0.1:3109`:

```powershell
$env:YAKKEEPER_LOCAL_DEMO='true'
$env:YAKKEEPER_LOCAL_DB=Join-Path $env:TEMP ('yakkeeper-ui-' + [guid]::NewGuid().ToString('N') + '.sqlite')
npm run build
npm run start -- --port 3109
```

In a second terminal in the repo:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=yak-check open http://127.0.0.1:3109 --headed
npx --yes --package @playwright/cli playwright-cli -s=yak-check run-code --filename=scripts/check-collaboration.pw.js
npx --yes --package @playwright/cli playwright-cli -s=yak-check close
```

The browser check uses separate owner/member/anonymous contexts. It verifies an owner configures invite-only joining and a starter task, invites a member, the member accepts and edits their task, the owner archives/restores it with participation intact, the anonymous share page fits 390px with no team controls, and removal denies the member's subsequent board requests. Screenshots stay in `output/playwright/`; they are not source assets.

## Live database and deployment checks

The three ordered migrations are applied before deployment. A query checks that accepted contributors have active membership records. A transactional production-Postgres check exercises the application-to-membership trigger, revocation, capacity enforcement, archive/restore, retained assignment, starter fields and cascade cleanup, then rolls back every fixture change. Check RLS and direct-client grants separately. Security advisor informational notices for no policies are expected for server-only tables with client privileges revoked; the pre-existing password-protection warning belongs to the GitHub-only Auth configuration.

After pushing, verify GitHub Actions, Vercel deployment status, the public project URL, and anonymous denial on the members/board APIs. Local browser personas are not a claim that a fresh two-real-GitHub-account OAuth test has been performed for the new invitations.
