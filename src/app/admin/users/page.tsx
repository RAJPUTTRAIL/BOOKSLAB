import { connectDB } from "@/lib/mongo";
import { Order, SecurityLog, User, type UserDoc } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { UsersPanel } from "./panel";

export const metadata = { title: "Users & security" };
export const dynamic = "force-dynamic";

type LogRow = { _id: unknown; event: string; identifier: string | null; detail: string | null; ip: string | null; createdAt: Date };

export default async function UsersPage() {
  await connectDB();
  const [session, users, logs, orderCounts] = await Promise.all([
    getSession(),
    User.find().select("name email phone role createdAt").sort({ createdAt: -1 }).lean<(UserDoc & { createdAt: Date })[]>(),
    SecurityLog.find().sort({ createdAt: -1 }).limit(100).lean<LogRow[]>(),
    Order.aggregate<{ _id: unknown; count: number }>([{ $group: { _id: "$userId", count: { $sum: 1 } } }]),
  ]);
  return (
    <UsersPanel
      selfId={session?.sub ?? ""}
      users={users.map((u) => ({
        id: String(u._id), name: u.name, identifier: u.email ?? u.phone ?? "", role: u.role ?? "customer", orders: orderCounts.find((c) => String(c._id) === String(u._id))?.count ?? 0, createdAt: u.createdAt.toISOString(),
      }))}
      logs={logs.map((l) => ({ id: String(l._id), event: l.event, identifier: l.identifier, detail: l.detail, ip: l.ip, createdAt: l.createdAt.toISOString() }))}
    />
  );
}
