import { supabase } from "@/lib/supabase";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required to continue.");
    this.name = "AuthenticationRequiredError";
  }
}

/** Returns a Bearer header for authenticated first-party API requests. */
export async function getAuthorizationHeader(): Promise<{ Authorization: string }> {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new AuthenticationRequiredError();
  }

  return { Authorization: `Bearer ${accessToken}` };
}
