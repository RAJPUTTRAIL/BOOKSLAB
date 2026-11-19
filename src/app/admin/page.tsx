import Link from "next/link";
import { CategoryBars, RevenueChart } from "@/components/admin/charts";
import { BookCover } from "@/components/book-cover";
import { connectDB } from "@/lib/mongo";
import { ActivitySession, Book, Order, SearchEvent, User, type BookDoc, type OrderDoc } from "@/lib/models";
import { filterLabel, isFilterKey } from "@/lib/categories";
import { formatDateTime, formatINR, istDay } from "@/lib/utils";

export const metadata = { title: "Overview" };

function Stat({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="card rounded-4 h-100">
        <div className="card-body">
          <div className="small text-muted"><i className={`bi ${icon} me-1`} />{label}</div>
          <div className="fs-3 fw-semibold tabular mt-1">{value}</div>
          {sub && <div className="small text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default async function AdminOverview() {
  const since = new Date(Date.now() - 14 * 86400_000);
  await connectDB();
  const [orders, users, sessionAgg, searches, lowStock, cancelled, waiting] = await Promise.all([
    Order.find({ createdAt: { $gte: since }, status: { $ne: "Cancelled" } }).select("totalAmount createdAt deliveryType").lean<OrderDoc[]>(),
    User.countDocuments({ role: "customer" }),
    ActivitySession.aggregate<{ avg: number; count: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, avg: { $avg: "$seconds" }, count: { $sum: 1 } } }]),
    SearchEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    Book.find({ stock: { $lt: 40 }, format: { $in: ["Paperback", "Hardcover"] } }).select("title stock coverImage").sort({ stock: 1 }).limit(6).lean<BookDoc[]>(),
    Order.find({ status: "Cancelled", cancelledAt: { $gte: since } }).sort({ cancelledAt: -1 }).select("orderNumber cancellationReason cancelledAt cancelledBy totalAmount").lean<OrderDoc[]>(),
    Order.countDocuments({ status: "Placed" }),
  ]);
  const session = sessionAgg[0] ?? { avg: 0, count: 0 };

  const days = Array.from({ length: 14 }, (_, i) => istDay(new Date(Date.now() - (13 - i) * 86400_000)));
  const revenueByDay = days.map((day) => {
    const os = orders.filter((o) => istDay((o as unknown as { createdAt: Date }).createdAt) === day);
    return { day: new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: os.reduce((s, o) => s + o.totalAmount, 0), orders: os.length };
  });
  const revenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const pickup = orders.filter((o) => o.deliveryType === "CP Store Pickup").length;
  const pickupPct = orders.length ? Math.round((pickup / orders.length) * 100) : 0;
  const avgSec = Math.round(session.avg ?? 0);
  const catData = searches
    .map((s) => ({ label: isFilterKey(s._id) ? filterLabel(s._id) : s._id, count: s.count }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div><div className="eyebrow">Last 14 days</div><h1 className="h3 mb-0">Overview</h1></div>
        <Link href="/admin/catalog?new=1" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />Add a book</Link>
      </div>
      <div className="row g-3 mb-4">
        <Stat icon="bi-currency-rupee" label="Revenue" value={formatINR(revenue)} sub={`${orders.length} orders`} />
        <Stat icon="bi-stopwatch" label="Avg. session time" value={`${Math.floor(avgSec / 60)}m ${avgSec % 60}s`} sub={`${session.count} sessions`} />
        <Stat icon="bi-people" label="Customers" value={String(users)} sub={`${pickupPct}% of orders collected at CP`} />
        <Stat icon="bi-x-circle" label="Cancelled" value={String(cancelled.length)} sub={`${cancelled.filter((o) => o.cancelledBy === "customer").length} by customers · ${waiting} new orders to confirm`} />
      </div>
      <div className="row g-4">
        <div className="col-xl-8">
          <div className="card rounded-4 h-100"><div className="card-body">
            <h2 className="h6">Daily revenue</h2>
            <p className="small text-muted">Excludes cancelled orders</p>
            <RevenueChart data={revenueByDay} />
          </div></div>
        </div>
        <div className="col-xl-4">
          <div className="card rounded-4 h-100"><div className="card-body">
            <h2 className="h6 mb-3">Low stock</h2>
            {lowStock.length === 0 ? <p className="small text-muted">Everything is well stocked.</p> : (
              <ul className="list-unstyled mb-3">
                {lowStock.map((b) => (
                  <li key={String(b._id)} className="d-flex align-items-center gap-2 py-2 border-bottom">
                    <div style={{ width: 28 }}><BookCover src={b.coverImage} title={b.title} /></div>
                    <span className="small flex-grow-1 text-truncate">{b.title}</span>
                    <span className="badge text-bg-warning tabular">{b.stock}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/catalog" className="small">Manage inventory <i className="bi bi-arrow-right" /></Link>
          </div></div>
        </div>
        <div className="col-xl-6">
          <div className="card rounded-4 h-100"><div className="card-body">
            <h2 className="h6">Most-searched categories</h2>
            <p className="small text-muted">From search and category tabs</p>
            <CategoryBars data={catData} />
          </div></div>
        </div>
        <div className="col-xl-6">
          <div className="card rounded-4 h-100"><div className="card-body">
            <h2 className="h6 mb-3">Pickup vs. delivery</h2>
            <div className="progress-stacked mb-2" style={{ height: 12 }}>
              <div className="progress" role="progressbar" aria-label="CP Store Pickup" aria-valuenow={pickupPct} aria-valuemin={0} aria-valuemax={100} style={{ width: `${pickupPct}%` }}><div className="progress-bar" style={{ background: "#1B365D" }} /></div>
              <div className="progress" role="progressbar" aria-label="Home Delivery" aria-valuenow={100 - pickupPct} aria-valuemin={0} aria-valuemax={100} style={{ width: `${100 - pickupPct}%` }}><div className="progress-bar" style={{ background: "#B9C7D8" }} /></div>
            </div>
            <div className="d-flex justify-content-between small text-muted mb-4"><span>CP Store Pickup {pickupPct}%</span><span>Home Delivery {100 - pickupPct}%</span></div>
            <div className="list-group list-group-flush small">
              <Link href="/admin/orders?status=Placed" className="list-group-item list-group-item-action px-0"><i className="bi bi-hourglass-split me-2" />{waiting} new orders waiting to be confirmed</Link>
              <Link href="/admin/cms" className="list-group-item list-group-item-action px-0"><i className="bi bi-stars me-2" />Change the homepage showcase</Link>
              <Link href="/admin/users" className="list-group-item list-group-item-action px-0"><i className="bi bi-shield-lock me-2" />Review sign-in activity</Link>
            </div>
          </div></div>
        </div>
        <div className="col-12">
          <div className="card rounded-4"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h6 mb-0">Recent cancellations</h2>
              <Link href="/admin/orders?status=Cancelled" className="small">All cancelled orders <i className="bi bi-arrow-right" /></Link>
            </div>
            {cancelled.length === 0 ? <p className="small text-muted mb-0">No cancellations in the last 14 days.</p> : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead><tr><th>Order</th><th>Reason</th><th>By</th><th>When</th><th className="text-end">Value</th></tr></thead>
                  <tbody>
                    {cancelled.slice(0, 6).map((o) => (
                      <tr key={String(o._id)}>
                        <td className="font-mono small">{o.orderNumber}</td>
                        <td className="small">{o.cancellationReason ?? "—"}</td>
                        <td><span className="badge text-bg-light border text-capitalize">{o.cancelledBy ?? "—"}</span></td>
                        <td className="small text-muted">{o.cancelledAt ? formatDateTime(o.cancelledAt) : "—"}</td>
                        <td className="text-end tabular small">{formatINR(o.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div></div>
        </div>
      </div>
    </>
  );
}
