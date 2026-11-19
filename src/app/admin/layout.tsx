import { redirect } from "next/navigation";
import { Wordmark } from "@/components/header";
import { AdminNav } from "@/components/admin/admin-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/mongo";
import { BookRequest, Order } from "@/lib/models";

export const metadata = { title: { default: "Admin", template: "%s · Bookslab Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/auth?next=/admin");
  if (user.role !== "admin") redirect("/account?denied=admin");
  const [returnsPending, requestsNew] = await connectDB()
    .then(() => Promise.all([Order.countDocuments({ "returnRequest.status": "Requested" }), BookRequest.countDocuments({ status: "New" })]))
    .catch(() => [0, 0]);
  return (
    <div className="container-fluid">
      <div className="row">
        <aside className="col-lg-3 col-xl-2 bg-white border-end p-3 p-lg-4" style={{ minHeight: "100vh" }}>
          <div className="position-lg-sticky" style={{ top: 24 }}>
            <div className="d-flex align-items-center justify-content-between mb-lg-4">
              <Wordmark />
              <span className="badge text-bg-light border d-lg-none">Admin</span>
            </div>
            <div className="mt-3 mt-lg-0"><AdminNav returnsPending={returnsPending} requestsNew={requestsNew} /></div>
            <div className="small text-muted border-top pt-3 mt-4 d-none d-lg-block">
              Signed in as<br /><strong className="text-body">{user.name}</strong><br />{user.email ?? user.phone}
            </div>
          </div>
        </aside>
        <main className="col-lg-9 col-xl-10 p-3 p-md-4 p-xl-5">{children}</main>
      </div>
    </div>
  );
}
