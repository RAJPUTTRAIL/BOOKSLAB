import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken, type SessionPayload } from "@/lib/auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifyToken<SessionPayload>(req.cookies.get(SESSION_COOKIE)?.value, "session");

  const needsAuth = ["/account", "/profile", "/my-orders", "/admin", "/invoice"].some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (needsAuth && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    url.search = "?denied=admin";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/api/admin") && session?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: session ? 403 : 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/account/:path*", "/profile/:path*", "/my-orders/:path*", "/admin/:path*", "/invoice/:path*", "/api/admin/:path*"] };
