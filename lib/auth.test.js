import { describe, expect, it } from "vitest";

import * as auth from "./auth.js";

const AUTH_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "member@example.test",
};

function createDatabase(applicationUser) {
  return {
    user: {
      findUnique: async ({ where, select }) => {
        expect(where).toEqual({ id: AUTH_USER.id });
        expect(select).toEqual({
          deletionRequestedAt: true,
          id: true,
          role: true,
        });
        return applicationUser;
      },
    },
  };
}

function authenticatedRequest() {
  return { headers: { authorization: "Bearer test-access-token" } };
}

const authenticate = async () => AUTH_USER;

describe("server authentication helpers", () => {
  it("verifies a Bearer token with an injected Supabase client", async () => {
    const getUser = async (accessToken) => {
      expect(accessToken).toBe("test-access-token");
      return { data: { user: AUTH_USER }, error: null };
    };

    await expect(
      auth.requireAuthenticatedUser(authenticatedRequest(), {
        supabaseClient: { auth: { getUser } },
      }),
    ).resolves.toEqual(AUTH_USER);
  });

  it("returns the authenticated active application user", async () => {
    const applicationUser = {
      id: AUTH_USER.id,
      role: "user",
      deletionRequestedAt: null,
    };

    await expect(
      auth.requireActiveApplicationUser(
        authenticatedRequest(),
        createDatabase(applicationUser),
        { authenticate },
      ),
    ).resolves.toEqual({
      applicationUser,
      authenticatedUser: AUTH_USER,
    });
  });

  it("returns the deterministic deletion-pending state before handler work", async () => {
    await expect(
      auth.requireActiveApplicationUser(
        authenticatedRequest(),
        createDatabase({
          id: AUTH_USER.id,
          role: "user",
          deletionRequestedAt: new Date("2026-07-23T00:00:00.000Z"),
        }),
        { authenticate },
      ),
    ).rejects.toMatchObject({
      code: "ACCOUNT_DELETION_PENDING",
      statusCode: 403,
    });
  });

  it("permits only an active administrator", async () => {
    const applicationUser = {
      id: AUTH_USER.id,
      role: "admin",
      deletionRequestedAt: null,
    };

    await expect(
      auth.requireAdministrator(
        authenticatedRequest(),
        createDatabase(applicationUser),
        { authenticate },
      ),
    ).resolves.toEqual({
      applicationUser,
      authenticatedUser: AUTH_USER,
    });
  });

  it("rejects an authenticated non-administrator with a reusable error code", async () => {
    await expect(
      auth.requireAdministrator(
        authenticatedRequest(),
        createDatabase({
          id: AUTH_USER.id,
          role: "user",
          deletionRequestedAt: null,
        }),
        { authenticate },
      ),
    ).rejects.toMatchObject({
      code: "ADMINISTRATOR_REQUIRED",
      statusCode: 403,
    });
  });
});
