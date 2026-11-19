import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/mongo";
import { Book, BookRequest, Order, type BookDoc, type BookRequestDoc, type OrderDoc } from "@/lib/models";
import { bookRequestDTO } from "@/lib/book-requests";
import { orderDTO } from "@/lib/orders";
import { MyOrders } from "./orders-list";

export const metadata = { title: "My Orders" };
export const dynamic = "force-dynamic";

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/my-orders");
  await connectDB();
  const orders = (await Order.find({ userId: user.id }).sort({ createdAt: -1 }).lean<OrderDoc[]>()).map(orderDTO);
  // Covers for the order cards (books deleted from the catalog simply show the placeholder).
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => i.bookId).filter((x): x is string => !!x)))];
  const books = await Book.find({ _id: { $in: ids } }).select("coverImage slug").lean<BookDoc[]>();
  const covers = Object.fromEntries(books.map((b) => [String(b._id), { cover: b.coverImage ?? "", slug: b.slug }]));
  const requests = (await BookRequest.find({ userId: user.id }).sort({ createdAt: -1 }).limit(100).lean<BookRequestDoc[]>()).map(bookRequestDTO);
  const { tab } = await searchParams;
  return <MyOrders initial={orders} covers={covers} firstName={user.name.split(" ")[0]} requests={requests} initialTab={tab === "requests" ? "requests" : "orders"} />;
}
