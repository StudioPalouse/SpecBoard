import { redirect } from "next/navigation";

/** Settings landing → the Profile sub-page. */
export default function SettingsPage() {
  redirect("/settings/profile");
}
