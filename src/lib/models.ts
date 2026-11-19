import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model, Types } from "mongoose";
import { ADDRESS_LABELS, BOOK_CATEGORIES, BOOK_REQUEST_STATUSES, BOOK_FORMATS, DELIVERY_TYPES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, RETURN_REASONS, RETURN_STATUSES, RETURN_TYPES } from "./constants";

/** Reuse compiled models across Next.js hot reloads. */
function model<T extends Schema>(name: string, schema: T) {
  return (mongoose.models[name] as Model<InferSchemaType<T>>) ?? mongoose.model(name, schema);
}

// ─────────────────────────────── Catalog ────────────────────────────────

const bookSchema = new Schema(
  {
    // Core fields
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true },
    category: { type: String, required: true, enum: BOOK_CATEGORIES, index: true },
    mrp: { type: Number, required: true, min: 0 }, // ₹
    discountedPrice: { type: Number, required: true, min: 0 }, // ₹
    stock: { type: Number, default: 0, min: 0 },
    edition: { type: String, required: true },
    description: { type: String, required: true },
    coverImage: { type: String, default: "" }, // "/uploads/books/…" or https URL
    galleryImages: { type: [String], default: [] }, // back cover / sample-page images
    isFeatured: { type: Boolean, default: false, index: true },
    // Storefront extras
    slug: { type: String, required: true, unique: true },
    subtitle: { type: String, default: "" },
    publisher: { type: String, default: "Bookslab Press" },
    subcategory: { type: String, default: "" },
    format: { type: String, enum: BOOK_FORMATS, default: "Paperback" },
    year: { type: Number, default: 2026 },
    pages: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5 },
    reviews: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    samplePages: { type: [String], default: [] }, // "Look inside" text pages
    cpPickup: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Book = model("Book", bookSchema);

const dropSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    discountPct: { type: Number, required: true, min: 1, max: 90 },
    label: { type: String, default: "This week" },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Drop = model("Drop", dropSchema);

// ─────────────────────────── Identity & security ───────────────────────────

const addressSchema = new Schema({
  label: { type: String, enum: ADDRESS_LABELS, default: "Home" },
  recipientName: { type: String, required: true, trim: true },
  phone: { type: String, required: true }, // +91XXXXXXXXXX
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
}); // each address keeps its own _id

const userSchema = new Schema(
  {
    // Core fields
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true }, // unique when present (partial index below)
    phone: { type: String, trim: true }, // +91XXXXXXXXXX, unique when present
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    // Saved delivery addresses (exactly one isDefault when any exist)
    addresses: { type: [addressSchema], default: [] },
    // Forgot-password: bcrypt hash of a 6-character code, valid for 15 minutes
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    resetPasswordAttempts: { type: Number, default: 0 },
    resetPasswordRequestedAt: { type: Date, default: null },
    // Bumped whenever the password changes, which signs out every other session
    tokenVersion: { type: Number, default: 0 },
    // Saved-for-later reading list
    readingList: { type: [{ type: Schema.Types.ObjectId, ref: "Book" }], default: [] },
  },
  { timestamps: true }, // createdAt / updatedAt
);
// MongoDB treats a missing field as a value, so plain unique indexes would allow only one
// phone-less (or email-less) user. Partial indexes enforce uniqueness only when the field is set.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
export const User = model("User", userSchema);

const securityLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  identifier: { type: String, default: null },
  event: { type: String, required: true },
  detail: { type: String, default: null },
  ip: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});
export const SecurityLog = model("SecurityLog", securityLogSchema);

// ─────────────────────────────── Commerce ───────────────────────────────

const orderItemSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", default: null }, // null once the book is deleted
    title: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Snapshot extras for invoices
    isbn: { type: String, default: "" },
    format: { type: String, default: "Paperback" },
    kit: { type: Boolean, default: false },
  },
  { _id: false },
);

const returnRequestSchema = new Schema(
  {
    requestType: { type: String, enum: RETURN_TYPES, required: true },
    items: {
      type: [new Schema({ bookId: { type: Schema.Types.ObjectId, ref: "Book", default: null }, title: String, quantity: Number, price: Number }, { _id: false })],
      required: true,
    },
    reason: { type: String, enum: RETURN_REASONS, required: true },
    description: { type: String, default: "" },
    proofImages: { type: [String], default: [] }, // /uploads/returns/<uuid>.<ext>
    status: { type: String, enum: RETURN_STATUSES, default: "Requested" },
    adminNote: { type: String, default: "" },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    // Completion bookkeeping
    resellable: { type: Boolean, default: false }, // returned copies went back on sale
    refundAmount: { type: Number, default: 0 },
    history: { type: [new Schema({ status: String, note: String, at: Date }, { _id: false })], default: [] },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    deliveryType: { type: String, enum: DELIVERY_TYPES, required: true },
    shippingAddress: {
      line: { type: String, default: "" },
      pincode: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    status: { type: String, enum: ORDER_STATUSES, default: "Placed", index: true },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ["customer", "admin", null], default: null },
    // Price breakdown
    subtotal: { type: Number, required: true },
    bundleDiscount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    codFee: { type: Number, default: 0 },
    etaText: { type: String, default: "" },
    // Payment
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true, default: "COD" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Pending", index: true },
    upiId: { type: String, default: null }, // payer VPA when paid with a UPI ID (null for QR scans)
    transactionId: { type: String, default: null }, // e.g. BSL-UPI-48213907 (online), BSL-COD-… (cash collected)
    cardBrand: { type: String, default: null }, // display only — never the card number
    cardLast4: { type: String, default: null },
    paidAt: { type: Date, default: null },
    refundId: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    // Delivery & after-sales
    deliveredAt: { type: Date, default: null },
    returnRequest: { type: returnRequestSchema, default: null },
  },
  { timestamps: true },
);
orderSchema.index({ createdAt: -1 });
export const Order = model("Order", orderSchema);

// ─────────────────────────────── Cart (one per user) ───────────────────────────────

const cartItemSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    kit: { type: Boolean, default: false }, // added as part of an exam kit (kit pricing)
    title: { type: String, required: true },
    author: { type: String, default: "" },
    price: { type: Number, required: true }, // snapshot; refreshed from the catalog on every read
    coverImage: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1, max: 20 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);
export const Cart = model("Cart", cartSchema);

// ──────────────────────── Analytics & CMS ────────────────────────

const searchEventSchema = new Schema({
  category: { type: String, default: "all" },
  query: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now, index: true },
});
export const SearchEvent = model("SearchEvent", searchEventSchema);

const activitySessionSchema = new Schema(
  {
    _id: { type: String }, // client-generated session id
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    seconds: { type: Number, default: 0 },
    path: { type: String, default: null },
  },
  { timestamps: true },
);
export const ActivitySession = model("ActivitySession", activitySessionSchema);

const siteContentSchema = new Schema(
  {
    _id: { type: String }, // HERO | SHOWCASE | BANNER
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);
export const SiteContent = model("SiteContent", siteContentSchema);

// ─────────────────────────── "Can't find a book?" requests ───────────────────────────

const bookRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true }, // linked when signed in
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true }, // +91XXXXXXXXXX — for WhatsApp / call confirmation
    email: { type: String, default: null, lowercase: true, trim: true },
    bookTitle: { type: String, required: true, trim: true },
    authorOrPublisher: { type: String, default: "", trim: true },
    isbn: { type: String, default: "" },
    editionOrYear: { type: String, default: "" },
    quantity: { type: Number, default: 1, min: 1, max: 50 },
    preferredFulfillment: { type: String, enum: DELIVERY_TYPES, default: "CP Store Pickup" },
    notes: { type: String, default: "" },
    status: { type: String, enum: BOOK_REQUEST_STATUSES, default: "New", index: true },
    estimatedPrice: { type: Number, default: null, min: 0 }, // ₹, quoted once sourced
    adminReply: { type: String, default: "" },
  },
  { timestamps: true }, // createdAt / updatedAt
);
bookRequestSchema.index({ createdAt: -1 });
export const BookRequest = model("BookRequest", bookRequestSchema);

// ─────────────────────────── Store settings (singleton) ───────────────────────────

const storeSettingsSchema = new Schema(
  {
    _id: { type: String, default: "payments" }, // one document
    storeUpiId: { type: String, default: "bookslab@icici" },
    storeUpiName: { type: String, default: "Bookslab Connaught Place" },
    upiQrImage: { type: String, default: null }, // "/uploads/settings/…" when the admin uploads their bank's QR
    enableUpi: { type: Boolean, default: true },
    enableCod: { type: Boolean, default: true },
    enablePayAtStore: { type: Boolean, default: true },
    enableCard: { type: Boolean, default: true },
    codFee: { type: Number, default: 0, min: 0, max: 500 }, // ₹, added to Cash on Delivery orders
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);
export const StoreSettings = model("StoreSettings", storeSettingsSchema);

// ─────────────────────────────── Types ───────────────────────────────

type Lean<T> = T & { _id: Types.ObjectId };
export type BookDoc = Lean<InferSchemaType<typeof bookSchema>>;
export type DropDoc = Lean<InferSchemaType<typeof dropSchema>>;
export type UserDoc = Lean<InferSchemaType<typeof userSchema>>;
export type OrderDoc = Lean<InferSchemaType<typeof orderSchema>>;
export type CartDoc = Lean<InferSchemaType<typeof cartSchema>>;
export type BookRequestDoc = Lean<InferSchemaType<typeof bookRequestSchema>> & { createdAt: Date; updatedAt: Date };

/** True when `id` is a valid 24-hex ObjectId (guards every `/[id]` route against CastErrors). */
export const isId = (id: unknown): id is string => typeof id === "string" && Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);
