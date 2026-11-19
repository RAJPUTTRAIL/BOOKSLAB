import { STORE } from "./store-info";

export type Eta = {
  ok: boolean;
  zone: string;
  label: string; // "Today by 7 PM"
  detail: string;
  express: boolean;
  hours: number; // approx hours until delivery
};

function istNow() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist;
}

function fmt(d: Date) {
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600_000);
}

function nextDayAt(d: Date, hour: number, days = 1) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  x.setHours(hour, 0, 0, 0);
  return x;
}

/** Delhi NCR delivery estimator. Pure function — usable on client and server. */
export function estimateDelivery(pincodeRaw: string, now: Date = istNow()): Eta {
  const pin = pincodeRaw.replace(/\D/g, "");
  if (pin.length !== 6) return { ok: false, zone: "—", label: "Enter a valid 6-digit pincode", detail: "", express: false, hours: 0 };
  const h = now.getHours();
  const p3 = pin.slice(0, 3);
  const n = Number(pin);

  // CP & central Delhi — 2-hour express
  if (pin === STORE.pincode || (n >= 110001 && n <= 110003)) {
    const cutoff = h < 18;
    const when = cutoff ? addHours(now, 2) : nextDayAt(now, 12);
    return { ok: true, zone: "CP Express Zone", label: cutoff ? "In ~2 hours" : `Tomorrow by noon`, detail: `Bike courier from our Inner Circle store • ${fmt(when)}`, express: true, hours: cutoff ? 2 : 24 - h + 12 };
  }
  // Delhi (1100xx-1100xx)
  if (p3 === "110") {
    const sameDay = h < 14;
    const when = sameDay ? new Date(new Date(now).setHours(20, 0, 0, 0)) : nextDayAt(now, 20);
    return { ok: true, zone: "Delhi", label: sameDay ? "Today by 8 PM" : "Tomorrow by 8 PM", detail: `Order before 2 PM for same-day • ${fmt(when)}`, express: sameDay, hours: Math.max(1, (when.getTime() - now.getTime()) / 3600_000) };
  }
  // NCR satellite cities
  const ncr: Record<string, string> = { "201": "Noida / Ghaziabad", "122": "Gurugram", "121": "Faridabad", "124": "Jhajjar / Bahadurgarh", "131": "Sonipat" };
  if (ncr[p3]) {
    const when = nextDayAt(now, h < 16 ? 19 : 21, 1);
    return { ok: true, zone: ncr[p3], label: "Tomorrow", detail: `NCR next-day route • ${fmt(when)}`, express: false, hours: (when.getTime() - now.getTime()) / 3600_000 };
  }
  // Rest of India
  const when = nextDayAt(now, 19, p3.startsWith("1") || p3.startsWith("2") || p3.startsWith("3") ? 3 : 5);
  return { ok: true, zone: "Pan-India", label: `By ${when.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}`, detail: "Shipped from CP via surface/air partners", express: false, hours: (when.getTime() - now.getTime()) / 3600_000 };
}

export function pickupEta(now: Date = istNow()): Eta {
  const h = now.getHours();
  const open = h >= 10 && h < 19;
  const when = open ? addHours(now, 2) : nextDayAt(now, 12, h >= 19 ? 1 : 0);
  return { ok: true, zone: "CP Store Pickup", label: open ? "Ready in 2 hours" : `Ready ${fmt(when)}`, detail: `${STORE.address} • ${STORE.hours}`, express: true, hours: open ? 2 : 12 };
}
