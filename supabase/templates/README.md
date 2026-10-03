# Supabase recovery email setup

These files are reviewed source copies. Saving them locally does not update the hosted Supabase project.

In the lumina-ph-v2-dev dashboard:

1. Open Authentication > Email Templates (or Email > Templates) > Reset password.
2. Set the subject to: Reset your Lumina PH password
3. Paste the complete contents of recovery.html into the email body and save.
4. Under Authentication > URL Configuration, verify Site URL is http://localhost:3000 for local development. Use your actual port if different. Use the deployed HTTPS site URL before launch.

Keep the Confirm sign up template separate: it uses type=email. Recovery uses type=recovery.

The action uses resetPasswordForEmail(email) and the custom template uses SiteURL directly. It does not accept a redirect destination from a submitted form.

## Manual verification

Use your own test account. With default Supabase SMTP, use a project organization member's email and respect its email limits.

1. Log out, open the login modal, choose Forgot password, and submit the account email once.
2. Open the newest recovery email on the computer running the local website.
3. Confirm the link reaches /reset-password with the new-password form.
4. Try mismatched passwords; expect an error without changing the password.
5. Submit a matching new password of at least eight characters.
6. Expect the login modal. Verify the new password works and the old one fails.
7. In a fresh logged-out window, opening /reset-password directly must not show the password form.
8. Expired, invalid, or reused recovery links must show a recovery message with a new-link action.

Do not share passwords or full recovery URLs in screenshots/logs. No actual emails or password changes are performed by the isolated code checks.

The update action checks the authenticated user again even if the page already checked. A valid existing authenticated session can also access this page; the query string alone never grants access.

Successful password updates are followed by local sign-out. If sign-out fails after the update, the UI reports that the password was already changed and offers a logout retry.
