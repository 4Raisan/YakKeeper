# Collaboration and GitHub access

## GitHub access and boundaries

GitHub handles authentication; YakKeeper never receives your GitHub password and requests no repository write permissions. Account ownership is checked server-side. Repository import supports personally owned public repositories, not private or organization repositories.

Repository details refresh when a listing is saved. YakKeeper does not continuously synchronize issues, commits or collaborator permissions. A GitHub sign-in proves control of that account, not a person's experience or real-world identity.

The hosted application has been checked with GitHub sign-in and public repository discovery. Automated tests cover multiple local personas; the full two-real-account OAuth workflow needs separate integration verification. WhatsApp remains disabled by default and live delivery is not verified.

## Members, invitations and sharing

Each owner has a **Members** panel: look up a GitHub username, confirm the account, and send an invitation. Recipients accept or decline in **My projects**. Owners can cancel pending invitations or remove a member from that project. Invitations stay tied to the verified GitHub account ID if its username changes. Existing accepted contributors are preserved as members independently of application-history limits.

Use **How people join** in the editor to choose **Open applications** or **Invite only**. A public invite-only project stays in Explore; its Join button is disabled, while ideas can still be submitted when requests are open. Private listings remain owner-only. These controls do not manage GitHub repository permissions, send email, or request repository write scopes.

**Copy share link** gives a direct `/projects/<id>` page. Owners can highlight a starter task, effort, and an optional GitHub issue from the connected repository. Sharing a listing does not expose the private team board or member list.

## Shared project task boards

Open **Task board** on a project you own or have joined through an accepted contribution request. Plan tasks in **Future**, **Ongoing**, and **Finished**. Owners and accepted members can create tasks and change their status, including reopening finished work. Use **I'm working on this** to add yourself; several members can work on the same task, and each person controls their own participation.

Boards are team-only. Pending applicants, accepted idea submissions, blocked accounts, and declined members cannot access them. Members cannot access private or archived listings; owners can read archived boards. A task assignment does not grant GitHub access. Boards refresh on window focus, every 20 seconds while visible, and after changes; use **Refresh** for an immediate update. Each board supports up to 200 active tasks, with task creation limited to five per member per minute.

Owners and task creators can edit task titles/details. Owners can archive tasks and restore them from **Archived**; archived work does not count toward the active limit, and its participants are retained.

For a new deployment, apply all ordered files in [`supabase/migrations`](../supabase/migrations) before deploying the application. These migrations are already applied to the existing YakKeeper database. See [task board verification](task-boards.md) for behavior and checks.

