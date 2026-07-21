import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

function getAccessToken(headers = {}) {
  const authorization = headers.authorization ?? headers.Authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthenticatedUser(req) {
  const accessToken = getAccessToken(req.headers);
  if (!accessToken) {
    return null;
  }

  const { data, error } = await getSupabaseAdminClient().auth.getUser(accessToken);
  return error ? null : data.user ?? null;
}
