import { redirect } from "next/navigation";

// Keep existing auth redirects and bookmarked URLs working with the modal.
export default function LoginPage() {
  redirect("/?auth=login");
}
