import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readStudyPreferences } from "@/lib/study-preferences";
import { getProfileImages } from "@/lib/profile-images";
import ProfileForm from "./ProfileForm";
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const images = await getProfileImages(user.id);
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const profile = {
    ...readStudyPreferences(user.user_metadata ?? {}),
    full_name:
      typeof name === "string"
        ? name.slice(0, 80)
        : user.email?.split("@")[0].slice(0, 80) || "Learner",
  };
  return (
    <section className="w-full min-w-0 space-y-6 py-4">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-stone-500 dark:text-stone-400">
          Your study space
        </p>
        <h1 className="mt-2 text-2xl font-semibold">My profile</h1>
      </header>
      {images.unavailable && (
        <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">
          Profile photos could not be loaded. Apply the photo migration if
          needed, then refresh.
        </p>
      )}
      <ProfileForm
        profile={profile}
        email={user.email ?? ""}
        avatarUrl={images.avatarUrl}
        coverUrl={images.coverUrl}
      />
    </section>
  );
}
