# Project task boards

Each project owner and accepted contribution member can open **Task board** from its card. Live accepted applications also provide an **Open task board** shortcut. The board starts empty; the existing roadmap is retained separately.

## Controls

- **Add task** creates a title (3–160 characters), optional details (up to 2,000 characters), and an initial column.
- **Future**, **Ongoing**, and **Finished** show planned, active, and completed work. Use each task's status selector to move it or reopen it. Keyboard and mobile users can use the same controls without dragging.
- **I'm working on this** marks your own participation. Multiple people can join. **I'm on this · leave** removes only your assignment. Finished tasks retain their participants; reopen them before adding new participants.
- **Refresh** reloads shared state. Updates also load after writes, on focus, every 20 seconds while visible, and through a same-browser tab notification. This is polling, not instantaneous cross-device realtime.

## Access and persistence

The API rechecks ownership or an accepted contribution on every board read and write. Accepted ideas do not grant membership. Blocked or declined users lose board access. Non-owners cannot access private, archived, or moderated listings. Archived boards are read-only for owners. Listing edit/delete permissions are unchanged.

Tasks and participant rows live in `yak_tasks` and `yak_task_workers`. Both tables enable RLS, deny direct `anon`/`authenticated` access, and allow the existing server role. Assignments use a unique `(task_id,user_id)` constraint so concurrent participation does not overwrite another member's assignment. Project deletion cascades to tasks and assignments in Postgres and the local SQLite sandbox. No task information is included in public discovery responses.

Boards support 200 tasks, and creation is limited to five tasks per member per minute. Status changes are shared team actions; the last saved status wins. Task assignments do not modify GitHub permissions.

## Verification

`npm test` includes an API lifecycle regression for anonymous/pending/idea/stranger rejection, accepted access, malformed input, self-only participation, two participants, idempotent joins, cross-project isolation, status changes/reopening, revoked/blocked access, private/archive restrictions, origin checks, and deletion cleanup. `npm run typecheck` and `npm run build` validate the client integration.

Local browser checks use a separate SQLite sandbox. The live database migration and table privileges are verified separately; these checks do not claim an authenticated two-account browser test of the new board in production.

To repeat the live check: open the same project's board as owner and accepted member; create a future task, join it from each account, move it to Ongoing and Finished, refresh both accounts, and confirm the status and participants persist. Try the URL while signed out and with an unrelated account; both must be denied. Decline or block the member and confirm subsequent API reads/writes are denied.
