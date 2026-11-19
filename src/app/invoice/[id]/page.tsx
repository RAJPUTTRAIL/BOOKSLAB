import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/mongo";
import { Order, User, isId, type OrderDoc, type UserDoc } from "@/lib/models";
import { orderDTO } from "@/lib/orders";
import { methodLabel } from "@/lib/payment-display";
import { STORE } from "@/lib/store-info";
import { formatDateTime, formatINR } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?next=/invoice/${id}`);
  if (!isId(id)) notFound();
  await connectDB();
  const doc = await Order.findById(id).lean<OrderDoc>();
  if (!doc || (String(doc.userId) !== user.id && user.role !== "admin")) notFound();
  const order = orderDTO(doc);
  const customer = await User.findById(doc.userId).select("name email phone").lean<UserDoc>();

  const rows = order.items.map((it) => {
    const digital = it.format === "E-book" || it.format === "Subscription";
    const gross = it.price * it.quantity;
    const taxable = digital ? Math.round((gross / 1.18) * 100) / 100 : gross;
    return { ...it, gross, hsn: digital ? "998431" : "4901", rate: digital ? 18 : 0, tax: Math.round((gross - taxable) * 100) / 100 };
  });
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);
  const interState = order.shippingAddress.pincode ? !order.shippingAddress.pincode.startsWith("110") : false;

  return (
    <div className="bg-soft min-vh-100 py-4">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="d-flex justify-content-between align-items-center mb-3 no-print">
          <Link href={user.role === "admin" ? "/admin/orders" : "/my-orders"} className="small link-secondary"><i className="bi bi-arrow-left me-1" />Back</Link>
          <PrintButton />
        </div>
        <article className="card rounded-4 border-0 shadow-sm">
          <div className="card-body p-4 p-md-5">
            <header className="d-flex flex-wrap justify-content-between gap-4 pb-4 border-bottom">
              <div>
                <div className="wordmark fs-3">Bookslab</div>
                <div className="small text-muted">Bookslab Publishing LLP<br />{STORE.address}<br />GSTIN: {STORE.gstin} · {STORE.email}</div>
              </div>
              <div className="text-md-end">
                <div className="eyebrow">Tax invoice</div>
                <div className="font-mono fs-5 fw-semibold">{order.orderNumber}</div>
                <div className="small text-muted">{formatDateTime(order.createdAt)}</div>
                <span className="badge text-bg-light border mt-1">{order.status}</span>
                <div className="small mt-2">
                  <span className="text-muted">Payment:</span> {methodLabel(order.payment)} · <strong>{order.payment.status === "Pending" ? (order.status === "Cancelled" ? "Not charged" : order.payment.method === "PAY_AT_STORE" ? "Due at pickup" : "Due on delivery") : order.payment.status}</strong>
                  {order.payment.transactionId && <div className="font-mono text-muted">{order.payment.transactionId}</div>}
                </div>
              </div>
            </header>
            <section className="row g-4 py-4 small">
              <div className="col-sm-6">
                <div className="eyebrow mb-1">Billed to</div>
                <div className="fw-semibold">{customer?.name}</div>
                <div>{customer?.email ?? customer?.phone}</div>
                <div>{order.shippingAddress.phone}</div>
              </div>
              <div className="col-sm-6">
                <div className="eyebrow mb-1">{order.deliveryType}</div>
                <div>{order.shippingAddress.line}</div>
                {order.shippingAddress.pincode && <div className="font-mono">PIN {order.shippingAddress.pincode}</div>}
                <div className="text-muted">Place of supply: {interState ? "Outside Delhi (IGST)" : "Delhi (CGST + SGST)"}</div>
              </div>
            </section>
            <div className="table-responsive">
              <table className="table small align-top">
                <thead><tr><th>Item</th><th>HSN/SAC</th><th className="text-end">Qty</th><th className="text-end">Rate</th><th className="text-end">GST</th><th className="text-end">Amount</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td><div className="fw-semibold">{r.title}</div><div className="text-muted font-mono">ISBN {r.isbn}</div></td>
                      <td className="font-mono">{r.hsn}</td>
                      <td className="text-end tabular">{r.quantity}</td>
                      <td className="text-end tabular">{formatINR(r.price)}</td>
                      <td className="text-end">{r.rate ? `${r.rate}% incl.` : "Exempt"}</td>
                      <td className="text-end tabular">{formatINR(r.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="row small ms-auto mb-0" style={{ maxWidth: 340 }}>
              <dt className="col-7 fw-normal">Subtotal</dt><dd className="col-5 text-end tabular">{formatINR(order.subtotal)}</dd>
              {order.bundleDiscount > 0 && <><dt className="col-7 fw-normal">Kit savings</dt><dd className="col-5 text-end tabular">−{formatINR(order.bundleDiscount)}</dd></>}
              <dt className="col-7 fw-normal">Delivery</dt><dd className="col-5 text-end tabular">{order.deliveryFee ? formatINR(order.deliveryFee) : "Free"}</dd>
              {order.codFee > 0 && <><dt className="col-7 fw-normal">COD handling fee</dt><dd className="col-5 text-end tabular">{formatINR(order.codFee)}</dd></>}
              {totalTax > 0 && <><dt className="col-7 fw-normal text-muted">{interState ? "IGST" : "CGST + SGST"} included</dt><dd className="col-5 text-end text-muted tabular">₹{totalTax.toFixed(2)}</dd></>}
              <dt className="col-7 fs-6 border-top pt-2">Total</dt><dd className="col-5 text-end fs-6 fw-semibold border-top pt-2 tabular">{formatINR(order.totalAmount)}</dd>
            </dl>
            <p className="small text-muted border-top pt-3 mt-4 mb-0">Printed books (HSN 4901) are exempt from GST. Digital products (SAC 998431) carry 18% GST, included in the price. This is a computer-generated invoice and needs no signature.</p>
          </div>
        </article>
      </div>
    </div>
  );
}
