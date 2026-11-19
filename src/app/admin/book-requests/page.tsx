import { connectDB } from "@/lib/mongo";
import { BookRequest, type BookRequestDoc } from "@/lib/models";
import { bookRequestDTO } from "@/lib/book-requests";
import { BookRequestsTable } from "./table";

export const metadata = { title: "Book Requests" };
export const dynamic = "force-dynamic";

export default async function BookRequestsPage() {
  await connectDB();
  const rows = await BookRequest.find().sort({ createdAt: -1 }).limit(1000).lean<BookRequestDoc[]>();
  return <BookRequestsTable initial={rows.map(bookRequestDTO)} />;
}
