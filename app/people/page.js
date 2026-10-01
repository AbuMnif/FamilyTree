import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import PeopleClient from "./PeopleClient";
import "./page.css";

export default async function PeoplePage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  return (
    <PeopleClient
      account={account}
    />
  );
}
