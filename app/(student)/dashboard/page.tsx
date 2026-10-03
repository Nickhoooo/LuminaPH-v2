import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardContent from "./_components/DashboardContent";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view: requestedView } = await searchParams;

  if (requestedView === "library") {
    redirect("/library");
  }
  if (requestedView === "groups") {
    redirect("/study-tools/study-groups");
  }
  const view = requestedView === "learning" ? "learning" : "home";
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Read the authenticated account on the server; only pass display data to the UI.
  const metadataName =
    user.user_metadata?.full_name ?? user.user_metadata?.name;
  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split("@")[0] || "Learner";

  return <DashboardContent view={view} displayName={displayName} />;
}
