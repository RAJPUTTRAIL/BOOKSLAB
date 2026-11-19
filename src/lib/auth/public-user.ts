import type { AppUser } from "./session";

/** The safe subset of a user returned to the browser after sign-up / sign-in. */
export const publicUser = (u: AppUser) => ({
  id: u.id, name: u.name, identifier: u.email ?? u.phone ?? "", role: u.role === "admin" ? ("admin" as const) : ("customer" as const),
});

/** Personal details shown/edited on the profile page. */
export const profileOf = (u: AppUser) => ({ name: u.name, email: u.email ?? "", phone: u.phone ?? "" });
