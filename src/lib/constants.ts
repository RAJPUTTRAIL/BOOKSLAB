// Plain constants shared by server code and client components.
export const BOOK_CATEGORIES = ["Law", "Finance & Tax", "Academic", "Tech & Management", "General"] as const;
export const BOOK_FORMATS = ["Paperback", "Hardcover", "E-book", "Subscription"] as const;
export const DELIVERY_TYPES = ["CP Store Pickup", "Home Delivery"] as const;
export const ORDER_STATUSES = ["Placed", "Confirmed", "Ready at CP Store", "Out for Delivery", "Delivered", "Cancelled"] as const;
/** Customers may cancel an order themselves only before it leaves the store / is ready for pickup. */
export const CUSTOMER_CANCELLABLE = ["Placed", "Confirmed"] as const;
export const CANCEL_REASONS = ["Ordered by mistake", "Found a newer edition", "Change in delivery plan", "Other"] as const;
export const ADDRESS_LABELS = ["Home", "Office", "College", "Other"] as const;
export const MAX_ADDRESSES = 10;

// ── Payments ──
export const PAYMENT_METHODS = ["UPI", "COD", "PAY_AT_STORE", "CARD"] as const;
export const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = { UPI: "UPI", COD: "Cash on Delivery", PAY_AT_STORE: "Pay at CP Store", CARD: "Card" };
export const PREPAID_METHODS: readonly PaymentMethod[] = ["UPI", "CARD"];

// ── Returns & replacements ──
export const RETURN_TYPES = ["Replacement", "Return & Refund"] as const;
export const RETURN_REASONS = ["Damaged / Torn Cover", "Missing or Blank Pages", "Wrong Book or Edition Delivered", "Defective Binding", "Other"] as const;
export const RETURN_STATUSES = ["Requested", "Approved", "Pickup Scheduled", "Completed", "Rejected"] as const;
export const RETURN_WINDOW_DAYS = 7;
/** Allowed admin moves between return statuses. */
export const RETURN_FLOW: Record<string, readonly string[]> = {
  Requested: ["Approved", "Rejected"],
  Approved: ["Pickup Scheduled", "Completed", "Rejected"],
  "Pickup Scheduled": ["Completed", "Rejected"],
  Completed: [],
  Rejected: [],
};

// ── "Can't find a book?" requests ──
export const BOOK_REQUEST_STATUSES = ["New", "Sourcing", "Available at Store", "Not Available", "Fulfilled"] as const;

// ── Contact form ──
export const CONTACT_TOPICS = ["Order help", "Book availability", "Bulk / institutional order", "Returns", "Something else"] as const;
