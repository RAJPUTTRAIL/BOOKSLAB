import { CUSTOMER_CANCELLABLE, ORDER_STATUSES } from "./constants";

export { ORDER_STATUSES };
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Bootstrap badge classes per status — sober tones, never colour alone (the label is always shown). */
export const STATUS_BADGE: Record<string, string> = {
  Placed: "text-bg-light border",
  Confirmed: "text-bg-primary",
  "Ready at CP Store": "text-bg-info",
  "Out for Delivery": "text-bg-warning",
  Delivered: "text-bg-success",
  Cancelled: "text-bg-secondary",
};

export const STATUS_ICON: Record<string, string> = {
  Placed: "bi-receipt",
  Confirmed: "bi-check2-circle",
  "Ready at CP Store": "bi-shop",
  "Out for Delivery": "bi-truck",
  Delivered: "bi-box-seam",
  Cancelled: "bi-x-circle",
};

/** Statuses that make sense for a delivery type (pickup orders never go "Out for Delivery", and vice versa). */
export const statusesFor = (deliveryType: string) =>
  ORDER_STATUSES.filter((s) => (deliveryType === "CP Store Pickup" ? s !== "Out for Delivery" : s !== "Ready at CP Store"));

/** The step-by-step path an order follows (used for the progress tracker on /my-orders). */
export const progressFor = (deliveryType: string) =>
  deliveryType === "CP Store Pickup"
    ? (["Placed", "Confirmed", "Ready at CP Store", "Delivered"] as const)
    : (["Placed", "Confirmed", "Out for Delivery", "Delivered"] as const);

export const canCustomerCancel = (status: string) => (CUSTOMER_CANCELLABLE as readonly string[]).includes(status);
export const isClosed = (status: string) => status === "Delivered" || status === "Cancelled";
