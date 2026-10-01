import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import TreeClient from "./TreeClient";
import "./page.css";

export default async function TreePage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  return (
    <TreeClient
      account={account}
    />
  );
}
