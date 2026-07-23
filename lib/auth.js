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

export function getSupabaseAdminClient() {
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

export class AuthorizationError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function authenticationRequiredError() {
  return new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "Unauthorized");
}

function applicationUserUnavailableError() {
  return new AuthorizationError("APPLICATION_USER_UNAVAILABLE", 403, "Forbidden");
}

function accountDeletionPendingError() {
  return new AuthorizationError("ACCOUNT_DELETION_PENDING", 403, "Account unavailable");
}

function administratorRequiredError() {
  return new AuthorizationError("ADMINISTRATOR_REQUIRED", 403, "Forbidden");
}

export async function requireAuthenticatedUser(req, { supabaseClient } = {}) {
  const accessToken = getAccessToken(req.headers);
  if (!accessToken) {
    return null;
  }

  const client = supabaseClient ?? getSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(accessToken);
  return error ? null : data.user ?? null;
}

export async function requireActiveApplicationUser(
  req,
  db,
  { authenticate = requireAuthenticatedUser } = {},
) {
  const authenticatedUser = await authenticate(req);
  if (!authenticatedUser) {
    throw authenticationRequiredError();
  }

  const applicationUser = await db.user.findUnique({
    where: { id: authenticatedUser.id },
    select: {
      deletionRequestedAt: true,
      id: true,
      role: true,
    },
  });

  if (!applicationUser) {
    throw applicationUserUnavailableError();
  }

  if (applicationUser.deletionRequestedAt) {
    throw accountDeletionPendingError();
  }

  return { authenticatedUser, applicationUser };
}

export async function requireAdministrator(req, db, options) {
  const activeUser = await requireActiveApplicationUser(req, db, options);
  if (activeUser.applicationUser.role !== "admin") {
    throw administratorRequiredError();
  }

  return activeUser;
}
