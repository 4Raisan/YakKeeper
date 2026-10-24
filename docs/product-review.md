# YakKeeper focused product review

**Implementation update, 24 October 2026:** the three priorities below are now implemented: project membership/invitations, share pages/starter tasks, and task edit/archive/restore. Application simplification is included. The remaining text records the earlier review, not current behavior. See [collaboration verification](collaboration-verification.md) for implemented behavior and checks.

Reviewed 23 October 2026 against the current source, supplied two-account screenshots, and primary platform documentation. This is a product/code review, not a traffic, load, or conversion benchmark.

## Direction

Help someone discover a public project, understand one useful contribution, join a small team, and finish their first task. Keep the board as the team's lightweight handoff after discovery and acceptance.

## Invitations: current behavior and proposed change

There is no active project invitation or username-based member-management API/UI. The legacy `yak_invitations` table belongs to an older email/account activation design; it does not provide project invitations in the current application. Membership is derived from an accepted contribution request. An accepted idea is not membership. Owners can decline a previously accepted request, but there is no clear per-project Remove member action. Blocking applies across all projects belonging to that owner.

A public listing can already remain in Explore with `contributions_open=false`. That closes both join requests and ideas; it does not create an invitation workflow. A private listing is owner-only, including board access for existing contributors.

The next small feature should separate **listing visibility** from **how people join**:

- Public + open applications: current discovery and application flow.
- Public + invite only: still appears in Explore; show Invite only instead of Join. Owner can invite a GitHub username and remove a project member.
- Resolve usernames to stable GitHub numeric IDs, show the resolved account before inviting, and verify the signed-in identity before accepting an invitation. Support a clear Pending state for people who have not joined YakKeeper yet.
- Keep a small project-specific member record with owner/member roles. Revoking membership must immediately deny board reads and writes without globally blocking the person.
- YakKeeper invitations affect YakKeeper only. GitHub repository collaborator invitations remain separately managed, as documented by [GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository).

This invitation feature is proposed, not implemented by this review.

## Application simplification implemented locally

Show the person's identity once, the project once, and the full message once. Accepted contributions get one primary Task board action. Put repository links, explicitly labeled GitHub permissions, and account-wide blocking under More. Remove the repeated message, duplicate profile link, and routine disabled WhatsApp detail. Accepted ideas no longer display the membership wording. Keep the existing review statuses and server permissions.

## Efficiency and verified gaps

The Vercel API, Supabase persistence, bounded reads, server authorization, and simple three-column board fit a small early platform. No measured latency or acquisition data was collected, so there is no defensible efficiency score or claim that the site attracts contributors yet.

1. **Membership is coupled to applications.** `GET /api/hub` derives joined projects from `sent`, and `store.find` defaults to the newest 100 rows. An older accepted contribution can fall out of My projects after enough newer requests. `boardAccess` separately checks the exact accepted application, so board permission can remain valid while navigation loses the project. A member table addresses both this bug and invitations.
2. **Task lifecycle is incomplete.** Tasks can be created, joined, moved, and reopened, but their title/details cannot be edited and there is no archive/delete action. At 200 tasks, creation stops with no normal way to free capacity. Add editing and an owner-controlled archive with archived tasks excluded from the active limit.
3. **Discovery is limited to loaded records.** Search/filter runs in the browser over fetched projects, initially 24 and at most 240 through the current page limit. It is not global search. Move query/filter to the API when there are enough listings to need it; show accurate empty and load-more states meanwhile.
4. **Sharing and first contribution are weak.** The UI has view URLs, but no implemented direct per-project detail/share route. Needs is free text, and the team board is private. Add a project share URL and one owner-selected public starter task or GitHub issue link; keep the rest of the board team-only.
5. **History and synchronization are basic.** Task status is last-write-wins with polling every 20 seconds; there is no activity history. This is understandable for a small team, but a small changed-by/changed-at line would make decisions clearer. Full realtime infrastructure is not needed first.

## Research and narrow next steps

[GitHub's contributor guide](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-open-source) emphasizes finding suitable work with `good first issue` and `help wanted`. [CodeTriage](https://www.codetriage.com/what) centers the contributor journey on small, approachable issues. [GitHub Projects guidance](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/best-practices-for-projects) recommends small work items, clear descriptions, and a single source of truth.

For YakKeeper, the resulting recommendation is:

1. **Members and invite only:** explicit project membership, GitHub username invitations, and per-project removal. Keep public discovery independent.
2. **A useful first contribution:** shareable project page, clear help needed, expected commitment, and one beginner-suitable starter issue/task. Prefer links to existing GitHub issues over synchronizing or duplicating an issue tracker.
3. **Finish the small board:** edit/archive tasks, preserve participants, and show who last changed a task. Retain the three columns.

Evaluate success with a small pilot: did a discovered project receive a relevant request, did the owner respond, did an accepted person start and finish a task, and how long did those steps take? Do not introduce chat, a social feed, AI matching, sprints, billing, complex role hierarchies, or GitHub write scopes for these three improvements.

## Verification limits

The supplied live screenshots support application submission, owner acceptance, and applicant visibility of the accepted decision. Earlier local board tests cover authorization and task flows. The new invitation model is not implemented or verified. Application-card changes are local, with build/type checks and a sandbox visual check; they have not been committed, pushed, or deployed in this review.
