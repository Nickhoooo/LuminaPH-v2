# LuminaPH Handoff

Updated: 2026-10-18 (Asia/Singapore)

## Current stopping point

We are working on **Admin → Users → account management**, currently the **ban/unban foundation**.

- The user confirmed that `202610080002_add_account_suspensions.sql` was run successfully.
- `202610080003_add_account_suspension_actions.sql` is present locally. It adds `set_account_suspension(target_id, suspended, reason, request_id)`, applies the existing admin permission rules, writes the suspension and activity log in one transaction, and safely handles matching retries.
- The user has **not confirmed that 202610080003 was run**. It needs the audit columns from `202610060009_add_set_user_generation_allowance.sql` (`request_id`, `details`) and assumes the earlier admin foundation/role migrations are present.
- `scripts/check-account-suspensions.cjs` passed 38 isolated PGlite assertions. This did not connect to Supabase and is not a real concurrent-session test.
- **Suspension enforcement is now partly implemented locally.** See the 2026-10-18 update below. It is not live until the new migration is applied and direct RPC paths are verified. There is no ban UI yet.

2026-10-18 enforcement work added locally:

- `lib/supabase/proxy.ts` checks session claims and calls `is_current_account_suspended()` on matched app routes. Suspended users go to `/account-suspended`; status-check errors go to `/account-status-check` (fail-closed). Refreshed auth cookies are preserved across redirects.
- `app/account-suspended/page.tsx` shows a generic message and reuses the existing logout confirmation/storage cleanup flow. `app/account-status-check/page.tsx` offers retry via `/dashboard` and logout. Both paths are intentionally excluded from the proxy matcher so the user can see the message and sign out.
- `app/(student)/layout.tsx` and `lib/require-admin.ts` repeat the account-status check as defense in depth.
- `202610180001_enforce_suspensions_on_rls.sql` adds a restrictive authenticated policy to each public RLS table, DML statement triggers to those tables, and a restrictive policy to `storage.objects` when present. It also defines a private active-account guard and updates `is_app_administrator`, `is_super_administrator`, and `is_study_group_member` so protected admin/group reads reject suspended callers. This migration depends on 002 (user reported applied), but not 003.
- `app/(admin)/admin/users/suspension-actions.ts` loads suspension details for an admin and calls the protected SQL ban/unban function with server-side validation.
- `app/(admin)/components/AdminUserSuspension.tsx` displays status/reason and provides required-reason confirmation for suspend/restore with a stable retry ID. `AdminUserProfile.tsx` loads status alongside usage and renders the control.
- TypeScript passed. Targeted ESLint stalled without output and was interrupted. No SQL parser test or live database check was done.
- **Next:** confirm whether 003 ran; validate 180001 in isolated Postgres before asking the user to apply it; audit remaining callable `SECURITY DEFINER` read functions and storage URL behavior; then user applies the migration and tests with ordinary/admin accounts.
- No service-role key or service-role client use was found in the repo. The app redirects existing sessions on their next matched request, and RLS/trigger checks block database access, but Supabase Auth sessions are not revoked and pre-existing signed URLs may continue until expiry. Do not claim those are revoked.

## Repository scan on 2026-10-18

Scanned the application route inventory, admin and student layouts, auth/session proxy, login flow, migrations, AI model configuration, key notification/settings paths, TODO/placeholder markers, and current git status. The repo has about 215 tracked/untracked source files outside generated dependencies and 27 `page`/`route` entries. This was a broad architecture/status scan, not a line-by-line audit of every file or a live production security review.

### Product and route map

Student app routes include dashboard, Library and material pages, profile, settings, notifications, Study Tools, study guides, flashcards, quizzes, learning paths, AI Tutor, Study Groups, group materials, and group shared lessons/quizzes. Auth routes include login, signup, password reset, and email confirmation.

Prior work in this project covered:

- Study material saving, AI study guides, flashcards, quizzes and attempts.
- Personal learning paths with saved lesson guides and tutor conversations.
- Study Groups: short invite codes, membership, member display names, leave/remove/delete, shared material snapshots, group avatars, and a shared five-lesson/five-quiz track with individual progress. A lesson must be marked read/complete before its quiz.
- Notifications, profile/settings, theme/accent preferences, and profile photos.
- Admin overview, searchable/paginated users, profile/usage modal, and configurable usage allowances.

These are based on repo structure and prior implementation notes, not a fresh end-to-end certification of every student feature.

## Admin status

Admin navigation currently enables **Overview** and **Users**. **AI Control**, **Reports & Feedback**, and **Activity Log** remain disabled placeholders with no corresponding pages in the route inventory.

Overview displays platform totals and 24-hour generation-attempt counts. The UI correctly explains attempts can include failed calls after reservation and developer tests; the counts are not model quota remaining.

Users has name/email search, pagination, a basic profile modal, usage cards, and a Super Admin usage allowance form. The existing UI reports administrator as a single boolean label, so it does not distinguish regular Admin from Super Admin in the user table/modal yet.

Existing permission foundation in `202610060004_add_admin_management_foundation.sql`:

- Rejects self-management and all Super Admin targets.
- Regular Admin may only ban/unban ordinary users; cannot manage any admin or perform delete, usage, or role actions.
- Super Admin may do the whitelisted management actions on eligible users.
- The guard is private/revoked from clients; management RPCs must call it server-side in SQL and must not trust a browser-supplied actor ID.

## AI usage allowance work completed

`202610080001_enforce_user_generation_allowances.sql` integrates default/custom/unlimited allowance settings into the material and tutor reservations and admin usage display. The user reported the allowance feature is working. Earlier validations recorded in `ADMIN_REVIEW.md` and `HANDOFF` history: TypeScript, targeted ESLint, production build, 63 isolated PGlite SQL assertions, and 18 headless UI assertions passed. These checks are local/mocked, not live Supabase checks.

Behavior:

- Default caps remain 5 material-generation attempts and 20 tutor attempts per rolling 24 hours.
- Custom caps are 1–1000 for each category.
- Unlimited removes the personal cap but keeps normal cooldowns and shared app caps.
- Legacy developer access remains a separate full bypass and is not edited through the user allowance form.
- Changing an allowance does not delete past attempts. Successful changes are audit logged; same-request retries are checked against the original payload.

Relevant code: `lib/admin-users.ts`, `app/(admin)/admin/users/usage-actions.ts`, `app/(admin)/components/AdminUserProfile.tsx`, `AdminUserUsage.tsx`, and `AdminUserAllowanceForm.tsx`.

## Ban/unban files and constraints

- `202610080002_add_account_suspensions.sql`: private suspension table plus `is_current_account_suspended()` for the current user. User reported it succeeded.
- `202610080003_add_account_suspension_actions.sql`: protected set/clear function plus atomic audit event. Locally prepared; live application is unconfirmed.
- `scripts/check-account-suspensions.cjs`: isolated tests for roles, protected/self targets, input validation, RLS, retries, audit records, and rollback.
- No admin ban/unban controls are wired into `AdminUserProfile.tsx`.
- Proxy, student layout, and admin helper now check suspension status in local code; live behavior remains unverified.
- App uses only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the inspected Supabase server/proxy clients. No service-role key reference was found. Database/RPC policy enforcement is therefore essential; signing out/revoking other sessions may require a carefully configured server-only Supabase Admin API credential later.

Recommended ban implementation sequence:

1. Confirm migration 003 application status. If unapplied, verify dependencies and have the user apply it once.
2. Validate `202610180001` in isolated PostgreSQL (policy/trigger syntax, all RLS tables, Storage policy), then provide exact apply order and wait for live confirmation.
3. Audit externally callable SECURITY DEFINER read functions not covered by the admin/group helpers, and review Storage signed/public URL behavior.
4. Add Admin profile ban/unban controls with required reason, confirmation, busy/error states, safe retry IDs, and refreshed profile/activity log.
5. Verify regular Admin vs ordinary user and protected/self targets; test active-session navigation, Server Actions, direct table access, direct RPCs, and Storage. Clarify that existing auth sessions/signed URLs are not actively revoked.

Avoid promising that an app-level ban prevents the Supabase project owner from changing or deleting accounts.

## Remaining accepted roadmap

Continue the Users/account-management path in this order:

1. Complete and wire ban/unban enforcement and controls.
2. Add/revoke **regular Admin** access from Super Admin only. No browser action can create/promote a Super Admin; protect self and all Super Admin accounts.
3. Add account deletion for Super Admin only after reviewing group ownership, shared material snapshots, storage files, foreign keys, notifications, and audit retention. Use strong confirmation and ensure deleting an account does not unexpectedly erase group-owned work.
4. Build an Activity Log page with filters/pagination and only the admin-visible audit metadata.
5. Build Reports & Feedback for concerns users voluntarily submit. Do not give admins access to private learning material, tutor chats, prompts, quiz answers, or private group content.
6. Build AI Control: provider/model registry with add/disable/remove safety, per-tool routing (strong lesson/explanation model, practice/quiz model, emergency fallback), bounded fallback behavior, versioned prompts with test/publish/rollback, usage telemetry, and honest quota visualization. Models can be switched/managed without hardcoding model IDs. Adding a provider still requires its server integration and secret configuration.

AI currently uses one hardcoded Groq model in `lib/ai/groq.ts` (`openai/gpt-oss-120b`), 30-second timeout, SDK retries disabled. Dynamic model routing, prompt management, actual provider quota metrics, Reports/Feedback, and Activity Log UI are not implemented.

## Privacy and product boundaries

- LuminaPH serves Junior High, Senior High, College, and independent learners across subjects; supports English, Filipino, and Taglish.
- No school/curriculum lookup APIs; avoid inventing source claims. Users may provide their own study materials.
- Admins may see basic account details, aggregate counts, usage metadata, and voluntarily submitted reports. They should not browse private notes, study guide contents, group content, prompts, tutor conversations, or quiz answers.
- Unlimited app allowance does not mean unlimited provider quota.

## Collaboration preferences

- Speak conversational Taglish. User is learning and wants code explained clearly.
- The user usually prefers **hands-on** for “next/proceed”: give a small step and explain it. They explicitly said “ikaw na gumawa explain mo na lang” for the current ban/unban step, so direct code edits are authorized for that task. This does not automatically authorize building every future roadmap item.
- Prefer readable JavaScript/TypeScript/SQL with descriptive names, braces, explicit `if/else`, and short Taglish comments. Keep necessary type checks, hooks, and security controls; explain why they exist.
- Before adding Next.js code, read relevant installed docs under `node_modules/next/dist/docs/` as required in `AGENTS.md`.
- Migrations are manually applied by the user in Supabase SQL Editor. Never claim an unapplied local migration is live. When asking user to create a migration inside the migrations folder, give the filename only (they have accidentally nested the path before).
- Preserve the many unrelated working-tree changes. Do not reset/clean/commit them.
- Actual repo used in recent work: `C:\Users\Acer Nitro V15\lumina-ph-v2`. The IDE sometimes reports `C:\Users\Acer Nitro V15\LuminaPH`; verify before editing because these paths may differ.
- Never put prior chat passwords or secrets in this file, code, or migrations.

## Verification and live state

- No Supabase live connection was used by the assistant. Migration application status is only known where the user explicitly reported success.
- No tests were run during the 2026-10-18 scan/update. Existing test results are listed with their scope above.
- Many project files have uncommitted modifications and untracked files; this is the current collaboration workspace, not a clean checkout.
