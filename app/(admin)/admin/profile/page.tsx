import { requireAdmin } from "@/lib/require-admin";
import { readStudyPreferences } from "@/lib/study-preferences";
import { getProfileImages } from "@/lib/profile-images";
import ProfileForm from "@/app/(student)/profile/ProfileForm";

export default async function AdminProfilePage() {
  const { user } = await requireAdmin();
  const images = await getProfileImages(user.id);
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const profile = {
    ...readStudyPreferences(user.user_metadata ?? {}),
    full_name:
      typeof name === "string" && name.trim()
        ? name.trim().slice(0, 80)
        : "Administrator",
  };

  return (
    <section className="w-full min-w-0 space-y-6 py-4">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-stone-500 dark:text-stone-400">
          Admin account
        </p>
        <h1 className="mt-2 text-2xl font-semibold">My profile</h1>
      </header>
      {images.unavailable && (
        <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">
          Profile photos could not be loaded. Refresh to try again.
        </p>
      )}
      {/* Reuse the account editor; the route keeps this inside the admin layout. */}
      <ProfileForm
        profile={profile}
        email={user.email ?? ""}
        avatarUrl={images.avatarUrl}
        coverUrl={images.coverUrl}
      />
    </section>
  );
}
