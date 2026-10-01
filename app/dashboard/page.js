import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import DashboardClient from "./DashboardClient";
import "./page.css";

export default async function DashboardPage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  return (
    <DashboardClient
      account={account}
    />
  );
}
