import crypto from "crypto";
import { cookies } from "next/headers";
import { supabase } from "./supabase";

const SESSION_COOKIE = "family_tree_session";
const SESSION_DAYS = 30;

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(accountId) {
  const token = createToken();
  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  const { error } = await supabase
    .from("account_sessions")
    .insert({
      account_id: accountId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    throw new Error(error.message);
  }

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getCurrentAccount() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const { data, error } = await supabase
    .from("account_sessions")
    .select(`
      id,
      expires_at,
      account:accounts (
        id,
        username,
        role,
        is_active,
        person:people (
          id,
          family_id,
          first_name,
          middle_name,
          last_name,
          gender,
          birth_date,
          death_date,
          birth_place,
          death_place,
          bio,
          photo_url
        )
      )
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (new Date(data.expires_at) <= new Date()) {
    await supabase
      .from("account_sessions")
      .delete()
      .eq("id", data.id);

    return null;
  }

  if (!data.account || !data.account.is_active) {
    return null;
  }

  return {
    sessionId: data.id,
    expiresAt: data.expires_at,
    ...data.account,
  };
}

export async function destroySession() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = hashToken(token);

    await supabase
      .from("account_sessions")
      .delete()
      .eq("token_hash", tokenHash);
  }

  cookieStore.delete(SESSION_COOKIE);
}
