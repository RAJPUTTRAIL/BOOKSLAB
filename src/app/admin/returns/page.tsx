import { connectDB } from "@/lib/mongo";
import { Order, User, type OrderDoc, type UserDoc } from "@/lib/models";
import { orderDTO } from "@/lib/orders";
import { ReturnsQueue, type AdminReturn } from "./queue";

export const metadata = { title: "Returns & Replacements" };
export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  await connectDB();
  const rows = await Order.find({ returnRequest: { $ne: null } }).sort({ "returnRequest.requestedAt": -1 }).limit(500).lean<OrderDoc[]>();
  const users = await User.find({ _id: { $in: [...new Set(rows.map((o) => String(o.userId)))] } }).select("name email phone").lean<UserDoc[]>();
  const list: AdminReturn[] = rows.map((o) => {
    const u = users.find((x) => String(x._id) === String(o.userId));
    return { ...orderDTO(o), customer: u?.name ?? "Deleted user", contact: o.shippingAddress?.phone || u?.phone || u?.email || "" };
  });
  return <ReturnsQueue initial={list} />;
}
