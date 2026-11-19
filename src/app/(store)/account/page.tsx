import Link from "next/link";
import { redirect } from "next/navigation";
import { BookCard } from "@/components/book-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getBooksByIds } from "@/lib/catalog";
import { connectDB } from "@/lib/mongo";
import { Order, type OrderDoc } from "@/lib/models";
import { orderDTO } from "@/lib/orders";
import { STATUS_BADGE } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Your account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/account");
  const { denied } = await searchParams;
  await connectDB();
  const [orders, reading] = await Promise.all([
    Order.find({ userId: user.id }).sort({ createdAt: -1 }).limit(3).lean<OrderDoc[]>().then((r) => r.map(orderDTO)),
    getBooksByIds((user.readingList ?? []).map(String).reverse()),
  ]);
  const memberSince = (user as unknown as { createdAt: Date }).createdAt;

  return (
    <div className="container py-5">
      {denied === "admin" && <div className="alert alert-warning small">The admin dashboard is only available to Bookslab staff accounts.</div>}
      <div className="eyebrow mb-1">Your account</div>
      <h1 className="h3 mb-1">Hello, {user.name.split(" ")[0]}</h1>
      <p className="text-muted">{user.email ?? user.phone} · Member since {memberSince.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>

      <div className="row g-4 mt-1">
        <div className="col-lg-8">
          <div className="card rounded-4 h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h5 mb-0">Recent orders</h2>
                <Link href="/my-orders" className="btn btn-light border btn-sm">All orders</Link>
              </div>
              {orders.length === 0 ? (
                <p className="text-muted mb-0">No orders yet. <Link href="/search">Find your first book</Link>.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {orders.map((o) => (
                    <li key={o.id} className="list-group-item px-0 d-flex flex-wrap gap-2 align-items-center">
                      <div className="flex-grow-1 min-w-0">
                        <div className="font-mono small fw-semibold">{o.orderNumber}</div>
                        <div className="small text-muted text-truncate">{o.items.map((i) => i.title).join(", ")}</div>
                        <div className="small text-muted">{formatDateTime(o.createdAt)}</div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[o.status] ?? "text-bg-light"}`}>{o.status}</span>
                      <span className="tabular small fw-semibold" style={{ minWidth: 72, textAlign: "right" }}>{formatINR(o.totalAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card rounded-4 h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h5 mb-0">Account details</h2>
                <Link href="/profile" className="btn btn-light border btn-sm">Edit</Link>
              </div>
              <dl className="small mb-0">
                <dt className="fw-normal text-muted">Name</dt><dd>{user.name}</dd>
                {user.email && <><dt className="fw-normal text-muted">Email</dt><dd>{user.email}</dd></>}
                {user.phone && <><dt className="fw-normal text-muted">Mobile</dt><dd className="font-mono">{user.phone}</dd></>}
{(() => {
                  const list = user.addresses ?? [];
                  const d = list.find((a) => a.isDefault) ?? list[0];
                  return d ? <><dt className="fw-normal text-muted">Default delivery address ({list.length} saved)</dt><dd>{d.label} — {d.street}, {d.city} {d.pincode}</dd></> : null;
                })()}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {reading.length > 0 && (
        <section className="mt-5">
          <h2 className="h4 mb-4">Your reading list</h2>
          <div className="row row-cols-2 row-cols-md-4 g-4">{reading.map((b) => <div className="col" key={b.id}><BookCard book={b} /></div>)}</div>
        </section>
      )}
    </div>
  );
}
