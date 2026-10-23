# Admin allowance review — 2026-10-08

Scope: user changes since HANDOFF.md, focusing on Admin → Users → usage controls and their generation consumers. This is not a full live-platform security certification.

## Findings and fixes

| Finding | Impact | Fix |
| --- | --- | --- |
| Settings were stored but reservations still used fixed 5/20 caps | Saving a custom limit did not change generation | New shared effective-allowance resolver, integrated into both reservation functions and usage reporting |
| Modal passed `canEdit={true}` | Regular admins/protected targets saw inappropriate edit controls | Server-derived edit capability/reason, Super Admin check in action and protected SQL save |
| Retry lookup returned any receipt matching actor/request ID | Different payload could be reported as a successful previous change | Compare action, target, normalized reason, and full settings before returning a duplicate receipt |
| Save lacked catch/finally | Interrupted requests could leave the form stuck in Saving | Recoverable error, busy cleanup, same request ID retained for retry |
| Custom values were blank/stale; radio group names shared between dialogs | Confusing edits and cross-dialog radio interference | Prefill current effective limits, refresh/remount after loading, unique group names |
| Usage validation only supported default/unlimited; save response was cast blindly | Custom results rejected or malformed saves trusted | Runtime validation for custom usage, limit relationships, edit capability, and save payload |
| Student errors always claimed fixed 5/20 limits | Incorrect guidance for custom accounts | Allowance-aware wording |
| Future nav buttons looked disabled but were not disabled | Misleading interaction affordance | Disabled buttons |

## Database deployment

No live migrations were run by the assistant.

1. Ensure earlier migrations through `202610060008_add_user_generation_allowances.sql` are applied.
2. If not already applied, run `202610060009_add_set_user_generation_allowance.sql` once. This creates audit metadata and the initial save function.
3. Run **`202610080001_enforce_user_generation_allowances.sql`** once. This forward migration replaces the save, reporting, and reservation functions; adds the private shared resolver; and reloads the API schema cache.
4. Do not rerun an already-applied migration just to refresh the page.

The new frontend expects the new usage response. Until step 3 is applied, it may report that usage information could not be read.

## Behavior after applying the migration

- Defaults: 5 material and 20 tutor attempts per rolling 24 hours.
- Custom: independent integer caps from 1 through 1000.
- Unlimited: no personal cap; ordinary-user cooldowns and shared app caps still apply.
- Developer allowlist: retains its existing full app bypass and is managed separately. Developer settings cannot be edited through this form, even if an old allowance row exists.
- Admin status alone does not grant unlimited usage.
- Existing attempt history is retained when limits change.
- Exact retry returns the previous receipt without another audit event or reapplying old settings. Reused ID with different data fails.
- Account locks and shared advisory locks serialize allowance saves with reservations. Future role/ban/delete functions must follow the documented management locking order.

## Validation

- TypeScript: passed.
- ESLint for admin files, admin-user helper, and study-tool code: passed.
- Production build: passed (including admin routes).
- 63 isolated PostgreSQL/PGlite assertions: passed. Covers role restrictions, protected/self/developer targets, RLS, validation, exact/mismatched retries, custom caps, cooldowns, global caps, developer bypass, audit rollback, and history retention.
- 18 headless Edge browser assertions with mocked server actions: passed. Covers lazy usage loading, saved values, reason/limit validation, network failure and retry IDs, pending-save dialog protection, refresh, account isolation, read-only controls, and load-error recovery.

Test sources:
- `scripts/check-admin-allowances.cjs` requires `@electric-sql/pglite`.
- `scripts/check-admin-allowances-ui.cjs` requires `esbuild`, `playwright-core`, and Edge (or an EDGE_PATH override).

Existing temporary test-tool installations supplied these dependencies through NODE_PATH. No production dependencies were added. Test data is synthetic; no live credentials/accounts or AI calls are used. These isolated checks do not replace live Supabase validation or real multi-session concurrency testing.

## Live check to perform next

As a Super Admin, open an ordinary test account, set a small custom allowance with a reason, confirm, and verify refreshed numbers. Use that test account to verify generation respects the configured cap. Verify ordinary admins and Super Admin targets have read-only allowance controls. In the database, confirm one audit event per successful request and preserved attempt history.

## Still outside this completed phase

Ban/unban (including existing-session enforcement), add/remove regular admin, safe account deletion, Activity Log UI, Reports & Feedback UI, dynamic AI model registry/routing, and provider quota charts remain pending. No buttons pretending those operations are implemented were added.
