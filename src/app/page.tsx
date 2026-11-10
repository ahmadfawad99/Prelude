import { redirect } from "next/navigation";

// Homepage is the Leads listing (All / My leads, list + board).
export default function Home() {
  redirect("/inquiries");
}
