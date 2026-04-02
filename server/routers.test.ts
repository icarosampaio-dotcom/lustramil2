import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Auth Tests ──────────────────────────────────────────
describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

// ─── Authentication Required Tests ──────────────────────
describe("protected routes require authentication", () => {
  it("dashboard.stats rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats()).rejects.toThrow();
  });

  it("dashboard.recentMovements rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.recentMovements()).rejects.toThrow();
  });

  it("dashboard.lowStock rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.lowStock()).rejects.toThrow();
  });

  it("products.list rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.products.list()).rejects.toThrow();
  });

  it("invoices.list rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invoices.list()).rejects.toThrow();
  });

  it("invoices.upload rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invoices.upload({
        type: "entrada",
        fileBase64: "dGVzdA==",
        fileName: "test.pdf",
        fileType: "application/pdf",
      })
    ).rejects.toThrow();
  });

  it("reports.movements rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.movements({
        startDate: new Date(),
        endDate: new Date(),
      })
    ).rejects.toThrow();
  });

  it("reports.revenue rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.revenue({
        startDate: new Date(),
        endDate: new Date(),
      })
    ).rejects.toThrow();
  });

  it("entities.list rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.entities.list()).rejects.toThrow();
  });
});

// ─── Admin RBAC Tests ────────────────────────────────────
describe("admin routes require admin role", () => {
  it("admin.listUsers rejects non-admin user", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.listUsers()).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("admin.updateUserRole rejects non-admin user", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.updateUserRole({ userId: 2, role: "admin" })
    ).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("admin.deleteUser rejects non-admin user", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.deleteUser({ userId: 2 })
    ).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("admin.auditLogs rejects non-admin user", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.auditLogs()).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("admin.listUsers rejects unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.listUsers()).rejects.toThrow();
  });
});

// ─── Admin Self-Protection Tests ─────────────────────────
describe("admin self-protection", () => {
  it("admin cannot self-demote", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.updateUserRole({ userId: 1, role: "user" })
    ).rejects.toThrow(/pr.prio|yourself/i);
  });

  it("admin cannot self-delete", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.deleteUser({ userId: 1 })
    ).rejects.toThrow(/pr.pria|yourself/i);
  });
});

// ─── Input Validation Tests ──────────────────────────────
describe("input validation", () => {
  it("invoices.upload rejects invalid file type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invoices.upload({
        type: "entrada",
        fileBase64: "dGVzdA==",
        fileName: "test.exe",
        fileType: "application/x-msdownload",
      })
    ).rejects.toThrow(/tipo de arquivo|not allowed/i);
  });

  it("products.update rejects negative minStock", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.products.update({ id: 1, minStock: -5 })
    ).rejects.toThrow();
  });

  it("products.get rejects non-positive id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.products.get({ id: -1 })
    ).rejects.toThrow();
  });

  it("invoices.list rejects limit > 100", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invoices.list({ limit: 500 })
    ).rejects.toThrow();
  });
});

// ─── Local Auth Tests ───────────────────────────────────
describe("auth.localLogin", () => {
  it("rejects empty username", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.localLogin({ username: "", password: "test123" })
    ).rejects.toThrow();
  });

  it("rejects empty password", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.localLogin({ username: "admin", password: "" })
    ).rejects.toThrow();
  });
});

describe("auth.changePassword", () => {
  it("rejects unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.changePassword({ currentPassword: "old", newPassword: "newpass123" })
    ).rejects.toThrow();
  });

  it("rejects short new password", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.changePassword({ currentPassword: "old", newPassword: "ab" })
    ).rejects.toThrow();
  });
});

describe("admin.createUser", () => {
  it("rejects non-admin user", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.createUser({ username: "newuser", name: "New User", password: "pass123" })
    ).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("rejects invalid username characters", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.createUser({ username: "user with spaces", name: "Test", password: "pass123" })
    ).rejects.toThrow();
  });

  it("rejects short username", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.createUser({ username: "ab", name: "Test", password: "pass123" })
    ).rejects.toThrow();
  });

  it("rejects short password", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.createUser({ username: "validuser", name: "Test", password: "12345" })
    ).rejects.toThrow();
  });
});

describe("admin.resetPassword", () => {
  it("rejects non-admin user", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.resetPassword({ userId: 2, newPassword: "newpass123" })
    ).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("rejects short password", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.resetPassword({ userId: 2, newPassword: "12345" })
    ).rejects.toThrow();
  });
});

// ─── Security Module Tests ───────────────────────────────
describe("security helpers", () => {
  it("sanitizeString removes HTML tags", async () => {
    const { sanitizeString } = await import("./security");
    const result = sanitizeString("<script>alert('xss')</script>Hello");
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hello");
  });

  it("isAllowedFileType accepts PDF", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("application/pdf")).toBe(true);
  });

  it("isAllowedFileType accepts JPEG", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("image/jpeg")).toBe(true);
  });

  it("isAllowedFileType accepts PNG", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("image/png")).toBe(true);
  });

  it("isAllowedFileType rejects EXE", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("application/x-msdownload")).toBe(false);
  });

  it("isAllowedFileType rejects JavaScript", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("application/javascript")).toBe(false);
  });

  it("isAllowedFileSize rejects oversized files", async () => {
    const { isAllowedFileSize } = await import("./security");
    // Create a base64 string > 20MB
    const bigString = "A".repeat(30 * 1024 * 1024);
    expect(isAllowedFileSize(bigString)).toBe(false);
  });

  it("isAllowedFileSize accepts small files", async () => {
    const { isAllowedFileSize } = await import("./security");
    const smallString = "dGVzdA=="; // "test" in base64
    expect(isAllowedFileSize(smallString)).toBe(true);
  });
});
