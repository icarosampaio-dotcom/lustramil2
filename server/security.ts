import type { Request, Response, NextFunction } from "express";

// ─── In-Memory Rate Limiter ──────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(rateLimitStore.keys());
  for (const key of keys) {
    const entry = rateLimitStore.get(key);
    if (entry && entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Rate limiter middleware factory
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Max requests per window
 * @param prefix - Key prefix for different endpoints
 */
export function rateLimit(windowMs: number, maxRequests: number, prefix = "global") {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `${prefix}:${ip}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: "Muitas requisições. Tente novamente em alguns minutos.",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// ─── Security Headers ────────────────────────────────────────
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS Protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy - restrict sensitive APIs
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://files.manuscdn.com https://*.amazonaws.com",
      "connect-src 'self' https://*.manus.computer https://*.manus.im https://api.manus.im",
    ].join("; ")
  );

  // Strict Transport Security
  if (req.protocol === "https" || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

// ─── Input Sanitization Helper ───────────────────────────────
/**
 * Sanitize a string to prevent XSS - strips HTML tags and trims
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>"'&]/g, (char) => {
      const entities: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "&": "&amp;",
      };
      return entities[char] || char;
    })
    .trim();
}

/**
 * Validate file type against allowed types
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "application/xml",
    "text/xml",
  ];
  return allowed.includes(mimeType.toLowerCase());
}

/**
 * Validate file size (max 20MB)
 */
export function isAllowedFileSize(base64String: string): boolean {
  const maxSizeBytes = 20 * 1024 * 1024; // 20MB
  const sizeInBytes = (base64String.length * 3) / 4;
  return sizeInBytes <= maxSizeBytes;
}

// ─── Audit Logger ────────────────────────────────────────────
import { getDb } from "./db";
import { auditLogs } from "../drizzle/schema";

export async function logAudit(params: {
  userId: number;
  userName?: string | null;
  action: string;
  resource: string;
  resourceId?: number | null;
  details?: string | null;
  ipAddress?: string | null;
}) {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(auditLogs).values({
      userId: params.userId,
      userName: params.userName || null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId || null,
      details: params.details || null,
      ipAddress: params.ipAddress || null,
    });
  } catch (error) {
    console.error("[Audit] Failed to log:", error);
  }
}
