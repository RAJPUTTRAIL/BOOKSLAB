# Bookslab — Connaught Place, New Delhi

A bookstore and academic/professional publishing storefront for law, finance & tax, academic (CA / CS / CMA), tech and general titles.

**Stack:** Next.js 15 (App Router) · TypeScript · **Bootstrap 5.3 + Bootstrap Icons** · **MongoDB + Mongoose 8** · JWT session cookies (`jose`) with single-step email/mobile + password sign-in · Recharts in the admin panel.

## Quick start

You need Node 20 or later and MongoDB — either a local server (`mongodb://127.0.0.1:27017/bookslab`) or an Atlas cluster.

```bash
cp .env.example .env.local   # then set MONGODB_URI
npm install
npm run seed            # loads 36 books (with cover images), demo users and orders
npm run dev             # http://localhost:3000
```

To reseed at any time, run `npm run seed`, or with the dev server running: `curl -X POST http://localhost:3000/api/seed`.

| Account | Email | Password |
|---|---|---|
| Admin | `admin@bookslab.in` | `Admin@2026` |
| Customer | `riya@student.du.ac.in` | `Student@2026` (has a Placed and a Confirmed order you can cancel) |

## Environment (`.env.local`)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string including the database name, e.g. `mongodb://127.0.0.1:27017/bookslab` or `mongodb+srv://user:pass@cluster.mongodb.net/bookslab?retryWrites=true&w=majority`. Never commit it. On Atlas, allow your IP under **Network Access**. |
| `AUTH_SECRET` | 32+ random characters, used to sign session cookies |
| `RESET_CODE_PREVIEW` | `"true"` shows forgot-password codes in the sign-in modal and server console for local testing; set `"false"` in production |
| `RESEND_API_KEY` | Resend API key for transactional email (password-reset codes, order confirmations). Without it, emails are logged to the terminal. |
| `EMAIL_FROM` | Sender, default `Bookslab <onboarding@resend.dev>` — that sender only delivers to your own Resend account email; verify a domain at resend.com/domains to email customers. |
| `NEXT_PUBLIC_SITE_URL` | Base URL for links in emails (default `http://localhost:3000`) |
| `SEED_TOKEN` | Optional. Allows `POST /api/seed` in production with the header `x-seed-token` |

## Data model (Mongoose — `src/lib/models.ts`)

- **Book**: `title`, `author`, `isbn` (unique), `category` (`Law` · `Finance & Tax` · `Academic` · `Tech & Management` · `General`), `mrp`, `discountedPrice`, `stock`, `edition`, `description`, `coverImage`, `galleryImages[]`, `isFeatured`
  - Storefront extras: `slug`, `subtitle`, `publisher`, `subcategory`, `format`, `year`, `pages`, `rating`, `tags[]`, `samplePages[]`, `cpPickup`
- **User**: `name`, `email`, `phone`, `passwordHash` (bcrypt), `role` (`customer` | `admin`), `addresses[]` (`label` Home/Office/College/Other, `recipientName`, `phone`, `street`, `city`, `state`, `pincode`, `isDefault`), `resetPasswordToken` (bcrypt hash), `resetPasswordExpires`, `tokenVersion`, `readingList`, `createdAt`
  - `email` and `phone` are unique *when present* (partial indexes), so mobile-only and email-only accounts can coexist.
- **Order**: `orderNumber`, `userId`, `items` (`bookId`, `title`, `price`, `quantity`, plus ISBN/format snapshot), `totalAmount`, `deliveryType` (`CP Store Pickup` | `Home Delivery`), `shippingAddress`, `status`, `cancellationReason`, `cancelledAt`, `createdAt`
  - Extras: `cancelledBy` (`customer` | `admin`), subtotal, kit discount, delivery fee, ETA
- **Cart**: one document per user (`userId` unique) with `items` (`bookId`, `title`, `author`, `price`, `coverImage`, `quantity`, `kit`)
- **Supporting collections:** `Drop` (weekly offers), `SiteContent` (homepage CMS), `SecurityLog`, `SearchEvent`, `ActivitySession`

## Profile & password reset

- **My Profile & Addresses** (`/profile`, from the account menu): edit name, primary phone and email (`GET`/`PUT /api/user/profile`; email and phone are checked against other accounts → 409). The session cookie is re-issued so the header updates without signing in again.
- **Saved addresses** (`/api/user/addresses`: `GET`, `POST`; `/api/user/addresses/[id]`: `PUT` edit, `PATCH {isDefault:true}`, `DELETE`): up to 10 per customer. Exactly one is the default — set-default is a single atomic update that clears every other flag; the first address becomes default automatically and deleting the default promotes the next one.
- **Checkout:** with Home Delivery selected, saved addresses appear as radio cards with the default pre-selected, plus **Add new address** in place. The order sends only `addressId`; the server looks the address up in the customer's own list.
- **Change Password** (same page, `PUT /api/user/password`): needs the current password. Other devices are signed out; this one stays signed in.
- **Forgot Password?** (Sign In tab): `POST /api/auth/forgot-password` issues a 6-character code valid for 15 minutes (only its bcrypt hash is stored; 5 wrong tries void it; one request per 30 s). The reply is identical whether or not the account exists. `POST /api/auth/reset-password` checks the code, saves the new bcrypt hash, clears the reset fields and signs out existing sessions. Codes are emailed via Resend (`src/lib/email.ts`); phone-only accounts need an SMS provider added in `src/app/api/auth/forgot-password/route.ts`.

## Payments (UPI · COD · Pay at Store · Card)

- **Methods:** UPI (UPI ID or a dynamic QR for the exact amount — `upi://pay?pa=…&am=…`), Cash on Delivery (Home Delivery; optional admin-set handling fee), Pay at CP Store (pickup; pre-selected when pickup is chosen) and Debit/Credit Card. Digital-only orders are paid online.
- **Order fields:** `paymentMethod`, `paymentStatus` (`Pending` | `Paid` | `Failed` | `Refunded`), `upiId`, `transactionId` (e.g. `BSL-UPI-48213907`), `codFee`, plus `cardBrand`/`cardLast4`, `paidAt`, `refundId`, `refundedAt`.
- **Flow:** stock is reserved → the online payment is captured → the order is saved as `Paid`. A failed payment releases the stock and creates no order; if saving fails after capture, the payment is refunded. The server recomputes the total and refuses the order if it differs from what the customer saw.
- **Refunds:** cancelling a prepaid (UPI/Card) order — by the customer before dispatch or by staff — sets `paymentStatus: Refunded` and shows a 3–5 business-day refund notice on My Orders.
- **Admin → Orders & payments:** summary cards (Total Collected, Pending COD / Store Pickups, Refunded); Payment Method and Payment Status columns; **Mark as Paid** for COD / Pay-at-Store; **Edit** any order's payment status, method and transaction ID (logged in the sign-in/security log).
- **Admin → Payment settings** (`StoreSettings` singleton; `GET /api/settings/payments` is public, `PUT` is admin-only): store UPI ID and merchant name, optional uploaded bank QR image (`public/uploads/settings/`) or an auto-generated dynamic QR, on/off switches for UPI / COD / Pay at Store / Card, and the COD handling fee. Checkout reads these on load and the order API enforces them (disabled methods are refused, the fee is applied server-side). At least one method must stay on for Home Delivery and for Pickup.
- **Sandbox:** `PAYMENTS_MODE` (server) and `NEXT_PUBLIC_PAYMENTS_MODE` (client) default to `sandbox` — payments are simulated (`fail@upi` or a card ending `0002` simulates a decline). Card numbers and CVVs never leave the browser; only brand + last 4 are sent. To go live, implement `captureOnlinePayment` / `refundPayment` in `src/lib/payments.ts` with Razorpay or Cashfree, and set both variables to `live`. Set your real merchant UPI ID in **Admin → Payment settings** (the default `bookslab@icici` is a placeholder).

## Returns & replacements

- **Window:** a Delivered order with printed books can be returned or replaced for 7 days from `deliveredAt` (set when staff mark an order Delivered; older orders fall back to `updatedAt`/`createdAt`). After that My Orders shows "7-day return window closed". One request per order; e-books aren't returnable.
- **Customer** (`/my-orders` → **Return / Replace**): a three-step modal — Free Replacement or Return & Refund + which books/quantities → reason (Damaged / Torn Cover, Missing or Blank Pages, Wrong Book or Edition Delivered, Defective Binding, Other) + note → 1–3 proof photos (`/api/returns/upload`, saved to `public/uploads/returns/`). The order card then shows the request type, status badge and the admin's note; the page refreshes when the customer returns to the tab.
- **Stored on the order** as `returnRequest`: `requestType`, `items` (bookId, title, quantity, price), `reason`, `description`, `proofImages`, `status` (Requested → Approved → Pickup Scheduled → Completed, or Rejected), `adminNote`, `requestedAt`, `resolvedAt`, plus `history`, `refundAmount`, `resellable`.
- **Admin → Returns & Replacements** (sidebar badge = pending requests): review queue with photo lightbox; Approve / Schedule Pickup or CP Store Exchange / Mark Completed / Reject (a reason is required) with a note shown to the customer.
- **On completion:** a Replacement deducts the replacement copies from stock (refused if stock is short). A Return & Refund refunds the returned books' value and marks the order `Refunded` when it was paid, and returns the copies to stock only if marked resellable. Each effect happens once — status changes are conditional updates.

## "Can't find a book?" requests

- **Customer:** `/request-book` (linked in the header and footer) — book title, author/publisher, ISBN, edition, quantity, pickup vs delivery, notes, plus name / mobile / email (pre-filled when signed in). A search with no results offers **Request this book**, carrying the search text into the title. Signed-in customers follow their requests under **My Orders → My Book Requests** (status, quoted price, store reply).
- **Stored** in `BookRequest` (`src/lib/models.ts`): `userId` (when signed in), `customerName`, `phone`, `email`, `bookTitle`, `authorOrPublisher`, `isbn`, `editionOrYear`, `quantity`, `preferredFulfillment`, `notes`, `status` (New → Sourcing → Available at Store / Not Available → Fulfilled), `estimatedPrice`, `adminReply`, `createdAt`. `POST /api/book-requests` is public (honeypot field + max 5 requests per phone per hour); `GET` returns the signed-in customer's own requests.
- **Admin → Book Requests** (badge = New): newest first, one-click WhatsApp reply pre-filled with the title (and price once available), update modal for status / estimated price (required for "Available at Store") / reply, and **Convert to Store Catalog**, which opens Add Book pre-filled with title, author and ISBN.

## Carts are per account

- **Signed in:** the cart lives in MongoDB (`Cart` collection) and is read and written only through `/api/cart` (`GET`, `POST` add/set, `DELETE` one line or all), always for the user in the session cookie. It follows the customer across devices and is emptied when they place an order.
- **Guest:** the cart lives in this browser under `bookslab_guest_cart` (saved books under `bookslab_guest_saved`). On sign-in it is merged into the account once (`/api/cart/merge`) and the browser copy is deleted.
- **Sign-out:** the in-memory cart and saved list are emptied and every per-account browser key (guest cart, saved list, pincode, reader highlights, session id) is wiped, so the next person on the browser starts clean. Whenever the signed-in identity changes, the visible cart is cleared *before* the new account's cart is fetched.

## Orders & cancellation

- **Statuses:** `Placed` → `Confirmed` → `Ready at CP Store` (pickup) or `Out for Delivery` (home) → `Delivered`, or `Cancelled`.
- **Stock:** placing an order reserves stock with conditional updates (`stock >= qty`), so the last copy can't be sold twice; if any line fails, the lines already reserved are released. No multi-document transaction is needed, so this works on a standalone local `mongod` too.
- **Customers** cancel from **My Orders** (`/my-orders`) while an order is `Placed` or `Confirmed`, with an optional reason. The status change is a single conditional update, so a double click can't restock twice.
- **Staff** can cancel any order that isn't delivered yet from **Admin → Orders**, with a reason. Both paths record `cancelledAt`, `cancellationReason` and `cancelledBy`, and return the books to stock. Cancelled and delivered orders are locked.

## Book images

- **Uploading:** the admin's Add Book and Edit Book modals accept drag-and-drop or the file picker (JPG, PNG, WebP or AVIF, up to 5 MB), or an `https://` image URL.
- **Where files go:** uploads are checked by their file signature, renamed to random UUIDs, and saved to `public/uploads/books/`.
- **Serving:** Next.js only serves `public/` files that existed at build time. A fallback rewrite sends anything newer to `/api/uploads/books/[file]`, so new uploads appear immediately in both `dev` and `start`.
- **Cleanup:** when a book's image is replaced or the book is deleted, files nothing else references are removed.
- **Seed covers:** the seed writes generated SVG front and back covers (`seed-*.svg`) to the same folder.

## Where things live

- Storefront: `src/app/(store)`
- Admin panel: `src/app/admin`
- APIs: `src/app/api`
- Sign-up modal and `/auth` page: they share `src/components/auth/auth-form.tsx` (single step — sign-up signs you in immediately)
- Theme: `src/app/globals.css`, which overrides Bootstrap's CSS variables with the paper `#FAF9F6`, ink `#1E293B`, slate `#64748B` and ink-navy `#1B365D` palette
- Customer orders: `src/app/(store)/my-orders`; order rules in `src/lib/orders.ts`

## Before production

- **Secrets:** set a strong `AUTH_SECRET`.
- **Sign-in protection:** sign-in is password-only, so add rate limiting on `/api/auth/login` (per IP and per account) before going live.
- **Store details:** replace the placeholder GSTIN and contact details in `src/lib/store-info.ts`, and the fictional seed catalog with your real one.
- **Image storage:** a local `public/uploads` folder suits a single server. For serverless or multi-instance hosting, move uploads to object storage (S3/R2) in `src/lib/uploads.ts`.
