import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { profileOf } from "@/lib/auth/public-user";
import { listAddresses } from "@/lib/addresses";
import { emailChangeState } from "@/lib/auth/email-change";
import { ProfileSettings } from "./settings";

export const metadata = { title: "My Profile & Addresses" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/profile");
  return <ProfileSettings initial={profileOf(user)} initialAddresses={await listAddresses(user.id)} initialEmailChange={emailChangeState(user)} />;
}
