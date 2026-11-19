import { connectDB } from "@/lib/mongo";
import { Order, User, type OrderDoc, type UserDoc } from "@/lib/models";
import { orderDTO } from "@/lib/orders";
import { OrdersBoard, type AdminOrder } from "./board";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  await connectDB();
  const rows = await Order.find().sort({ createdAt: -1 }).limit(2000).lean<OrderDoc[]>();
  const users = await User.find({ _id: { $in: [...new Set(rows.map((o) => String(o.userId)))] } }).select("name email phone").lean<UserDoc[]>();
  const orders: AdminOrder[] = rows.map((o) => {
    const u = users.find((x) => String(x._id) === String(o.userId));
    return { ...orderDTO(o), customer: u?.name ?? "Deleted user", contact: u?.email ?? u?.phone ?? "" };
  });
  return <OrdersBoard initial={orders} initialStatus={status ?? "All"} />;
}
