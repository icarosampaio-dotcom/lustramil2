import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // First try to verify the session JWT directly
    const { parse: parseCookieHeader } = await import("cookie");
    const cookies = opts.req.headers.cookie
      ? parseCookieHeader(opts.req.headers.cookie)
      : {};
    const { COOKIE_NAME } = await import("@shared/const");
    const sessionCookie = cookies[COOKIE_NAME];

    if (sessionCookie) {
      // Verify the JWT token
      const session = await sdk.verifySession(sessionCookie);

      if (session?.openId) {
        // Try to find user by openId in local database first
        const localUser = await db.getUserByOpenId(session.openId);

        if (localUser) {
          // User found locally (works for both local and OAuth users)
          user = localUser;
        } else {
          // User not found locally — try OAuth sync (only works for Manus OAuth users)
          try {
            user = await sdk.authenticateRequest(opts.req);
          } catch {
            // OAuth sync failed — user doesn't exist anywhere
            user = null;
          }
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
