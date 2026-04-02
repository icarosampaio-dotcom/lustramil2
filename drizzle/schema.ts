import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 100 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Fornecedores e clientes
 */
export const entities = mysqlTable("entities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["fornecedor", "cliente"]).notNull(),
  document: varchar("document", { length: 20 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type InsertEntity = typeof entities.$inferInsert;

/**
 * Produtos
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  reference: varchar("reference", { length: 100 }),
  barcode: varchar("barcode", { length: 50 }),
  category: varchar("category", { length: 100 }),
  unit: varchar("unit", { length: 20 }).default("un").notNull(),
  currentStock: decimal("currentStock", { precision: 12, scale: 3 }).default("0").notNull(),
  minStock: decimal("minStock", { precision: 12, scale: 3 }).default("0").notNull(),
  lastPrice: decimal("lastPrice", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Notas Fiscais
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }),
  invoiceSeries: varchar("invoiceSeries", { length: 10 }),
  type: mysqlEnum("type", ["entrada", "saida"]).notNull(),
  entityId: int("entityId"),
  entityName: varchar("entityName", { length: 255 }),
  entityDocument: varchar("entityDocument", { length: 20 }),
  issueDate: timestamp("issueDate"),
  totalValue: decimal("totalValue", { precision: 14, scale: 2 }).default("0"),
  invoiceHash: varchar("invoiceHash", { length: 64 }).unique(),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  status: mysqlEnum("status", ["processando", "concluido", "erro"]).default("processando").notNull(),
  rawExtraction: text("rawExtraction"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Itens da Nota Fiscal
 */
export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 255 }).notNull(),
  productReference: varchar("productReference", { length: 100 }),
  cfop: varchar("cfop", { length: 10 }),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }),
  totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }),
  unit: varchar("unit", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

/**
 * Movimentações de estoque
 */
export const stockMovements = mysqlTable("stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  invoiceId: int("invoiceId"),
  type: mysqlEnum("type", ["entrada", "saida"]).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }),
  totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 3 }),
  cfop: varchar("cfop", { length: 10 }),
  userId: int("userId").notNull(),
  movementDate: timestamp("movementDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;

/**
 * Log de auditoria - rastreia todas as ações críticas do sistema
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  resourceId: int("resourceId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Categorias de gastos
 */
export const expenseCategories = mysqlTable("expense_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["fixa", "variavel"]).default("variavel").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;

/**
 * Contas financeiras (caixa, conta corrente, cartão, etc.)
 */
export const financialAccounts = mysqlTable("financial_accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["caixa", "conta_corrente", "cartao", "poupanca", "outro"]).default("caixa").notNull(),
  initialBalance: decimal("initialBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  currentBalance: decimal("currentBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type InsertFinancialAccount = typeof financialAccounts.$inferInsert;

/**
 * Contas a Pagar
 */
export const accountsPayable = mysqlTable("accounts_payable", {
  id: int("id").autoincrement().primaryKey(),
  description: varchar("description", { length: 500 }).notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", ["pendente", "pago", "vencido"]).default("pendente").notNull(),
  paidDate: timestamp("paidDate"),
  paidValue: decimal("paidValue", { precision: 14, scale: 2 }),
  categoryId: int("categoryId"),
  entityId: int("entityId"),
  entityName: varchar("entityName", { length: 255 }),
  accountId: int("accountId"),
  notes: text("notes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountPayable = typeof accountsPayable.$inferInsert;

/**
 * Contas a Receber
 */
export const accountsReceivable = mysqlTable("accounts_receivable", {
  id: int("id").autoincrement().primaryKey(),
  description: varchar("description", { length: 500 }).notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).notNull(),
  expectedDate: timestamp("expectedDate").notNull(),
  status: mysqlEnum("status", ["pendente", "recebido", "vencido"]).default("pendente").notNull(),
  receivedDate: timestamp("receivedDate"),
  receivedValue: decimal("receivedValue", { precision: 14, scale: 2 }),
  entityId: int("entityId"),
  entityName: varchar("entityName", { length: 255 }),
  accountId: int("accountId"),
  notes: text("notes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountReceivable = typeof accountsReceivable.$inferInsert;

/**
 * Movimentações de Caixa (entradas e saídas diárias)
 */
export const cashMovements = mysqlTable("cash_movements", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  type: mysqlEnum("type", ["entrada", "saida"]).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).notNull(),
  categoryId: int("categoryId"),
  accountId: int("accountId"),
  notes: text("notes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CashMovement = typeof cashMovements.$inferSelect;
export type InsertCashMovement = typeof cashMovements.$inferInsert;

/**
 * Insumos (matérias-primas, embalagens, etiquetas, linhas, etc.)
 */
export const insumos = mysqlTable("insumos", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  unit: varchar("unit", { length: 20 }).default("un").notNull(),
  currentStock: decimal("currentStock", { precision: 12, scale: 3 }).default("0").notNull(),
  minStock: decimal("minStock", { precision: 12, scale: 3 }).default("0").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 4 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Insumo = typeof insumos.$inferSelect;
export type InsertInsumo = typeof insumos.$inferInsert;

/**
 * Ficha Técnica — vincula insumos a um produto acabado com quantidade necessária
 */
export const fichaTecnica = mysqlTable("ficha_tecnica", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  insumoId: int("insumoId").notNull(),
  quantityPerUnit: decimal("quantityPerUnit", { precision: 12, scale: 4 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FichaTecnica = typeof fichaTecnica.$inferSelect;
export type InsertFichaTecnica = typeof fichaTecnica.$inferInsert;

/**
 * Ordens de Produção — registra fabricação de produtos acabados
 */
export const productionOrders = mysqlTable("production_orders", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  status: mysqlEnum("status", ["pendente", "em_producao", "concluida", "cancelada"]).default("pendente").notNull(),
  productionDate: timestamp("productionDate"),
  totalCost: decimal("totalCost", { precision: 14, scale: 2 }),
  notes: text("notes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionOrder = typeof productionOrders.$inferSelect;
export type InsertProductionOrder = typeof productionOrders.$inferInsert;


/**
 * Lotes de importação de vendas (CSV)
 */
export const salesImportBatches = mysqlTable("sales_import_batches", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  clientName: varchar("clientName", { length: 255 }),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  totalRecords: int("totalRecords").default(0).notNull(),
  totalValue: decimal("totalValue", { precision: 14, scale: 2 }).default("0"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SalesImportBatch = typeof salesImportBatches.$inferSelect;
export type InsertSalesImportBatch = typeof salesImportBatches.$inferInsert;

/**
 * Dados de vendas importados (CSV Venda Acumulada)
 */
export const salesData = mysqlTable("sales_data", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  cnpj: varchar("cnpj", { length: 20 }).notNull(),
  saleDate: timestamp("saleDate").notNull(),
  productCode: varchar("productCode", { length: 50 }).notNull(),
  internalCode: varchar("internalCode", { length: 50 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  grossSale: decimal("grossSale", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SalesDataRow = typeof salesData.$inferSelect;
export type InsertSalesData = typeof salesData.$inferInsert;

/**
 * Configurações de comissão por cliente (para Recibo ABC)
 */
export const commissionConfigs = mysqlTable("commission_configs", {
  id: int("id").autoincrement().primaryKey(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  cnpjPattern: varchar("cnpjPattern", { length: 20 }),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CommissionConfig = typeof commissionConfigs.$inferSelect;
export type InsertCommissionConfig = typeof commissionConfigs.$inferInsert;
