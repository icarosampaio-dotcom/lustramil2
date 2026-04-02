import { eq, and, gte, lte, desc, sql, like, or, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  entities, InsertEntity,
  products, InsertProduct,
  invoices, InsertInvoice,
  invoiceItems, InsertInvoiceItem,
  stockMovements, InsertStockMovement,
  auditLogs, InsertAuditLog,
  expenseCategories, InsertExpenseCategory,
  financialAccounts, InsertFinancialAccount,
  accountsPayable, InsertAccountPayable,
  accountsReceivable, InsertAccountReceivable,
  cashMovements, InsertCashMovement,
  insumos, InsertInsumo,
  fichaTecnica, InsertFichaTecnica,
  productionOrders, InsertProductionOrder,
  salesImportBatches, InsertSalesImportBatch,
  salesData, InsertSalesData,
  commissionConfigs, InsertCommissionConfig,
} from "../drizzle/schema";
import { ENV } from './_core/env';

/** Convert JS Date to MySQL-compatible string 'YYYY-MM-DD HH:mm:ss' */
function toMySQLDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Entities (Fornecedores/Clientes) ───────────────────
export async function findOrCreateEntity(data: { name: string; type: "fornecedor" | "cliente"; document?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Try to find by name (case-insensitive)
  const existing = await db.select().from(entities)
    .where(and(
      sql`LOWER(${entities.name}) = LOWER(${data.name})`,
      eq(entities.type, data.type)
    )).limit(1);

  if (existing.length > 0) return existing[0];

  const result = await db.insert(entities).values({
    name: data.name,
    type: data.type,
    document: data.document || null,
  });
  const insertId = result[0].insertId;
  const created = await db.select().from(entities).where(eq(entities.id, insertId)).limit(1);
  return created[0];
}

export async function listEntities(type?: "fornecedor" | "cliente") {
  const db = await getDb();
  if (!db) return [];
  const conditions = type ? eq(entities.type, type) : undefined;
  return db.select().from(entities).where(conditions).orderBy(asc(entities.name));
}

// ─── Products ───────────────────────────────────────────
export async function findOrCreateProduct(data: { name: string; unit?: string; category?: string; reference?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(products)
    .where(sql`LOWER(${products.name}) = LOWER(${data.name})`)
    .limit(1);

  if (existing.length > 0) {
    // Update reference if it was not set before and we have one now
    if (data.reference && !existing[0].reference) {
      await db.update(products).set({ reference: data.reference }).where(eq(products.id, existing[0].id));
      existing[0].reference = data.reference;
    }
    return existing[0];
  }

  const result = await db.insert(products).values({
    name: data.name,
    unit: data.unit || "un",
    category: data.category || "Produtos de Limpeza",
    reference: data.reference || null,
  });
  const insertId = result[0].insertId;
  const created = await db.select().from(products).where(eq(products.id, insertId)).limit(1);
  return created[0];
}

export async function listProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(asc(products.name));
}

export async function getProduct(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateProductStock(productId: number, quantityChange: number, lastPrice?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(products)
    .set({
      currentStock: sql`${products.currentStock} + ${quantityChange}`,
      ...(lastPrice !== undefined ? { lastPrice: String(lastPrice) } : {}),
    })
    .where(eq(products.id, productId));
}

export async function getLowStockProducts(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products)
    .where(sql`CAST(${products.currentStock} AS DECIMAL) <= CAST(${products.minStock} AS DECIMAL) AND CAST(${products.minStock} AS DECIMAL) > 0`)
    .orderBy(asc(products.currentStock))
    .limit(limit);
}

export async function updateProduct(id: number, data: { name?: string; category?: string; unit?: string; minStock?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.category !== undefined) updateSet.category = data.category;
  if (data.unit !== undefined) updateSet.unit = data.unit;
  if (data.minStock !== undefined) updateSet.minStock = String(data.minStock);

  if (Object.keys(updateSet).length === 0) return;

  await db.update(products).set(updateSet).where(eq(products.id, id));

  const updated = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return updated.length > 0 ? updated[0] : undefined;
}

// ─── Invoices ───────────────────────────────────────────
export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoices).values(data);
  const insertId = result[0].insertId;
  const created = await db.select().from(invoices).where(eq(invoices.id, insertId)).limit(1);
  return created[0];
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function getInvoice(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listInvoices(filters?: { type?: "entrada" | "saida"; startDate?: Date; endDate?: Date; entityDocument?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.type) conditions.push(eq(invoices.type, filters.type));
  if (filters?.startDate) conditions.push(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${toMySQLDate(filters.startDate)}`);
  if (filters?.endDate) conditions.push(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${toMySQLDate(filters.endDate)}`);
  if (filters?.entityDocument) conditions.push(eq(invoices.entityDocument, filters.entityDocument));

  const query = db.select().from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt})`))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);

  return query;
}

export async function listInvoiceCnpjs() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ entityDocument: invoices.entityDocument, entityName: invoices.entityName })
    .from(invoices)
    .where(sql`${invoices.entityDocument} IS NOT NULL AND ${invoices.entityDocument} != ''`)
    .orderBy(asc(invoices.entityName));
  return result;
}

// ─── Invoice Items ──────────────────────────────────────
export async function createInvoiceItems(items: InsertInvoiceItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(invoiceItems).values(items);
}

export async function getInvoiceItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

// ─── Stock Movements ────────────────────────────────────
export async function createStockMovement(data: InsertStockMovement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(stockMovements).values(data);
}

export async function getStockMovements(filters?: { productId?: number; type?: "entrada" | "saida"; startDate?: Date; endDate?: Date; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.productId) conditions.push(eq(stockMovements.productId, filters.productId));
  if (filters?.type) conditions.push(eq(stockMovements.type, filters.type));
  if (filters?.startDate) conditions.push(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) >= ${toMySQLDate(filters.startDate)}`);
  if (filters?.endDate) conditions.push(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) <= ${toMySQLDate(filters.endDate)}`);

  return db.select().from(stockMovements)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt})`))
    .limit(filters?.limit || 100)
    .offset(filters?.offset || 0);
}

// ─── Dashboard Stats ────────────────────────────────────
export async function getDashboardStats(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { totalProducts: 0, totalEntradas: 0, totalSaidas: 0, totalStockValue: 0, lowStockCount: 0, valorEntradas: 0, valorSaidas: 0 };

  const [productCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  const start = toMySQLDate(startDate);
  const end = toMySQLDate(endDate);
  const [entradasPeriod] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices)
    .where(and(eq(invoices.type, "entrada"), sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${start}`, sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${end}`));
  const [saidasPeriod] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices)
    .where(and(eq(invoices.type, "saida"), sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${start}`, sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${end}`));
  const [valorEntradas] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(${invoices.totalValue} AS DECIMAL)), 0)`
  }).from(invoices)
    .where(and(eq(invoices.type, "entrada"), eq(invoices.status, "concluido"), sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${start}`, sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${end}`));
  const [valorSaidas] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(${invoices.totalValue} AS DECIMAL)), 0)`
  }).from(invoices)
    .where(and(eq(invoices.type, "saida"), eq(invoices.status, "concluido"), sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${start}`, sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${end}`));
  const [stockValue] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(${products.currentStock} AS DECIMAL) * CAST(${products.lastPrice} AS DECIMAL)), 0)`
  }).from(products);
  const [lowStock] = await db.select({ count: sql<number>`COUNT(*)` }).from(products)
    .where(sql`CAST(${products.currentStock} AS DECIMAL) <= CAST(${products.minStock} AS DECIMAL) AND CAST(${products.minStock} AS DECIMAL) > 0`);

  return {
    totalProducts: productCount.count,
    totalEntradas: entradasPeriod.count,
    totalSaidas: saidasPeriod.count,
    totalStockValue: stockValue.total,
    lowStockCount: lowStock.count,
    valorEntradas: valorEntradas.total,
    valorSaidas: valorSaidas.total,
  };
}

// ─── Reports ────────────────────────────────────────────
export async function getMovementReport(startDate: Date, endDate: Date, productId?: number, entityId?: number) {
  const db = await getDb();
  if (!db) return [];

  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);
  const conditions = [
    sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) >= ${startStr}`,
    sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) <= ${endStr}`,
  ];
  if (productId) conditions.push(eq(stockMovements.productId, productId));
  if (entityId) conditions.push(eq(invoices.entityId, entityId));

  return db.select({
    id: stockMovements.id,
    productId: stockMovements.productId,
    productName: products.name,
    reference: products.reference,
    type: stockMovements.type,
    quantity: stockMovements.quantity,
    unitPrice: stockMovements.unitPrice,
    totalPrice: stockMovements.totalPrice,
    cfop: stockMovements.cfop,
    createdAt: stockMovements.createdAt,
    movementDate: stockMovements.movementDate,
    entityName: invoices.entityName,
    entityDocument: invoices.entityDocument,
    invoiceId: stockMovements.invoiceId,
  })
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .leftJoin(invoices, eq(stockMovements.invoiceId, invoices.id))
    .where(and(...conditions))
    .orderBy(desc(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt})`));
}

export async function getRevenueByPeriod(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  const start = toMySQLDate(startDate);
  const end = toMySQLDate(endDate);

  const rows = await db.execute(sql`
    SELECT dt, type, COALESCE(SUM(CAST(totalValue AS DECIMAL)), 0) as total, COUNT(*) as count
    FROM (
      SELECT DATE(COALESCE(${invoices.issueDate}, ${invoices.createdAt})) as dt,
             ${invoices.type} as type,
             ${invoices.totalValue} as totalValue
      FROM ${invoices}
      WHERE COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${start}
        AND COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${end}
        AND ${invoices.status} = 'concluido'
    ) sub
    GROUP BY dt, type
    ORDER BY dt
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    date: String(r.dt),
    type: String(r.type) as "entrada" | "saida",
    total: Number(r.total),
    count: Number(r.count),
  }));
}

export async function getProductSalesByMonth(productId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);
  const rows = await db.execute(sql`
    SELECT month_str, type, COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as totalQuantity,
           COALESCE(SUM(CAST(totalPrice AS DECIMAL)), 0) as totalValue
    FROM (
      SELECT DATE_FORMAT(COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}), '%Y-%m') as month_str,
             ${stockMovements.type} as type,
             ${stockMovements.quantity} as quantity,
             ${stockMovements.totalPrice} as totalPrice
      FROM ${stockMovements}
      WHERE ${stockMovements.productId} = ${productId}
        AND COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) >= ${startStr}
        AND COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) <= ${endStr}
    ) sub
    GROUP BY month_str, type
    ORDER BY month_str
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    month: String(r.month_str),
    type: String(r.type),
    totalQuantity: Number(r.totalQuantity),
    totalValue: Number(r.totalValue),
  }));
}

export async function getRecentMovements(limit = 10, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (startDate) conditions.push(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt}) <= ${toMySQLDate(endDate)}`);

  return db.select({
    id: stockMovements.id,
    productName: products.name,
    type: stockMovements.type,
    quantity: stockMovements.quantity,
    totalPrice: stockMovements.totalPrice,
    createdAt: stockMovements.createdAt,
    movementDate: stockMovements.movementDate,
  })
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sql`COALESCE(${stockMovements.movementDate}, ${stockMovements.createdAt})`))
    .limit(limit);
}

export async function getInvoiceCount() {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices);
  return result.count;
}


// ─── User Management (Admin) ────────────────────────────
export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ role }).where(eq(users.id, userId));

  const updated = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return updated.length > 0 ? updated[0] : undefined;
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, userId));
}

// ─── Audit Logs ─────────────────────────────────────────
export async function getAuditLogs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}


// ─── Local Auth (Username/Password) ───────────────────────
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  // Case-insensitive search
  const result = await db.select().from(users).where(
    sql`LOWER(${users.username}) = LOWER(${username.trim()})`
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: {
  username: string;
  name: string;
  passwordHash: string;
  role?: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize username to lowercase
  const normalizedUsername = data.username.trim().toLowerCase();
  // Generate a unique openId for local users
  const openId = `local_${normalizedUsername}_${Date.now()}`;

  await db.insert(users).values({
    openId,
    username: normalizedUsername,
    name: data.name,
    passwordHash: data.passwordHash,
    loginMethod: "local",
    role: data.role || "user",
    lastSignedIn: new Date(),
  });

  return getUserByUsername(normalizedUsername);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function ensureAdminExists() {
  const db = await getDb();
  if (!db) return;

  // Check if any admin with username exists
  const admins = await db.select().from(users)
    .where(and(eq(users.role, "admin"), sql`${users.username} IS NOT NULL`))
    .limit(1);

  if (admins.length === 0) {
    // Create default admin
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("admin123", 12);
    const openId = `local_admin_${Date.now()}`;

    await db.insert(users).values({
      openId,
      username: "admin",
      name: "Administrador",
      passwordHash: hash,
      loginMethod: "local",
      role: "admin",
      lastSignedIn: new Date(),
    });
    console.log("[Auth] Default admin user created: admin / admin123");
  }
}


// ─── Clear All Data (Admin Only) ─────────────────────────
export async function clearAllData() {
  const db = await getDb();
  if (!db) return;

  // Delete in order to respect foreign key constraints
  await db.delete(stockMovements);
  await db.delete(invoiceItems);
  await db.delete(invoices);
  await db.delete(products);
  await db.delete(entities);
  await db.delete(auditLogs);
}

// ─── Monthly Comparison ─────────────────────────────────
export async function getMonthlyComparison() {
  const db = await getDb();
  if (!db) return { currentMonth: { entradas: 0, saidas: 0, valueIn: 0, valueOut: 0, count: 0 }, previousMonth: { entradas: 0, saidas: 0, valueIn: 0, valueOut: 0, count: 0 }, dailyCurrent: [] as { day: number; valueIn: number; valueOut: number }[], dailyPrevious: [] as { day: number; valueIn: number; valueOut: number }[] };

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const cmStart = toMySQLDate(currentMonthStart);
  const cmEnd = toMySQLDate(currentMonthEnd);
  const pmStart = toMySQLDate(previousMonthStart);
  const pmEnd = toMySQLDate(previousMonthEnd);

  // Current month aggregates
  const currentAgg = await db.select({
    type: invoices.type,
    count: sql<number>`COUNT(*)`,
    totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.totalValue} AS DECIMAL)), 0)`,
  }).from(invoices)
    .where(and(
      sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${cmStart}`,
      sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${cmEnd}`,
      eq(invoices.status, "concluido"),
    ))
    .groupBy(invoices.type);

  // Previous month aggregates
  const prevAgg = await db.select({
    type: invoices.type,
    count: sql<number>`COUNT(*)`,
    totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.totalValue} AS DECIMAL)), 0)`,
  }).from(invoices)
    .where(and(
      sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${pmStart}`,
      sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${pmEnd}`,
      eq(invoices.status, "concluido"),
    ))
    .groupBy(invoices.type);

  // Daily breakdown current month
  const dailyCurrentRows = await db.execute(sql`
    SELECT d, type, COALESCE(SUM(CAST(totalValue AS DECIMAL)), 0) as totalValue
    FROM (
      SELECT DAY(COALESCE(${invoices.issueDate}, ${invoices.createdAt})) as d,
             ${invoices.type} as type,
             ${invoices.totalValue} as totalValue
      FROM ${invoices}
      WHERE COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${cmStart}
        AND COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${cmEnd}
        AND ${invoices.status} = 'concluido'
    ) sub
    GROUP BY d, type ORDER BY d
  `);
  const dailyCurrent = ((dailyCurrentRows as any)[0] as any[]).map((r: any) => ({
    day: Number(r.d), type: String(r.type), totalValue: Number(r.totalValue)
  }));

  // Daily breakdown previous month
  const dailyPreviousRows = await db.execute(sql`
    SELECT d, type, COALESCE(SUM(CAST(totalValue AS DECIMAL)), 0) as totalValue
    FROM (
      SELECT DAY(COALESCE(${invoices.issueDate}, ${invoices.createdAt})) as d,
             ${invoices.type} as type,
             ${invoices.totalValue} as totalValue
      FROM ${invoices}
      WHERE COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${pmStart}
        AND COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${pmEnd}
        AND ${invoices.status} = 'concluido'
    ) sub
    GROUP BY d, type ORDER BY d
  `);
  const dailyPrevious = ((dailyPreviousRows as any)[0] as any[]).map((r: any) => ({
    day: Number(r.d), type: String(r.type), totalValue: Number(r.totalValue)
  }));


  // Parse aggregates
  const parseMonthlySummary = (agg: typeof currentAgg) => {
    let entradas = 0, saidas = 0, valueIn = 0, valueOut = 0, count = 0;
    agg.forEach((r) => {
      const val = Number(r.totalValue);
      const cnt = Number(r.count);
      if (r.type === "entrada") { entradas += cnt; valueIn += val; }
      else { saidas += cnt; valueOut += val; }
      count += cnt;
    });
    return { entradas, saidas, valueIn, valueOut, count };
  };

  // Parse daily data
  const parseDailyData = (daily: typeof dailyCurrent) => {
    const map: Record<number, { day: number; valueIn: number; valueOut: number }> = {};
    daily.forEach((r) => {
      const d = Number(r.day);
      if (!map[d]) map[d] = { day: d, valueIn: 0, valueOut: 0 };
      if (r.type === "entrada") map[d].valueIn += Number(r.totalValue);
      else map[d].valueOut += Number(r.totalValue);
    });
    return Object.values(map).sort((a, b) => a.day - b.day);
  };

  return {
    currentMonth: parseMonthlySummary(currentAgg),
    previousMonth: parseMonthlySummary(prevAgg),
    dailyCurrent: parseDailyData(dailyCurrent),
    dailyPrevious: parseDailyData(dailyPrevious),
    currentMonthLabel: currentMonthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    previousMonthLabel: previousMonthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

// ─── Search Invoices ─────────────────────────────────────
export async function searchInvoices(query: string, type?: "entrada" | "saida") {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (type) {
    conditions.push(eq(invoices.type, type));
  }

  if (query) {
    conditions.push(
      or(
        sql`${invoices.invoiceNumber} LIKE ${`%${query}%`}`,
        sql`${invoices.entityName} LIKE ${`%${query}%`}`,
      )
    );
  }

  const result = await db.select().from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt})`))
    .limit(100);

  return result;
}


// ==================== CATEGORIAS DE GASTOS ====================

export async function listCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseCategories).orderBy(expenseCategories.name);
}

export async function createCategory(data: InsertExpenseCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(expenseCategories).values(data);
  return { id: result[0].insertId };
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
}

// ==================== CONTAS FINANCEIRAS ====================

export async function listFinancialAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialAccounts).orderBy(financialAccounts.name);
}

export async function createFinancialAccount(data: InsertFinancialAccount) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(financialAccounts).values(data);
  return { id: result[0].insertId };
}

export async function updateFinancialAccountBalance(id: number, amount: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(financialAccounts)
    .set({ currentBalance: sql`${financialAccounts.currentBalance} + ${amount}` })
    .where(eq(financialAccounts.id, id));
}

export async function deleteFinancialAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(financialAccounts).where(eq(financialAccounts.id, id));
}

// ==================== CONTAS A PAGAR ====================

export async function listAccountsPayable(startDate?: Date, endDate?: Date, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${accountsPayable.dueDate} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${accountsPayable.dueDate} <= ${toMySQLDate(endDate)}`);
  if (status && status !== "todos") conditions.push(eq(accountsPayable.status, status as any));
  return db.select().from(accountsPayable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(accountsPayable.dueDate);
}

export async function createAccountPayable(data: InsertAccountPayable) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(accountsPayable).values(data);
  return { id: result[0].insertId };
}

export async function updateAccountPayable(id: number, data: Partial<InsertAccountPayable>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(accountsPayable).set(data).where(eq(accountsPayable.id, id));
}

export async function markAccountPaid(id: number, paidDate: Date, paidValue: number, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(accountsPayable).set({
    status: "pago",
    paidDate,
    paidValue: String(paidValue) as any,
    accountId: accountId || null,
  }).where(eq(accountsPayable.id, id));
  // Update financial account balance if specified
  if (accountId) {
    await updateFinancialAccountBalance(accountId, -paidValue);
  }
}

export async function deleteAccountPayable(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(accountsPayable).where(eq(accountsPayable.id, id));
}

export async function getAccountsPayableSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { total: 0, pendente: 0, pago: 0, vencido: 0, totalPendente: 0, totalPago: 0, totalVencido: 0 };
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${accountsPayable.dueDate} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${accountsPayable.dueDate} <= ${toMySQLDate(endDate)}`);
  const rows = await db.execute(sql`
    SELECT status, COUNT(*) as cnt, COALESCE(SUM(CAST(value AS DECIMAL)), 0) as total
    FROM ${accountsPayable}
    ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    GROUP BY status
  `);
  const result = { total: 0, pendente: 0, pago: 0, vencido: 0, totalPendente: 0, totalPago: 0, totalVencido: 0 };
  for (const r of (rows as any)[0] as any[]) {
    const cnt = Number(r.cnt);
    const tot = Number(r.total);
    result.total += cnt;
    if (r.status === "pendente") { result.pendente = cnt; result.totalPendente = tot; }
    if (r.status === "pago") { result.pago = cnt; result.totalPago = tot; }
    if (r.status === "vencido") { result.vencido = cnt; result.totalVencido = tot; result.totalPendente += tot; }
  }
  return result;
}

export async function getUpcomingPayables(days: number = 7) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db.select().from(accountsPayable)
    .where(and(
      eq(accountsPayable.status, "pendente"),
      sql`${accountsPayable.dueDate} >= ${toMySQLDate(now)}`,
      sql`${accountsPayable.dueDate} <= ${toMySQLDate(future)}`,
    ))
    .orderBy(accountsPayable.dueDate);
}

// ==================== CONTAS A RECEBER ====================

export async function listAccountsReceivable(startDate?: Date, endDate?: Date, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${accountsReceivable.expectedDate} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${accountsReceivable.expectedDate} <= ${toMySQLDate(endDate)}`);
  if (status && status !== "todos") conditions.push(eq(accountsReceivable.status, status as any));
  return db.select().from(accountsReceivable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(accountsReceivable.expectedDate);
}

export async function createAccountReceivable(data: InsertAccountReceivable) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(accountsReceivable).values(data);
  return { id: result[0].insertId };
}

export async function updateAccountReceivable(id: number, data: Partial<InsertAccountReceivable>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(accountsReceivable).set(data).where(eq(accountsReceivable.id, id));
}

export async function markAccountReceived(id: number, receivedDate: Date, receivedValue: number, accountId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(accountsReceivable).set({
    status: "recebido",
    receivedDate,
    receivedValue: String(receivedValue) as any,
    accountId: accountId || null,
  }).where(eq(accountsReceivable.id, id));
  if (accountId) {
    await updateFinancialAccountBalance(accountId, receivedValue);
  }
}

export async function deleteAccountReceivable(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(accountsReceivable).where(eq(accountsReceivable.id, id));
}

export async function getAccountsReceivableSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { total: 0, pendente: 0, recebido: 0, vencido: 0, totalPendente: 0, totalRecebido: 0 };
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${accountsReceivable.expectedDate} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${accountsReceivable.expectedDate} <= ${toMySQLDate(endDate)}`);
  const rows = await db.execute(sql`
    SELECT status, COUNT(*) as cnt, COALESCE(SUM(CAST(value AS DECIMAL)), 0) as total
    FROM ${accountsReceivable}
    ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    GROUP BY status
  `);
  const result = { total: 0, pendente: 0, recebido: 0, vencido: 0, totalPendente: 0, totalRecebido: 0 };
  for (const r of (rows as any)[0] as any[]) {
    const cnt = Number(r.cnt);
    const tot = Number(r.total);
    result.total += cnt;
    if (r.status === "pendente") { result.pendente = cnt; result.totalPendente = tot; }
    if (r.status === "recebido") { result.recebido = cnt; result.totalRecebido = tot; }
    if (r.status === "vencido") { result.vencido = cnt; result.totalPendente += tot; }
  }
  return result;
}

// ==================== CAIXA / MOVIMENTAÇÃO DIÁRIA ====================

export async function listCashMovements(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${cashMovements.date} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${cashMovements.date} <= ${toMySQLDate(endDate)}`);
  return db.select().from(cashMovements)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(cashMovements.date));
}

export async function createCashMovement(data: InsertCashMovement) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(cashMovements).values(data);
  // Update financial account balance if specified
  if (data.accountId) {
    const amount = data.type === "entrada" ? Number(data.value) : -Number(data.value);
    await updateFinancialAccountBalance(data.accountId, amount);
  }
  return { id: result[0].insertId };
}

export async function deleteCashMovement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Get movement to reverse balance
  const [movement] = await db.select().from(cashMovements).where(eq(cashMovements.id, id));
  if (movement && movement.accountId) {
    const reverseAmount = movement.type === "entrada" ? -Number(movement.value) : Number(movement.value);
    await updateFinancialAccountBalance(movement.accountId, reverseAmount);
  }
  await db.delete(cashMovements).where(eq(cashMovements.id, id));
}

export async function getCashSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { entradas: 0, saidas: 0, saldo: 0 };
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${cashMovements.date} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${cashMovements.date} <= ${toMySQLDate(endDate)}`);
  const rows = await db.execute(sql`
    SELECT type, COALESCE(SUM(CAST(value AS DECIMAL)), 0) as total
    FROM ${cashMovements}
    ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    GROUP BY type
  `);
  let entradas = 0, saidas = 0;
  for (const r of (rows as any)[0] as any[]) {
    if (r.type === "entrada") entradas = Number(r.total);
    if (r.type === "saida") saidas = Number(r.total);
  }
  return { entradas, saidas, saldo: entradas - saidas };
}

/** Resultado do período: receitas (recebidos + entradas caixa) - despesas (pagos + saídas caixa) */
export async function getResultadoPeriodo(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { receitas: 0, despesas: 0, resultado: 0 };
  const start = toMySQLDate(startDate);
  const end = toMySQLDate(endDate);
  const [recRows, payRows, cashRows] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(SUM(CAST(receivedValue AS DECIMAL)), 0) as total FROM ${accountsReceivable}
      WHERE ${accountsReceivable.receivedDate} >= ${start} AND ${accountsReceivable.receivedDate} <= ${end}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(CAST(paidValue AS DECIMAL)), 0) as total FROM ${accountsPayable}
      WHERE ${accountsPayable.paidDate} >= ${start} AND ${accountsPayable.paidDate} <= ${end}
    `),
    db.execute(sql`
      SELECT type, COALESCE(SUM(CAST(value AS DECIMAL)), 0) as total FROM ${cashMovements}
      WHERE ${cashMovements.date} >= ${start} AND ${cashMovements.date} <= ${end}
      GROUP BY type
    `),
  ]);
  let receitas = Number((recRows as any)[0]?.[0]?.total ?? 0);
  let despesas = Number((payRows as any)[0]?.[0]?.total ?? 0);
  ((cashRows as any)[0] as any[] || []).forEach((r: any) => {
    if (r.type === "entrada") receitas += Number(r.total);
    if (r.type === "saida") despesas += Number(r.total);
  });
  return { receitas, despesas, resultado: receitas - despesas };
}

export async function getCashByCategory(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`cm.date >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`cm.date <= ${toMySQLDate(endDate)}`);
  const rows = await db.execute(sql`
    SELECT ec.name as categoryName, cm.type, COALESCE(SUM(CAST(cm.value AS DECIMAL)), 0) as total
    FROM ${cashMovements} cm
    LEFT JOIN ${expenseCategories} ec ON cm.categoryId = ec.id
    ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    GROUP BY ec.name, cm.type
    ORDER BY total DESC
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    categoryName: r.categoryName || "Sem categoria",
    type: String(r.type),
    total: Number(r.total),
  }));
}


// ==================== INSUMOS ====================

export async function listInsumos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(insumos).orderBy(asc(insumos.name));
}

export async function getInsumo(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(insumos).where(eq(insumos.id, id));
  return row || null;
}

export async function createInsumo(data: Omit<InsertInsumo, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(insumos).values(data);
  return { id: result[0].insertId };
}

export async function updateInsumo(id: number, data: Partial<InsertInsumo>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(insumos).set(data).where(eq(insumos.id, id));
}

export async function deleteInsumo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if insumo is used in any ficha técnica
  const usages = await db.select().from(fichaTecnica).where(eq(fichaTecnica.insumoId, id));
  if (usages.length > 0) {
    throw new Error("Este insumo está vinculado a produtos na ficha técnica e não pode ser excluído.");
  }
  await db.delete(insumos).where(eq(insumos.id, id));
}

export async function updateInsumoStock(id: number, quantityChange: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.execute(sql`
    UPDATE ${insumos} SET currentStock = GREATEST(0, CAST(currentStock AS DECIMAL) + ${quantityChange})
    WHERE id = ${id}
  `);
}

// ==================== FICHA TÉCNICA ====================

export async function listFichaTecnica(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: fichaTecnica.id,
    productId: fichaTecnica.productId,
    insumoId: fichaTecnica.insumoId,
    insumoName: insumos.name,
    insumoUnit: insumos.unit,
    insumoUnitPrice: insumos.unitPrice,
    insumoCategory: insumos.category,
    quantityPerUnit: fichaTecnica.quantityPerUnit,
    notes: fichaTecnica.notes,
  })
    .from(fichaTecnica)
    .leftJoin(insumos, eq(fichaTecnica.insumoId, insumos.id))
    .where(eq(fichaTecnica.productId, productId))
    .orderBy(asc(insumos.name));
}

export async function addFichaTecnicaItem(data: Omit<InsertFichaTecnica, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(fichaTecnica).values(data);
  return { id: result[0].insertId };
}

export async function updateFichaTecnicaItem(id: number, data: { quantityPerUnit?: string; notes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(fichaTecnica).set(data).where(eq(fichaTecnica.id, id));
}

export async function deleteFichaTecnicaItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(fichaTecnica).where(eq(fichaTecnica.id, id));
}

export async function getProductCost(productId: number) {
  const db = await getDb();
  if (!db) return { items: [], totalCost: 0 };
  const items = await db.select({
    insumoId: fichaTecnica.insumoId,
    insumoName: insumos.name,
    insumoUnit: insumos.unit,
    insumoUnitPrice: insumos.unitPrice,
    insumoCategory: insumos.category,
    quantityPerUnit: fichaTecnica.quantityPerUnit,
  })
    .from(fichaTecnica)
    .leftJoin(insumos, eq(fichaTecnica.insumoId, insumos.id))
    .where(eq(fichaTecnica.productId, productId));

  let totalCost = 0;
  const detailedItems = items.map((item) => {
    const qty = parseFloat(String(item.quantityPerUnit));
    const price = parseFloat(String(item.insumoUnitPrice || 0));
    const subtotal = qty * price;
    totalCost += subtotal;
    return { ...item, subtotal };
  });

  return { items: detailedItems, totalCost };
}

/** Get cost for all products that have ficha técnica */
export async function getAllProductCosts() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT ft.productId, p.name as productName, p.reference, p.lastPrice as salePrice,
           SUM(CAST(ft.quantityPerUnit AS DECIMAL) * CAST(i.unitPrice AS DECIMAL)) as productionCost
    FROM ${fichaTecnica} ft
    LEFT JOIN ${insumos} i ON ft.insumoId = i.id
    LEFT JOIN ${products} p ON ft.productId = p.id
    GROUP BY ft.productId, p.name, p.reference, p.lastPrice
    ORDER BY p.name
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    productId: Number(r.productId),
    productName: String(r.productName || ""),
    reference: r.reference ? String(r.reference) : null,
    salePrice: Number(r.salePrice || 0),
    productionCost: Number(r.productionCost || 0),
    margin: Number(r.salePrice || 0) - Number(r.productionCost || 0),
    marginPercent: Number(r.salePrice || 0) > 0
      ? ((Number(r.salePrice || 0) - Number(r.productionCost || 0)) / Number(r.salePrice || 0)) * 100
      : 0,
  }));
}

// ==================== ORDENS DE PRODUÇÃO ====================

export async function listProductionOrders(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(sql`${productionOrders.productionDate} >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`${productionOrders.productionDate} <= ${toMySQLDate(endDate)}`);
  return db.select({
    id: productionOrders.id,
    productId: productionOrders.productId,
    productName: products.name,
    productReference: products.reference,
    quantity: productionOrders.quantity,
    status: productionOrders.status,
    productionDate: productionOrders.productionDate,
    totalCost: productionOrders.totalCost,
    notes: productionOrders.notes,
    userId: productionOrders.userId,
    createdAt: productionOrders.createdAt,
  })
    .from(productionOrders)
    .leftJoin(products, eq(productionOrders.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(productionOrders.createdAt));
}

export async function createProductionOrder(data: Omit<InsertProductionOrder, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(productionOrders).values(data);
  return { id: result[0].insertId };
}

export async function updateProductionOrderStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(productionOrders).set({ status: status as any }).where(eq(productionOrders.id, id));
}

/** Execute production: deduct insumos and add finished product to stock */
export async function executeProduction(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [order] = await db.select().from(productionOrders).where(eq(productionOrders.id, orderId));
  if (!order) throw new Error("Ordem de produção não encontrada");
  if (order.status === "concluida") throw new Error("Ordem já foi concluída");

  const qty = parseFloat(String(order.quantity));
  const fichaItems = await listFichaTecnica(order.productId);

  // Calculate total cost and deduct insumos
  let totalCost = 0;
  for (const item of fichaItems) {
    const needed = parseFloat(String(item.quantityPerUnit)) * qty;
    const insumo = await getInsumo(item.insumoId);
    if (!insumo) throw new Error(`Insumo ${item.insumoName} não encontrado`);
    const available = parseFloat(String(insumo.currentStock));
    if (available < needed) {
      throw new Error(`Estoque insuficiente de ${item.insumoName}: necessário ${needed.toFixed(3)} ${item.insumoUnit}, disponível ${available.toFixed(3)}`);
    }
    const price = parseFloat(String(item.insumoUnitPrice || 0));
    totalCost += needed * price;
    await updateInsumoStock(item.insumoId, -needed);
  }

  // Add finished product to stock
  await db.execute(sql`
    UPDATE ${products} SET currentStock = CAST(currentStock AS DECIMAL) + ${qty}
    WHERE id = ${order.productId}
  `);

  // Update order
  await db.update(productionOrders).set({
    status: "concluida" as any,
    totalCost: String(totalCost),
    productionDate: new Date(),
  }).where(eq(productionOrders.id, orderId));

  return { totalCost, quantityProduced: qty };
}

// ==================== INVOICE ADVANCED FILTERS ====================

/** List invoices with advanced filters: by product name, reference, entity document */
export async function listInvoicesAdvanced(filters?: {
  type?: "entrada" | "saida";
  startDate?: Date;
  endDate?: Date;
  entityDocument?: string;
  productName?: string;
  productReference?: string;
  entityId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.type) conditions.push(eq(invoices.type, filters.type));
  if (filters?.startDate) conditions.push(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${toMySQLDate(filters.startDate)}`);
  if (filters?.endDate) conditions.push(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${toMySQLDate(filters.endDate)}`);
  if (filters?.entityDocument) conditions.push(like(invoices.entityDocument, `%${filters.entityDocument}%`));
  if (filters?.entityId) conditions.push(eq(invoices.entityId, filters.entityId));

  let query = db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    type: invoices.type,
    entityId: invoices.entityId,
    entityName: invoices.entityName,
    entityDocument: invoices.entityDocument,
    issueDate: invoices.issueDate,
    totalValue: invoices.totalValue,
    status: invoices.status,
    createdAt: invoices.createdAt,
  })
    .from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt})`));

  let results = await query;

  // If filtering by product, we need to filter invoices that contain matching items
  if (filters?.productName || filters?.productReference) {
    const itemConditions: any[] = [];
    if (filters.productName) itemConditions.push(like(invoiceItems.productName, `%${filters.productName}%`));
    if (filters.productReference) itemConditions.push(like(invoiceItems.productReference, `%${filters.productReference}%`));

    const matchingInvoiceIds = await db.selectDistinct({ invoiceId: invoiceItems.invoiceId })
      .from(invoiceItems)
      .where(and(...itemConditions));

    const idSet = new Set(matchingInvoiceIds.map(r => r.invoiceId));
    results = results.filter(inv => idSet.has(inv.id));
  }

  return results;
}

/** Get sales summary by product (for vendas analysis) */
export async function getSalesByProduct(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    eq(invoices.type, "saida"),
    eq(invoices.status, "concluido"),
  ];
  if (startDate) conditions.push(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) >= ${toMySQLDate(startDate)}`);
  if (endDate) conditions.push(sql`COALESCE(${invoices.issueDate}, ${invoices.createdAt}) <= ${toMySQLDate(endDate)}`);

  const rows = await db.execute(sql`
    SELECT ii.productName, ii.productReference, 
           SUM(CAST(ii.quantity AS DECIMAL)) as totalQty,
           SUM(CAST(ii.totalPrice AS DECIMAL)) as totalValue,
           COUNT(DISTINCT i.id) as invoiceCount
    FROM ${invoiceItems} ii
    JOIN ${invoices} i ON ii.invoiceId = i.id
    WHERE i.type = 'saida' AND i.status = 'concluido'
      ${startDate ? sql`AND COALESCE(i.issueDate, i.createdAt) >= ${toMySQLDate(startDate)}` : sql``}
      ${endDate ? sql`AND COALESCE(i.issueDate, i.createdAt) <= ${toMySQLDate(endDate)}` : sql``}
    GROUP BY ii.productName, ii.productReference
    ORDER BY totalValue DESC
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    productName: String(r.productName),
    productReference: r.productReference ? String(r.productReference) : null,
    totalQty: Number(r.totalQty || 0),
    totalValue: Number(r.totalValue || 0),
    invoiceCount: Number(r.invoiceCount || 0),
  }));
}

/** Get sales summary by client (entity) */
export async function getSalesByClient(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT i.entityName, i.entityDocument, 
           SUM(CAST(i.totalValue AS DECIMAL)) as totalValue,
           COUNT(*) as invoiceCount
    FROM ${invoices} i
    WHERE i.type = 'saida' AND i.status = 'concluido'
      ${startDate ? sql`AND COALESCE(i.issueDate, i.createdAt) >= ${toMySQLDate(startDate)}` : sql``}
      ${endDate ? sql`AND COALESCE(i.issueDate, i.createdAt) <= ${toMySQLDate(endDate)}` : sql``}
    GROUP BY i.entityName, i.entityDocument
    ORDER BY totalValue DESC
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    entityName: String(r.entityName || "Desconhecido"),
    entityDocument: r.entityDocument ? String(r.entityDocument) : null,
    totalValue: Number(r.totalValue || 0),
    invoiceCount: Number(r.invoiceCount || 0),
  }));
}

/** Get purchases summary by supplier */
export async function getPurchasesBySupplier(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT i.entityName, i.entityDocument, 
           SUM(CAST(i.totalValue AS DECIMAL)) as totalValue,
           COUNT(*) as invoiceCount
    FROM ${invoices} i
    WHERE i.type = 'entrada' AND i.status = 'concluido'
      ${startDate ? sql`AND COALESCE(i.issueDate, i.createdAt) >= ${toMySQLDate(startDate)}` : sql``}
      ${endDate ? sql`AND COALESCE(i.issueDate, i.createdAt) <= ${toMySQLDate(endDate)}` : sql``}
    GROUP BY i.entityName, i.entityDocument
    ORDER BY totalValue DESC
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    entityName: String(r.entityName || "Desconhecido"),
    entityDocument: r.entityDocument ? String(r.entityDocument) : null,
    totalValue: Number(r.totalValue || 0),
    invoiceCount: Number(r.invoiceCount || 0),
  }));
}

/** Get purchases summary by material/product */
export async function getPurchasesByMaterial(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT ii.productName, ii.productReference, 
           SUM(CAST(ii.quantity AS DECIMAL)) as totalQty,
           SUM(CAST(ii.totalPrice AS DECIMAL)) as totalValue,
           COUNT(DISTINCT i.id) as invoiceCount
    FROM ${invoiceItems} ii
    JOIN ${invoices} i ON ii.invoiceId = i.id
    WHERE i.type = 'entrada' AND i.status = 'concluido'
      ${startDate ? sql`AND COALESCE(i.issueDate, i.createdAt) >= ${toMySQLDate(startDate)}` : sql``}
      ${endDate ? sql`AND COALESCE(i.issueDate, i.createdAt) <= ${toMySQLDate(endDate)}` : sql``}
    GROUP BY ii.productName, ii.productReference
    ORDER BY totalValue DESC
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    productName: String(r.productName),
    productReference: r.productReference ? String(r.productReference) : null,
    totalQty: Number(r.totalQty || 0),
    totalValue: Number(r.totalValue || 0),
    invoiceCount: Number(r.invoiceCount || 0),
  }));
}

/** List distinct insumo categories */
export async function listInsumoCategories() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ category: insumos.category }).from(insumos).where(sql`${insumos.category} IS NOT NULL AND ${insumos.category} != ''`);
  return rows.map(r => r.category).filter(Boolean) as string[];
}


// ===================== VENDAS ACUMULADAS (CSV Import) =====================

/** Criar lote de importação */
export async function createSalesImportBatch(data: InsertSalesImportBatch) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(salesImportBatches).values(data);
  return result.insertId;
}

/** Listar lotes de importação */
export async function listSalesImportBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salesImportBatches).orderBy(desc(salesImportBatches.createdAt));
}

/** Deletar lote e seus dados */
export async function deleteSalesImportBatch(batchId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(salesData).where(eq(salesData.batchId, batchId));
  await db.delete(salesImportBatches).where(eq(salesImportBatches.id, batchId));
}

/** Inserir dados de vendas em lote */
export async function insertSalesDataBulk(rows: InsertSalesData[]) {
  const db = await getDb();
  if (!db) return;
  // Insert in chunks of 200
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db.insert(salesData).values(chunk);
  }
}

/** Buscar dados de vendas com filtros */
export async function getSalesData(filters: {
  batchId?: number;
  cnpj?: string;
  startDate?: Date;
  endDate?: Date;
  productCode?: string;
  internalCode?: string;
  description?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.batchId) conditions.push(eq(salesData.batchId, filters.batchId));
  if (filters.cnpj) conditions.push(eq(salesData.cnpj, filters.cnpj));
  if (filters.startDate) conditions.push(gte(salesData.saleDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(salesData.saleDate, filters.endDate));
  if (filters.productCode) conditions.push(eq(salesData.productCode, filters.productCode));
  if (filters.internalCode) conditions.push(eq(salesData.internalCode, filters.internalCode));
  if (filters.description) conditions.push(like(salesData.description, `%${filters.description}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(salesData).where(where).orderBy(asc(salesData.saleDate), asc(salesData.internalCode));
}

/** Relatório: Venda por Produto CSV (consolidado) */
export async function getCsvSalesByProduct(filters: {
  batchId?: number;
  cnpj?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.batchId) conditions.push(eq(salesData.batchId, filters.batchId));
  if (filters.cnpj) conditions.push(eq(salesData.cnpj, filters.cnpj));
  if (filters.startDate) conditions.push(gte(salesData.saleDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(salesData.saleDate, filters.endDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    internalCode: salesData.internalCode,
    description: salesData.description,
    totalQuantity: sql<string>`SUM(${salesData.quantity})`.as("totalQuantity"),
    totalValue: sql<string>`SUM(${salesData.grossSale})`.as("totalValue"),
    productCode: salesData.productCode,
  }).from(salesData).where(where)
    .groupBy(salesData.internalCode, salesData.description, salesData.productCode)
    .orderBy(asc(salesData.internalCode));
}

/** Relatório: Resumo geral de vendas */
export async function getSalesSummary(filters: {
  batchId?: number;
  cnpj?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return { totalValue: 0, totalQuantity: 0, totalProducts: 0, totalRecords: 0 };
  const conditions = [];
  if (filters.batchId) conditions.push(eq(salesData.batchId, filters.batchId));
  if (filters.cnpj) conditions.push(eq(salesData.cnpj, filters.cnpj));
  if (filters.startDate) conditions.push(gte(salesData.saleDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(salesData.saleDate, filters.endDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [result] = await db.select({
    totalValue: sql<string>`COALESCE(SUM(${salesData.grossSale}), 0)`.as("totalValue"),
    totalQuantity: sql<string>`COALESCE(SUM(${salesData.quantity}), 0)`.as("totalQuantity"),
    totalProducts: sql<number>`COUNT(DISTINCT ${salesData.internalCode})`.as("totalProducts"),
    totalRecords: sql<number>`COUNT(*)`.as("totalRecords"),
  }).from(salesData).where(where);
  return result;
}

/** Relatório: Cancelamentos (qtd negativa) */
export async function getSalesCancellations(filters: {
  batchId?: number;
  cnpj?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [sql`${salesData.quantity} < 0`];
  if (filters.batchId) conditions.push(eq(salesData.batchId, filters.batchId));
  if (filters.cnpj) conditions.push(eq(salesData.cnpj, filters.cnpj));
  if (filters.startDate) conditions.push(gte(salesData.saleDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(salesData.saleDate, filters.endDate));

  return db.select({
    internalCode: salesData.internalCode,
    description: salesData.description,
    totalQuantity: sql<string>`SUM(${salesData.quantity})`.as("totalQuantity"),
    totalValue: sql<string>`SUM(${salesData.grossSale})`.as("totalValue"),
    productCode: salesData.productCode,
  }).from(salesData).where(and(...conditions))
    .groupBy(salesData.internalCode, salesData.description, salesData.productCode)
    .orderBy(asc(salesData.internalCode));
}

/** Vendas por CNPJ (agrupado) */
export async function getSalesByCnpj(filters: {
  batchId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.batchId) conditions.push(eq(salesData.batchId, filters.batchId));
  if (filters.startDate) conditions.push(gte(salesData.saleDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(salesData.saleDate, filters.endDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    cnpj: salesData.cnpj,
    totalQuantity: sql<string>`SUM(${salesData.quantity})`.as("totalQuantity"),
    totalValue: sql<string>`SUM(${salesData.grossSale})`.as("totalValue"),
    totalRecords: sql<number>`COUNT(*)`.as("totalRecords"),
  }).from(salesData).where(where)
    .groupBy(salesData.cnpj)
    .orderBy(desc(sql`SUM(${salesData.grossSale})`));
}

/** CNPJs distintos nos dados de vendas */
export async function getDistinctSalesCnpjs(batchId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = batchId ? eq(salesData.batchId, batchId) : undefined;
  const rows = await db.selectDistinct({ cnpj: salesData.cnpj }).from(salesData).where(conditions);
  return rows.map(r => r.cnpj);
}

// ===================== COMISSÕES =====================

/** Listar configurações de comissão */
export async function listCommissionConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(commissionConfigs).orderBy(desc(commissionConfigs.createdAt));
}

/** Criar/atualizar configuração de comissão */
export async function upsertCommissionConfig(data: InsertCommissionConfig) {
  const db = await getDb();
  if (!db) return null;
  // Check if exists for this clientName
  const existing = await db.select().from(commissionConfigs).where(eq(commissionConfigs.clientName, data.clientName)).limit(1);
  if (existing.length > 0) {
    await db.update(commissionConfigs).set({ percentage: data.percentage, cnpjPattern: data.cnpjPattern }).where(eq(commissionConfigs.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db.insert(commissionConfigs).values(data);
  return result.insertId;
}

/** Buscar comissão por clientName */
export async function getCommissionByClient(clientName: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(commissionConfigs).where(eq(commissionConfigs.clientName, clientName)).limit(1);
  return rows[0] || null;
}

/** Deletar configuração de comissão */
export async function deleteCommissionConfig(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(commissionConfigs).where(eq(commissionConfigs.id, id));
}


// ============================================================
// CURVA ABC - Análise por Material
// ============================================================

export type CurvaAbcItem = {
  productName: string;
  productReference: string | null;
  totalQty: number;
  totalValue: number;
  invoiceCount: number;
  percentQty: number;
  percentValue: number;
  accumQty: number;
  accumValue: number;
  classQty: "A" | "B" | "C";
  classValue: "A" | "B" | "C";
};

function classifyAbc(accumPercent: number): "A" | "B" | "C" {
  if (accumPercent <= 80) return "A";
  if (accumPercent <= 95) return "B";
  return "C";
}

/** Curva ABC de vendas por material - retorna dados ordenados por valor ou quantidade */
export async function getCurvaAbcVendas(startDate?: Date, endDate?: Date): Promise<CurvaAbcItem[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT ii.productName, ii.productReference, 
           SUM(CAST(ii.quantity AS DECIMAL)) as totalQty,
           SUM(CAST(ii.totalPrice AS DECIMAL)) as totalValue,
           COUNT(DISTINCT i.id) as invoiceCount
    FROM ${invoiceItems} ii
    JOIN ${invoices} i ON ii.invoiceId = i.id
    WHERE i.type = 'saida' AND i.status = 'concluido'
      AND CAST(ii.quantity AS DECIMAL) > 0
      ${startDate ? sql`AND COALESCE(i.issueDate, i.createdAt) >= ${toMySQLDate(startDate)}` : sql``}
      ${endDate ? sql`AND COALESCE(i.issueDate, i.createdAt) <= ${toMySQLDate(endDate)}` : sql``}
    GROUP BY ii.productName, ii.productReference
    HAVING totalQty > 0 AND totalValue > 0
    ORDER BY totalValue DESC
  `);

  const rawItems = ((rows as any)[0] as any[]).map((r: any) => ({
    productName: String(r.productName),
    productReference: r.productReference ? String(r.productReference) : null,
    totalQty: Number(r.totalQty || 0),
    totalValue: Number(r.totalValue || 0),
    invoiceCount: Number(r.invoiceCount || 0),
  }));

  const grandTotalValue = rawItems.reduce((s, i) => s + i.totalValue, 0);
  const grandTotalQty = rawItems.reduce((s, i) => s + i.totalQty, 0);

  if (grandTotalValue === 0 && grandTotalQty === 0) return [];

  // Sort by value for value classification
  const sortedByValue = [...rawItems].sort((a, b) => b.totalValue - a.totalValue);
  let accumValue = 0;
  const valueMap = new Map<string, { accumValue: number; classValue: "A" | "B" | "C"; percentValue: number }>();
  for (const item of sortedByValue) {
    const pv = grandTotalValue > 0 ? (item.totalValue / grandTotalValue) * 100 : 0;
    accumValue += pv;
    valueMap.set(item.productName + "|" + (item.productReference || ""), {
      accumValue,
      classValue: classifyAbc(accumValue),
      percentValue: pv,
    });
  }

  // Sort by quantity for quantity classification
  const sortedByQty = [...rawItems].sort((a, b) => b.totalQty - a.totalQty);
  let accumQty = 0;
  const qtyMap = new Map<string, { accumQty: number; classQty: "A" | "B" | "C"; percentQty: number }>();
  for (const item of sortedByQty) {
    const pq = grandTotalQty > 0 ? (item.totalQty / grandTotalQty) * 100 : 0;
    accumQty += pq;
    qtyMap.set(item.productName + "|" + (item.productReference || ""), {
      accumQty,
      classQty: classifyAbc(accumQty),
      percentQty: pq,
    });
  }

  // Merge both classifications - default sort by value
  return sortedByValue.map((item) => {
    const key = item.productName + "|" + (item.productReference || "");
    const vd = valueMap.get(key)!;
    const qd = qtyMap.get(key)!;
    return {
      ...item,
      percentValue: vd.percentValue,
      accumValue: vd.accumValue,
      classValue: vd.classValue,
      percentQty: qd.percentQty,
      accumQty: qd.accumQty,
      classQty: qd.classQty,
    };
  });
}

/** Curva ABC de compras por material */
export async function getCurvaAbcCompras(startDate?: Date, endDate?: Date): Promise<CurvaAbcItem[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT ii.productName, ii.productReference, 
           SUM(CAST(ii.quantity AS DECIMAL)) as totalQty,
           SUM(CAST(ii.totalPrice AS DECIMAL)) as totalValue,
           COUNT(DISTINCT i.id) as invoiceCount
    FROM ${invoiceItems} ii
    JOIN ${invoices} i ON ii.invoiceId = i.id
    WHERE i.type = 'entrada' AND i.status = 'concluido'
      AND CAST(ii.quantity AS DECIMAL) > 0
      ${startDate ? sql`AND COALESCE(i.issueDate, i.createdAt) >= ${toMySQLDate(startDate)}` : sql``}
      ${endDate ? sql`AND COALESCE(i.issueDate, i.createdAt) <= ${toMySQLDate(endDate)}` : sql``}
    GROUP BY ii.productName, ii.productReference
    HAVING totalQty > 0 AND totalValue > 0
    ORDER BY totalValue DESC
  `);

  const rawItems = ((rows as any)[0] as any[]).map((r: any) => ({
    productName: String(r.productName),
    productReference: r.productReference ? String(r.productReference) : null,
    totalQty: Number(r.totalQty || 0),
    totalValue: Number(r.totalValue || 0),
    invoiceCount: Number(r.invoiceCount || 0),
  }));

  const grandTotalValue = rawItems.reduce((s, i) => s + i.totalValue, 0);
  const grandTotalQty = rawItems.reduce((s, i) => s + i.totalQty, 0);

  if (grandTotalValue === 0 && grandTotalQty === 0) return [];

  const sortedByValue = [...rawItems].sort((a, b) => b.totalValue - a.totalValue);
  let accumValue = 0;
  const valueMap = new Map<string, { accumValue: number; classValue: "A" | "B" | "C"; percentValue: number }>();
  for (const item of sortedByValue) {
    const pv = grandTotalValue > 0 ? (item.totalValue / grandTotalValue) * 100 : 0;
    accumValue += pv;
    valueMap.set(item.productName + "|" + (item.productReference || ""), {
      accumValue,
      classValue: classifyAbc(accumValue),
      percentValue: pv,
    });
  }

  const sortedByQty = [...rawItems].sort((a, b) => b.totalQty - a.totalQty);
  let accumQtyVal = 0;
  const qtyMap = new Map<string, { accumQty: number; classQty: "A" | "B" | "C"; percentQty: number }>();
  for (const item of sortedByQty) {
    const pq = grandTotalQty > 0 ? (item.totalQty / grandTotalQty) * 100 : 0;
    accumQtyVal += pq;
    qtyMap.set(item.productName + "|" + (item.productReference || ""), {
      accumQty: accumQtyVal,
      classQty: classifyAbc(accumQtyVal),
      percentQty: pq,
    });
  }

  return sortedByValue.map((item) => {
    const key = item.productName + "|" + (item.productReference || "");
    const vd = valueMap.get(key)!;
    const qd = qtyMap.get(key)!;
    return {
      ...item,
      percentValue: vd.percentValue,
      accumValue: vd.accumValue,
      classValue: vd.classValue,
      percentQty: qd.percentQty,
      accumQty: qd.accumQty,
      classQty: qd.classQty,
    };
  });
}


// ============================================================
// CURVA ABC - Análise por Insumos
// ============================================================

export type CurvaAbcInsumoItem = {
  insumoId: number;
  insumoName: string;
  category: string | null;
  unit: string;
  currentStock: number;
  unitPrice: number;
  stockValue: number;       // currentStock × unitPrice
  usedInProducts: number;   // quantos produtos usam este insumo
  totalConsumption: number;  // soma de quantityPerUnit × vendas do produto (se houver dados)
  percentValue: number;
  percentStock: number;
  accumValue: number;
  accumStock: number;
  classValue: "A" | "B" | "C";
  classStock: "A" | "B" | "C";
};

/** Curva ABC de insumos — classifica por valor em estoque e por utilização em fichas técnicas */
export async function getCurvaAbcInsumos(): Promise<CurvaAbcInsumoItem[]> {
  const db = await getDb();
  if (!db) return [];

  // Get all insumos with their ficha técnica usage count
  const rows = await db.execute(sql`
    SELECT 
      i.id as insumoId,
      i.name as insumoName,
      i.category,
      i.unit,
      CAST(i.currentStock AS DECIMAL(12,3)) as currentStock,
      CAST(i.unitPrice AS DECIMAL(12,4)) as unitPrice,
      CAST(i.currentStock AS DECIMAL(12,3)) * CAST(i.unitPrice AS DECIMAL(12,4)) as stockValue,
      COUNT(DISTINCT ft.productId) as usedInProducts,
      COALESCE(SUM(CAST(ft.quantityPerUnit AS DECIMAL(12,4))), 0) as totalConsumption
    FROM ${insumos} i
    LEFT JOIN ${fichaTecnica} ft ON ft.insumoId = i.id
    GROUP BY i.id, i.name, i.category, i.unit, i.currentStock, i.unitPrice
    ORDER BY stockValue DESC
  `);

  const rawItems = ((rows as any)[0] as any[]).map((r: any) => ({
    insumoId: Number(r.insumoId),
    insumoName: String(r.insumoName),
    category: r.category ? String(r.category) : null,
    unit: String(r.unit),
    currentStock: Number(r.currentStock || 0),
    unitPrice: Number(r.unitPrice || 0),
    stockValue: Number(r.stockValue || 0),
    usedInProducts: Number(r.usedInProducts || 0),
    totalConsumption: Number(r.totalConsumption || 0),
  }));

  if (rawItems.length === 0) return [];

  const grandTotalValue = rawItems.reduce((s, i) => s + i.stockValue, 0);
  const grandTotalStock = rawItems.reduce((s, i) => s + i.currentStock, 0);

  // Classify by stockValue
  const sortedByValue = [...rawItems].sort((a, b) => b.stockValue - a.stockValue);
  let accumValue = 0;
  const valueMap = new Map<number, { accumValue: number; classValue: "A" | "B" | "C"; percentValue: number }>();
  for (const item of sortedByValue) {
    const pv = grandTotalValue > 0 ? (item.stockValue / grandTotalValue) * 100 : 0;
    accumValue += pv;
    valueMap.set(item.insumoId, {
      accumValue,
      classValue: classifyAbc(accumValue),
      percentValue: pv,
    });
  }

  // Classify by currentStock
  const sortedByStock = [...rawItems].sort((a, b) => b.currentStock - a.currentStock);
  let accumStock = 0;
  const stockMap = new Map<number, { accumStock: number; classStock: "A" | "B" | "C"; percentStock: number }>();
  for (const item of sortedByStock) {
    const ps = grandTotalStock > 0 ? (item.currentStock / grandTotalStock) * 100 : 0;
    accumStock += ps;
    stockMap.set(item.insumoId, {
      accumStock,
      classStock: classifyAbc(accumStock),
      percentStock: ps,
    });
  }

  // Merge — default sort by stockValue
  return sortedByValue.map((item) => {
    const vd = valueMap.get(item.insumoId)!;
    const sd = stockMap.get(item.insumoId)!;
    return {
      ...item,
      percentValue: vd.percentValue,
      accumValue: vd.accumValue,
      classValue: vd.classValue,
      percentStock: sd.percentStock,
      accumStock: sd.accumStock,
      classStock: sd.classStock,
    };
  });
}


// ═══ Relatórios agrupados por Entidade e por Material ═══

export async function getMovementsByEntity(startDate: Date, endDate: Date, type?: string) {
  const db = await getDb();
  if (!db) return [];
  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);

  const rows = await db.execute(sql`
    SELECT 
      i.entityId,
      i.entityName,
      i.entityDocument,
      sm.type,
      COUNT(DISTINCT sm.id) as totalMovements,
      COUNT(DISTINCT sm.productId) as totalProducts,
      COUNT(DISTINCT i.id) as totalInvoices,
      CAST(SUM(CASE WHEN sm.type = 'entrada' THEN CAST(sm.totalPrice AS DECIMAL(14,2)) ELSE 0 END) AS CHAR) as totalEntradas,
      CAST(SUM(CASE WHEN sm.type = 'saida' THEN CAST(sm.totalPrice AS DECIMAL(14,2)) ELSE 0 END) AS CHAR) as totalSaidas,
      CAST(SUM(CASE WHEN sm.type = 'entrada' THEN CAST(sm.quantity AS DECIMAL(12,3)) ELSE 0 END) AS CHAR) as qtdEntradas,
      CAST(SUM(CASE WHEN sm.type = 'saida' THEN CAST(sm.quantity AS DECIMAL(12,3)) ELSE 0 END) AS CHAR) as qtdSaidas
    FROM stock_movements sm
    LEFT JOIN invoices i ON sm.invoiceId = i.id
    WHERE COALESCE(sm.movementDate, sm.createdAt) >= ${startStr}
      AND COALESCE(sm.movementDate, sm.createdAt) <= ${endStr}
      ${type && type !== "all" ? sql`AND sm.type = ${type}` : sql``}
    GROUP BY i.entityId, i.entityName, i.entityDocument, sm.type
    ORDER BY 
      CASE WHEN sm.type = 'saida' THEN 0 ELSE 1 END,
      SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) DESC
  `);

  // Aggregate by entity (combine entrada/saida rows)
  const entityMap = new Map<string, {
    entityId: number | null;
    entityName: string;
    entityDocument: string;
    totalEntradas: number;
    totalSaidas: number;
    qtdEntradas: number;
    qtdSaidas: number;
    totalMovements: number;
    totalProducts: number;
    totalInvoices: number;
  }>();

  for (const row of (rows[0] as unknown as any[])) {
    const key = row.entityDocument || row.entityName || "Sem entidade";
    const existing = entityMap.get(key);
    if (existing) {
      existing.totalEntradas += parseFloat(row.totalEntradas || "0");
      existing.totalSaidas += parseFloat(row.totalSaidas || "0");
      existing.qtdEntradas += parseFloat(row.qtdEntradas || "0");
      existing.qtdSaidas += parseFloat(row.qtdSaidas || "0");
      existing.totalMovements += parseInt(row.totalMovements || "0");
      existing.totalProducts = Math.max(existing.totalProducts, parseInt(row.totalProducts || "0"));
      existing.totalInvoices += parseInt(row.totalInvoices || "0");
    } else {
      entityMap.set(key, {
        entityId: row.entityId,
        entityName: row.entityName || "Sem entidade",
        entityDocument: row.entityDocument || "",
        totalEntradas: parseFloat(row.totalEntradas || "0"),
        totalSaidas: parseFloat(row.totalSaidas || "0"),
        qtdEntradas: parseFloat(row.qtdEntradas || "0"),
        qtdSaidas: parseFloat(row.qtdSaidas || "0"),
        totalMovements: parseInt(row.totalMovements || "0"),
        totalProducts: parseInt(row.totalProducts || "0"),
        totalInvoices: parseInt(row.totalInvoices || "0"),
      });
    }
  }

  return Array.from(entityMap.values()).sort((a, b) => 
    (b.totalEntradas + b.totalSaidas) - (a.totalEntradas + a.totalSaidas)
  );
}

export async function getEntityDrillDown(startDate: Date, endDate: Date, entityId?: number, entityDocument?: string) {
  const db = await getDb();
  if (!db) return [];
  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);

  const conditions = [
    sql`COALESCE(sm.movementDate, sm.createdAt) >= ${startStr}`,
    sql`COALESCE(sm.movementDate, sm.createdAt) <= ${endStr}`,
  ];
  if (entityId) conditions.push(sql`i.entityId = ${entityId}`);
  else if (entityDocument) conditions.push(sql`i.entityDocument = ${entityDocument}`);

  const rows = await db.execute(sql`
    SELECT 
      p.id as productId,
      p.name as productName,
      p.reference,
      sm.type,
      CAST(SUM(CAST(sm.quantity AS DECIMAL(12,3))) AS CHAR) as totalQtd,
      CAST(SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) AS CHAR) as totalValue,
      COUNT(*) as movCount
    FROM stock_movements sm
    LEFT JOIN products p ON sm.productId = p.id
    LEFT JOIN invoices i ON sm.invoiceId = i.id
    WHERE ${and(...conditions)}
    GROUP BY p.id, p.name, p.reference, sm.type
    ORDER BY SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) DESC
  `);

  return (rows[0] as unknown as any[]).map((r: any) => ({
    productId: r.productId,
    productName: r.productName || "Produto desconhecido",
    reference: r.reference || "",
    type: r.type,
    totalQtd: parseFloat(r.totalQtd || "0"),
    totalValue: parseFloat(r.totalValue || "0"),
    movCount: parseInt(r.movCount || "0"),
  }));
}

export async function getMaterialDrillDown(startDate: Date, endDate: Date, productId: number) {
  const db = await getDb();
  if (!db) return [];
  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);

  const rows = await db.execute(sql`
    SELECT 
      i.entityId,
      i.entityName,
      i.entityDocument,
      sm.type,
      CAST(SUM(CAST(sm.quantity AS DECIMAL(12,3))) AS CHAR) as totalQtd,
      CAST(SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) AS CHAR) as totalValue,
      COUNT(*) as movCount,
      MAX(COALESCE(sm.movementDate, sm.createdAt)) as lastDate
    FROM stock_movements sm
    LEFT JOIN invoices i ON sm.invoiceId = i.id
    WHERE COALESCE(sm.movementDate, sm.createdAt) >= ${startStr}
      AND COALESCE(sm.movementDate, sm.createdAt) <= ${endStr}
      AND sm.productId = ${productId}
    GROUP BY i.entityId, i.entityName, i.entityDocument, sm.type
    ORDER BY SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) DESC
  `);

  return (rows[0] as unknown as any[]).map((r: any) => ({
    entityId: r.entityId,
    entityName: r.entityName || "Sem entidade",
    entityDocument: r.entityDocument || "",
    type: r.type,
    totalQtd: parseFloat(r.totalQtd || "0"),
    totalValue: parseFloat(r.totalValue || "0"),
    movCount: parseInt(r.movCount || "0"),
    lastDate: r.lastDate,
  }));
}

export async function getEntitySummaryForList() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT 
      e.id,
      e.name,
      e.document,
      e.type,
      e.createdAt,
      COUNT(DISTINCT i.id) as totalInvoices,
      COUNT(DISTINCT sm.id) as totalMovements,
      CAST(COALESCE(SUM(CASE WHEN sm.type = 'entrada' THEN CAST(sm.totalPrice AS DECIMAL(14,2)) ELSE 0 END), 0) AS CHAR) as totalCompras,
      CAST(COALESCE(SUM(CASE WHEN sm.type = 'saida' THEN CAST(sm.totalPrice AS DECIMAL(14,2)) ELSE 0 END), 0) AS CHAR) as totalVendas,
      MAX(COALESCE(sm.movementDate, sm.createdAt)) as lastMovement
    FROM entities e
    LEFT JOIN invoices i ON e.id = i.entityId
    LEFT JOIN stock_movements sm ON i.id = sm.invoiceId
    GROUP BY e.id, e.name, e.document, e.type, e.createdAt
    ORDER BY e.type, e.name
  `);

  return (rows[0] as unknown as any[]).map((r: any) => ({
    id: r.id,
    name: r.name,
    document: r.document || "",
    type: r.type,
    createdAt: r.createdAt,
    totalInvoices: parseInt(r.totalInvoices || "0"),
    totalMovements: parseInt(r.totalMovements || "0"),
    totalCompras: parseFloat(r.totalCompras || "0"),
    totalVendas: parseFloat(r.totalVendas || "0"),
    lastMovement: r.lastMovement,
  }));
}


// ─── Ranking de Clientes/Fornecedores ────────────────────
export async function getEntityRanking(startDate: Date, endDate: Date, entityType?: string) {
  const db = await getDb();
  if (!db) return [];
  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);

  const rows = await db.execute(sql`
    SELECT 
      i.entityId,
      i.entityName,
      i.entityDocument,
      COUNT(DISTINCT i.id) as totalInvoices,
      COUNT(DISTINCT sm.id) as totalMovements,
      COUNT(DISTINCT sm.productId) as totalProducts,
      CAST(SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) AS CHAR) as totalValue,
      CAST(SUM(CAST(sm.quantity AS DECIMAL(12,3))) AS CHAR) as totalQtd,
      MIN(COALESCE(sm.movementDate, sm.createdAt)) as firstDate,
      MAX(COALESCE(sm.movementDate, sm.createdAt)) as lastDate
    FROM stock_movements sm
    LEFT JOIN invoices i ON sm.invoiceId = i.id
    WHERE COALESCE(sm.movementDate, sm.createdAt) >= ${startStr}
      AND COALESCE(sm.movementDate, sm.createdAt) <= ${endStr}
      AND i.entityName IS NOT NULL
      ${entityType === "fornecedor" ? sql`AND sm.type = 'entrada'` : sql``}
      ${entityType === "cliente" ? sql`AND sm.type = 'saida'` : sql``}
    GROUP BY i.entityId, i.entityName, i.entityDocument
    ORDER BY SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) DESC
  `);

  return (rows[0] as unknown as any[]).map((r: any, idx: number) => ({
    rank: idx + 1,
    entityId: r.entityId,
    entityName: r.entityName || "Sem nome",
    entityDocument: r.entityDocument || "",
    totalInvoices: parseInt(r.totalInvoices || "0"),
    totalMovements: parseInt(r.totalMovements || "0"),
    totalProducts: parseInt(r.totalProducts || "0"),
    totalValue: parseFloat(r.totalValue || "0"),
    totalQtd: parseFloat(r.totalQtd || "0"),
    ticketMedio: parseFloat(r.totalValue || "0") / Math.max(parseInt(r.totalInvoices || "1"), 1),
    firstDate: r.firstDate,
    lastDate: r.lastDate,
  }));
}

// ─── Movimentações agrupadas por Material (para relatórios) ────────────────────
export async function getMovementsByMaterial(startDate: Date, endDate: Date, type?: string) {
  const db = await getDb();
  if (!db) return [];
  const startStr = toMySQLDate(startDate);
  const endStr = toMySQLDate(endDate);

  const rows = await db.execute(sql`
    SELECT 
      p.id as productId,
      p.name as productName,
      p.reference,
      p.category,
      COUNT(DISTINCT sm.id) as totalMovements,
      COUNT(DISTINCT i.entityId) as totalEntities,
      CAST(SUM(CASE WHEN sm.type = 'entrada' THEN CAST(sm.totalPrice AS DECIMAL(14,2)) ELSE 0 END) AS CHAR) as totalEntradas,
      CAST(SUM(CASE WHEN sm.type = 'saida' THEN CAST(sm.totalPrice AS DECIMAL(14,2)) ELSE 0 END) AS CHAR) as totalSaidas,
      CAST(SUM(CASE WHEN sm.type = 'entrada' THEN CAST(sm.quantity AS DECIMAL(12,3)) ELSE 0 END) AS CHAR) as qtdEntradas,
      CAST(SUM(CASE WHEN sm.type = 'saida' THEN CAST(sm.quantity AS DECIMAL(12,3)) ELSE 0 END) AS CHAR) as qtdSaidas,
      GROUP_CONCAT(DISTINCT i.entityName SEPARATOR ', ') as entityNames
    FROM stock_movements sm
    LEFT JOIN products p ON sm.productId = p.id
    LEFT JOIN invoices i ON sm.invoiceId = i.id
    WHERE COALESCE(sm.movementDate, sm.createdAt) >= ${startStr}
      AND COALESCE(sm.movementDate, sm.createdAt) <= ${endStr}
      ${type && type !== "all" ? sql`AND sm.type = ${type}` : sql``}
    GROUP BY p.id, p.name, p.reference, p.category
    ORDER BY SUM(CAST(sm.totalPrice AS DECIMAL(14,2))) DESC
  `);

  return (rows[0] as unknown as any[]).map((r: any) => ({
    productId: r.productId,
    productName: r.productName || "Produto desconhecido",
    reference: r.reference || "",
    category: r.category || "",
    totalMovements: parseInt(r.totalMovements || "0"),
    totalEntities: parseInt(r.totalEntities || "0"),
    totalEntradas: parseFloat(r.totalEntradas || "0"),
    totalSaidas: parseFloat(r.totalSaidas || "0"),
    qtdEntradas: parseFloat(r.qtdEntradas || "0"),
    qtdSaidas: parseFloat(r.qtdSaidas || "0"),
    entityNames: r.entityNames || "",
  }));
}


// ═══════════════════════════════════════════════════════════
// DASHBOARD EXECUTIVO
// ═══════════════════════════════════════════════════════════

/** Margem bruta por produto: custo ficha técnica vs preço de venda (lastPrice) */
export async function getMargemBrutaProdutos() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT 
      p.id as productId,
      p.name as productName,
      p.reference,
      p.category,
      CAST(p.lastPrice AS DECIMAL(12,2)) as salePrice,
      CAST(p.currentStock AS DECIMAL(12,3)) as currentStock,
      COALESCE(SUM(CAST(ft.quantityPerUnit AS DECIMAL(12,4)) * CAST(i.unitPrice AS DECIMAL(12,4))), 0) as productionCost,
      COUNT(DISTINCT ft.id) as insumoCount
    FROM ${products} p
    LEFT JOIN ${fichaTecnica} ft ON ft.productId = p.id
    LEFT JOIN ${insumos} i ON ft.insumoId = i.id
    GROUP BY p.id, p.name, p.reference, p.category, p.lastPrice, p.currentStock
    HAVING salePrice > 0 OR productionCost > 0
    ORDER BY p.name
  `);
  return ((rows as any)[0] as any[]).map((r: any) => {
    const sale = Number(r.salePrice || 0);
    const cost = Number(r.productionCost || 0);
    const margin = sale - cost;
    const marginPct = sale > 0 ? (margin / sale) * 100 : 0;
    return {
      productId: Number(r.productId),
      productName: String(r.productName || ""),
      reference: r.reference ? String(r.reference) : null,
      category: r.category ? String(r.category) : null,
      salePrice: sale,
      productionCost: cost,
      margin,
      marginPercent: marginPct,
      currentStock: Number(r.currentStock || 0),
      insumoCount: Number(r.insumoCount || 0),
    };
  });
}

/** Evolução mensal de faturamento — últimos 12 meses (vendas = saídas) */
export async function getMonthlyRevenue() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT 
      DATE_FORMAT(COALESCE(i.issueDate, i.createdAt), '%Y-%m') as yearMonth,
      CAST(SUM(CASE WHEN i.type = 'saida' THEN CAST(i.totalValue AS DECIMAL(14,2)) ELSE 0 END) AS CHAR) as vendas,
      CAST(SUM(CASE WHEN i.type = 'entrada' THEN CAST(i.totalValue AS DECIMAL(14,2)) ELSE 0 END) AS CHAR) as compras,
      COUNT(DISTINCT CASE WHEN i.type = 'saida' THEN i.id END) as notasVenda,
      COUNT(DISTINCT CASE WHEN i.type = 'entrada' THEN i.id END) as notasCompra
    FROM ${invoices} i
    WHERE i.status = 'concluido'
      AND COALESCE(i.issueDate, i.createdAt) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY yearMonth
    ORDER BY yearMonth ASC
  `);
  return ((rows as any)[0] as any[]).map((r: any) => ({
    yearMonth: String(r.yearMonth),
    vendas: parseFloat(r.vendas || "0"),
    compras: parseFloat(r.compras || "0"),
    notasVenda: parseInt(r.notasVenda || "0"),
    notasCompra: parseInt(r.notasCompra || "0"),
    resultado: parseFloat(r.vendas || "0") - parseFloat(r.compras || "0"),
  }));
}

/** Alertas de insumos classe A com estoque baixo */
export async function getInsumosClasseABaixoEstoque() {
  const db = await getDb();
  if (!db) return [];
  // First get all insumos with stockValue
  const rows = await db.execute(sql`
    SELECT 
      i.id,
      i.name,
      i.category,
      i.unit,
      CAST(i.currentStock AS DECIMAL(12,3)) as currentStock,
      CAST(i.minStock AS DECIMAL(12,3)) as minStock,
      CAST(i.unitPrice AS DECIMAL(12,4)) as unitPrice,
      CAST(i.currentStock AS DECIMAL(12,3)) * CAST(i.unitPrice AS DECIMAL(12,4)) as stockValue,
      COUNT(DISTINCT ft.productId) as usedInProducts
    FROM ${insumos} i
    LEFT JOIN ${fichaTecnica} ft ON ft.insumoId = i.id
    GROUP BY i.id, i.name, i.category, i.unit, i.currentStock, i.minStock, i.unitPrice
    ORDER BY stockValue DESC
  `);

  const allInsumos = ((rows as any)[0] as any[]).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    category: r.category ? String(r.category) : null,
    unit: String(r.unit),
    currentStock: Number(r.currentStock || 0),
    minStock: Number(r.minStock || 0),
    unitPrice: Number(r.unitPrice || 0),
    stockValue: Number(r.stockValue || 0),
    usedInProducts: Number(r.usedInProducts || 0),
  }));

  if (allInsumos.length === 0) return [];

  // Classify by stockValue (same logic as curva ABC)
  const grandTotal = allInsumos.reduce((s, i) => s + i.stockValue, 0);
  const sorted = [...allInsumos].sort((a, b) => b.stockValue - a.stockValue);
  let accum = 0;
  const classeAIds = new Set<number>();
  for (const item of sorted) {
    const pv = grandTotal > 0 ? (item.stockValue / grandTotal) * 100 : 0;
    accum += pv;
    if (accum <= 80) {
      classeAIds.add(item.id);
    } else {
      break;
    }
  }

  // Filter: classe A AND (currentStock <= minStock OR currentStock == 0)
  return allInsumos
    .filter(i => classeAIds.has(i.id) && (i.currentStock <= i.minStock || i.currentStock === 0))
    .map(i => ({
      ...i,
      status: i.currentStock === 0 ? "zerado" : i.currentStock <= i.minStock ? "abaixo_minimo" : "ok",
      deficit: Math.max(0, i.minStock - i.currentStock),
    }));
}

// ─── Invoice Duplicate Detection ─────────────────────────
import crypto from "crypto";

/**
 * Calculate a hash fingerprint for an invoice based on key fields
 * Hash is based on: invoiceNumber + invoiceSeries + entityDocument + issueDate + totalValue
 */
export function calculateInvoiceHash(data: {
  invoiceNumber?: string | null;
  invoiceSeries?: string | null;
  entityDocument?: string | null;
  issueDate?: Date | null;
  totalValue?: string | number | null;
}): string {
  const hashInput = [
    data.invoiceNumber || "",
    data.invoiceSeries || "",
    data.entityDocument || "",
    data.issueDate ? data.issueDate.toISOString().split("T")[0] : "",
    data.totalValue || "0"
  ].join("|");
  
  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Check if an invoice with the same hash already exists
 */
export async function checkInvoiceDuplicate(hash: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const existing = await db.select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.invoiceHash, hash))
    .limit(1);
  
  return existing.length > 0;
}

/**
 * Get existing invoice by hash if it exists
 */
export async function getInvoiceByHash(hash: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select()
    .from(invoices)
    .where(eq(invoices.invoiceHash, hash))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}
