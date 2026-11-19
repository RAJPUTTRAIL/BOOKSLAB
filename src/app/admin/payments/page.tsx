import { getPaymentSettings } from "@/lib/store-settings";
import { PaymentSettingsForm } from "./form";

export const metadata = { title: "Payment settings" };
export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  return <PaymentSettingsForm initial={await getPaymentSettings()} />;
}
