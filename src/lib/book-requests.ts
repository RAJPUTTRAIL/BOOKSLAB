import "server-only";
import type { BookRequestDoc } from "@/lib/models";

export type BookRequestDTO = {
  id: string; customerName: string; phone: string; email: string | null; bookTitle: string; authorOrPublisher: string; isbn: string;
  editionOrYear: string; quantity: number; preferredFulfillment: string; notes: string; status: string; estimatedPrice: number | null;
  adminReply: string; createdAt: string; updatedAt: string; linkedAccount: boolean;
};

export const bookRequestDTO = (r: BookRequestDoc): BookRequestDTO => ({
  id: String(r._id), customerName: r.customerName, phone: r.phone, email: r.email ?? null, bookTitle: r.bookTitle, authorOrPublisher: r.authorOrPublisher ?? "",
  isbn: r.isbn ?? "", editionOrYear: r.editionOrYear ?? "", quantity: r.quantity ?? 1, preferredFulfillment: r.preferredFulfillment ?? "CP Store Pickup",
  notes: r.notes ?? "", status: r.status ?? "New", estimatedPrice: r.estimatedPrice ?? null, adminReply: r.adminReply ?? "",
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), linkedAccount: !!r.userId,
});
