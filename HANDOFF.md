# LuminaPH Handoff

Updated: 2026-11-11 (Asia/Singapore)

## Current stopping point

The latest broad scan found the Admin roadmap has moved on since the 2026-10-18 notes. **Overview, Users/account management, Reports & Feedback, and Activity Log all have local implementations. AI Control now has a local Groq model registry, per-tool routing, one bounded fallback attempt, and a prompt draft/test/publish/rollback flow.** The user confirmed on 2026-11-11 that the read-only Supabase catalog check returned `true` for every checked object from migrations `202611010001` and `202611010002` in the selected project, and confirmed applying `202611110001`. On 2026-11-11, all seven AI tools passed synthetic preview using `openai/gpt-oss-120b` and were published as v1 in the Admin UI. Per user request, the seven publication links were then removed in Supabase SQL Editor and their v1 rows archived, restoring code-defined prompts; a read-only count confirmed zero active publications. Prompt history remains available. Rollback testing with multiple published versions, usage telemetry/quota visibility, account deletion, and remaining live validation are outstanding.

### Live database status

- The user previously confirmed `202610080002_add_account_suspensions.sql` was applied successfully.
- On 2026-11-11, the user ran the read-only Supabase catalog query and confirmed every check returned `true`: model registry/settings tables and initial RPCs from `202611010001`, plus tool routes and routing RPCs from `202611010002`. This verifies the expected objects exist in the selected Supabase project; it is not a full runtime/permissions test.
- The user confirmed applying `202611110001_add_ai_prompt_versioning.sql` to Supabase. The app then loaded all seven prompt panels without a missing-migration warning. In `/admin/ai-control`, all seven tools' v1 prompts passed synthetic preview on `openai/gpt-oss-120b`. At the user's request, the seven publication links were removed through Supabase SQL Editor and each v1 row was archived; a read-only count returned zero active publications. This restores each tool's code-defined prompt while retaining version history. Learning paths initially returned an incomplete response because the generic sample exceeded the 450-token preview cap; a one-lesson sample and 700-token cap fixed it. Rollback and independent role/runtime checks remain unverified.
- No later migration application status was confirmed during the 2026-11-01 scan. Treat all other local migrations as **not verified live**, even when their UI or RPC callers are present.
- The application status of `202610080003_add_account_suspension_actions.sql` and `202610180001` through `202610180009` remains unconfirmed. Do not rerun migrations that are already applied.
- The assistant has no live Supabase connection for this scan. Local code and migration files do not prove production state.

## Current Admin implementation in the repo

- **Overview:** `/admin` displays platform totals and generation-attempt activity. Attempts may include failed calls after reservation and developer tests; these are not provider quota remaining.
- **Users:** `/admin/users` supports search/filtering and pagination, and user profile views include usage, configurable generation allowances, admin role controls, and temporary/permanent account suspension controls.
- **Regular Admin access:** server action in `app/(admin)/admin/users/admin-role-actions.ts`; database management logic is in `202610180003_manage_regular_admin_roles.sql`. The UI/database permissions are intended for Super Admin management only.
- **Account suspension:** controls and server action are present, including reasons, duration, retry IDs, and status display. Local proxy/layout/admin checks and the RLS/trigger enforcement migration are present. Live enforcement and direct RPC/storage behavior still need verification.
- **Reports & Feedback:** user submission flow is under `app/(student)/feedback`; Admin review, status/reply, screenshot display, and resolved-report cleanup are under `app/(admin)/admin/reports`. Relevant migrations are `202610180007`–`202610180009`.
- **Activity Log:** `/admin/activity-log` displays account-management events with pagination. The admin activity and alert migration is `202610180006_admin_activity_and_alerts.sql`.
- **AI Control (in progress):** `/admin/ai-control` registers, enables/disables, activates, and removes Groq models, assigns a primary plus optional fallback for seven tools, and has prompt draft/test/publish/rollback UI and server actions. Optional prompt guidance currently falls back to code-defined prompts for all seven tools because their publication links were removed per user request; archived prompt versions remain in history. Preview uses fixed synthetic requests, not student data, and may consume provider quota. Writes are Super Admin-only and logged in the Admin Activity Log. The user confirmed the registry/routing objects from migrations `202611010001` and `202611010002` exist in Supabase via a read-only catalog query, and confirmed applying prompt migration `202611110001`. Broader runtime behavior has not been verified. Usage/quota views remain unimplemented, and the current implementation supports Groq only.
- **Account deletion:** no account deletion flow is present in the Admin route inventory. It needs a data ownership/retention review before implementation.

## Account-management and enforcement details

The local migration sequence includes:

- `202610080002_add_account_suspensions.sql`: private suspension storage and current-account status function. User confirmed this migration was applied.
- `202610080003_add_account_suspension_actions.sql`: protected suspend/restore RPC with audit event and retry handling. Application status unconfirmed.
- `202610180001_enforce_suspensions_on_rls.sql`: restrictive RLS policies and DML triggers, storage policy where available, and suspended-account checks in protected helper functions. Application status unconfirmed.
- `202610180002_block_suspended_group_invite_lookup.sql`: blocks suspended callers from group invite lookup. Application status unconfirmed.
- `202610180003_manage_regular_admin_roles.sql`: grant/revoke regular Admin management. Application status unconfirmed.
- `202610180004_add_temporary_account_suspensions.sql`: duration support for suspensions. Application status unconfirmed.
- `202610180005_filter_admin_users.sql`: Admin user list filtering. Application status unconfirmed.
- `202610180006_admin_activity_and_alerts.sql`: activity and alert support. Application status unconfirmed.
- `202610180007_add_reports_and_feedback.sql`, `202610180008_report_screenshots_and_full_admin_alerts.sql`, and `202610180009_delete_resolved_reports.sql`: report storage/review, screenshot and alert support, and resolved-report cleanup. Application status unconfirmed.
- `202611010001_add_ai_model_registry.sql`: global Groq model registry, Super Admin management RPCs, model selection for authenticated AI requests, and activity-log entries. Requires the existing admin/activity/suspension foundations (including `admin_activity_log.details` and `is_current_account_suspended()`). Registry/settings objects and core functions confirmed present in Supabase on 2026-11-11.
- `202611010002_add_ai_tool_routing.sql`: routes seven AI tools to registered primary/fallback Groq models; adds Super Admin route management, fallback dependency checks, global-route reset behavior, and audit logging. Requires `202611010001` and the same admin/activity/suspension foundations. Route table and core routing functions confirmed present in Supabase on 2026-11-11.
- `202611110001_add_ai_prompt_versioning.sql`: per-tool prompt drafts, synthetic preview test records, publishing, rollback, and audit entries. The user confirmed applying it. All seven tools' v1 prompts passed synthetic previews and were published through the Admin UI on 2026-11-11, then archived and unpublished via SQL Editor at the user's request; zero active prompt publications was confirmed. Learning paths uses a smaller synthetic sample and a higher preview-only token cap after the original response was truncated. The matching local AI calls fall back to code-defined guidance while retaining mandatory system instructions; previews may consume Groq quota.

Suspension enforcement is defense in depth: the proxy checks matched app routes, student/admin server paths also check status, and the SQL migration is intended to protect direct database access. Verify the installed RPCs and policies against the live project before relying on this behavior. No service-role key/client use was found in the earlier repository inspection; do not claim that other Supabase Auth sessions are revoked. Existing signed URLs may remain usable until expiry.

## Generation allowances

`202610080001_enforce_user_generation_allowances.sql` integrates default/custom/unlimited user allowances with material and tutor reservations and Admin usage reporting. `ADMIN_REVIEW.md` records the earlier validation scope and expected behavior:

- Defaults: 5 material and 20 tutor attempts per rolling 24 hours.
- Custom caps: 1–1000 for each category.
- Unlimited removes the personal cap but retains ordinary cooldowns and shared app caps.
- Developer access remains a separate bypass; changing an allowance does not erase attempt history.
- Successful changes are audited; exact request retries are idempotent and mismatched reuse is rejected.

These behavior notes and old local test results are not a live Supabase verification. Check the migration state before using the feature as evidence of deployed configuration.

## Recommended next steps

1. **Confirm remaining live migration state** with the user or Supabase migration history, especially `202610080003` and `202610180001`–`202610180009`. Compare dependencies and apply only missing migrations in order.
2. **Validate account management against a test account** after confirming migrations: ordinary user vs regular Admin vs Super Admin, self/protected targets, suspension expiry, role grant/revoke, audit entries, direct RPC/table paths, and storage behavior. Avoid claiming auth session revocation or invalidation of existing signed URLs.
3. **Continue AI Control:** if prompt versioning is resumed, test rollback after there are at least two published versions for a tool. Verify route changes and fallback behavior with safe settings. Add usage telemetry and an honest provider quota view. Keep secrets server-side; a new provider still needs server integration and configured credentials.
4. **Plan account deletion** only after reviewing group ownership, shared snapshots, storage objects, foreign keys, notifications, and audit retention. Limit it to Super Admin and use strong confirmation.
5. Update this handoff after the next milestone and record which migrations the user confirms applying.

## Product and privacy boundaries

- LuminaPH serves Junior High, Senior High, College, and independent learners across subjects; supports English, Filipino, and Taglish.
- Users may provide their own learning materials. Do not invent school/curriculum source claims.
- Admins may see basic account details, aggregate counts, usage metadata, activity metadata, and reports users choose to submit. Do not expose private notes, study guides, tutor chats, prompts, quiz answers, or private group content to Admins.
- Unlimited app allowance does not mean unlimited provider quota.
- Do not promise that an app-level suspension prevents a Supabase project owner from changing or deleting accounts.

## Collaboration preferences

- Speak conversational Taglish. The user is learning and prefers clear explanations. For “next/proceed,” take a small hands-on step and explain it. The user previously said “ikaw na gumawa explain mo na lang” for the ban/unban task; that authorized work on that task, not every future roadmap item.
- Prefer readable JavaScript/TypeScript/SQL with descriptive names, braces, explicit conditionals, and short Taglish comments. Retain necessary validation and security checks.
- Before adding Next.js code, read the relevant installed guide under `node_modules/next/dist/docs/`, as required by `AGENTS.md`.
- Migrations are manually applied by the user in Supabase SQL Editor. Never claim an unapplied local migration is live. When asking the user to apply a migration, give the filename only (not a nested path).
- Never reset, clean, or commit the workspace unless explicitly asked. Preserve unrelated user changes.
- Never put passwords or secrets in this file, code, or migrations.

## Repository and verification snapshot (2026-11-01)

- Workspace: `C:\Users\xenon\LuminaPH-v2`.
- `git status --short` was empty before the AI Control work began. The local history shows one grafted commit (`e076d62`), so it does not provide a useful detailed change timeline.
- The project uses Next.js `16.3.5`, React `19.2.8`, TypeScript, Supabase, and Groq; scripts include `dev`, `build`, `start`, and `lint`.
- Admin route inventory includes overview, users, profile, reports, activity log, and the local AI Control model registry/tool routing UI. No account deletion route was found.
- AI Control's registry/routing objects were confirmed present via the user's Supabase catalog check on 2026-11-11. The user confirmed applying the prompt versioning migration; all seven v1 prompts passed synthetic previews and were published in the local app, then the user requested restoring code prompts. The assistant removed the seven Supabase publication links via SQL Editor, archived their v1 rows, and verified zero active publications. No migration was applied by the assistant.
- The initial pass was a repo/status scan, not a line-by-line audit, deployment check, or live security certification. For the local AI Control registry/routing changes, TypeScript and targeted ESLint passed; no tests or live Supabase checks were run.
- `ADMIN_REVIEW.md` still contains a 2026-10-08 “still pending” list that is stale for role management, Activity Log, and Reports & Feedback. Update it separately if that historical review is still being maintained; its recorded test results remain historical evidence, not a fresh run.
