"use client";

import { useMemo, useState } from "react";
import { useApi, useApp } from "@/components/providers";
import { cn, formatDateTime } from "@/lib/utils";

type U = { id: string; name: string; identifier: string; role: string; orders: number; createdAt: string };
type Log = { id: string; event: string; identifier: string | null; detail: string | null; ip: string | null; createdAt: string };
const FAILED = ["LOGIN_FAILED"];

export function UsersPanel({ users: initial, logs, selfId }: { users: U[]; logs: Log[]; selfId: string }) {
  const api = useApi();
  const { toast } = useApp();
  const [users, setUsers] = useState(initial);
  const [tab, setTab] = useState<"users" | "logs">("users");
  const [q, setQ] = useState("");
  const [event, setEvent] = useState("All");
  const events = useMemo(() => ["All", ...new Set(logs.map((l) => l.event))], [logs]);
  const failed24 = logs.filter((l) => FAILED.includes(l.event) && Date.now() - new Date(l.createdAt).getTime() < 86400_000).length;

  const patch = async (u: U, body: { role: string }) => {
    try {
      const d = await api<{ user: { role: string } }>(`/api/admin/users/${u.id}`, body, "PATCH");
      setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, role: d.user.role } : x)));
      toast({ kind: "success", title: `${u.name} is now ${d.user.role}` });
    } catch (e) {
      toast({ kind: "danger", title: (e as Error).message });
    }
  };

  return (
    <>
      <div className="mb-4"><div className="eyebrow">{users.length} accounts</div><h1 className="h3 mb-0">Users & sign-ins</h1></div>
      <div className="row g-3 mb-4">
        {[["bi-people", "Customers", String(users.filter((u) => u.role === "customer").length)], ["bi-person-plus", "Joined (30 days)", String(users.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 30 * 86400_000).length)], ["bi-person-gear", "Admins", String(users.filter((u) => u.role === "admin").length)], ["bi-exclamation-triangle", "Failed attempts (24h)", String(failed24)]].map(([icon, label, value]) => (
          <div className="col-6 col-xl-3" key={label}><div className="card rounded-4 h-100"><div className="card-body"><div className="small text-muted"><i className={`bi ${icon} me-1`} />{label}</div><div className="fs-4 fw-semibold tabular">{value}</div></div></div></div>
        ))}
      </div>
      <ul className="nav nav-pills pill-tabs gap-1 mb-3">
        <li className="nav-item"><button type="button" className={cn("nav-link", tab === "users" && "active")} onClick={() => setTab("users")}>Customers & roles</button></li>
        <li className="nav-item"><button type="button" className={cn("nav-link", tab === "logs" && "active")} onClick={() => setTab("logs")}>Sign-in log</button></li>
      </ul>
      {tab === "users" ? (
        <div className="card rounded-4">
          <div className="card-body border-bottom"><input className="form-control" placeholder="Search by name, email or mobile" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" style={{ maxWidth: 420 }} /></div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>User</th><th className="text-end">Orders</th><th>Joined</th><th>Role</th></tr></thead>
              <tbody>
                {users.filter((u) => !q || `${u.name} ${u.identifier}`.toLowerCase().includes(q.toLowerCase())).map((u) => (
                  <tr key={u.id}>
                    <td><div className="fw-semibold small">{u.name}{u.id === selfId && <span className="text-muted fw-normal"> (you)</span>}</div><div className="small text-muted">{u.identifier}</div></td>
                    <td className="text-end tabular">{u.orders}</td>
                    <td className="small text-muted">{formatDateTime(u.createdAt)}</td>
                    <td>
                      <select className="form-select form-select-sm" style={{ width: 120 }} value={u.role} disabled={u.id === selfId} onChange={(e) => patch(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}>
                        <option value="customer">Customer</option><option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card rounded-4">
          <div className="card-body border-bottom">
            <select className="form-select" style={{ maxWidth: 280 }} value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Filter by event">{events.map((e) => <option key={e}>{e}</option>)}</select>
          </div>
          <div className="table-responsive">
            <table className="table align-middle small mb-0">
              <thead><tr><th>Time (IST)</th><th>Event</th><th>Account</th><th>Detail</th><th>IP</th></tr></thead>
              <tbody>
                {logs.filter((l) => event === "All" || l.event === event).map((l) => (
                  <tr key={l.id}>
                    <td className="text-muted text-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td><span className={cn("badge font-mono", FAILED.includes(l.event) ? "text-bg-danger" : "text-bg-light border")}>{l.event}</span></td>
                    <td>{l.identifier ?? "—"}</td>
                    <td className="text-muted">{l.detail}</td>
                    <td className="font-mono text-muted">{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
