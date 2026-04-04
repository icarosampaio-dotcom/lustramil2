import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";
import { logAudit, isAllowedFileType, isAllowedFileSize, sanitizeString } from "./security";
import { parseNFeXml, getEntityFromNFe } from "./nfeParser";
import { generateExcel, generatePDF, generatePayableExcel, generateReceivableExcel, generateCashExcel, generateEntityGroupExcel, generateMaterialGroupExcel, generateRankingExcel, generateCometaPedidosPDF, generateCometaPedidosExcel, generateCometaVendasPDF, generateCometaVendasExcel, type CometaPedidoRelatorio } from "./exportReport";
import { cometaSyncService } from "./cometa-sync-service";

// Helper to get IP from context
function getIp(req: any): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // Never expose passwordHash to the client
      const { passwordHash, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // ─── Local Auth: Login with username/password ──
    localLogin: publicProcedure.input(z.object({
      username: z.string().min(1).max(100),
      password: z.string().min(1).max(255),
    })).mutation(async ({ ctx, input }) => {
      const bcrypt = await import("bcryptjs");
      // Use lowercase trim for case-insensitive matching
      const normalizedUsername = input.username.trim().toLowerCase();
      const user = await db.getUserByUsername(normalizedUsername);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usu\u00e1rio ou senha incorretos." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usu\u00e1rio ou senha incorretos." });
      }

      // Create session token - name MUST be non-empty for verifySession to work
      const { sdk } = await import("./_core/sdk");
      const tokenName = user.name || user.username || "Usuário";
      const token = await sdk.createSessionToken(user.openId, { name: tokenName });

      // Set cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });

      // Update last signed in
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      await logAudit({
        userId: user.id,
        userName: user.name,
        action: "LOGIN",
        resource: "auth",
        resourceId: user.id,
        details: "Login local com usu\u00e1rio/senha",
        ipAddress: getIp(ctx.req),
      });

      return { success: true, user: { id: user.id, name: user.name, role: user.role, username: user.username } };
    }),

    // ─── Change Password ──
    changePassword: protectedProcedure.input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6).max(255),
    })).mutation(async ({ ctx, input }) => {
      const bcrypt = await import("bcryptjs");
      const user = await db.getUserByOpenId(ctx.user.openId);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conta n\u00e3o possui senha local configurada." });
      }

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      }

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await db.updateUserPassword(user.id, newHash);

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "CHANGE_PASSWORD",
        resource: "auth",
        resourceId: ctx.user.id,
        details: "Senha alterada",
        ipAddress: getIp(ctx.req),
      });

      return { success: true };
    }),
  }),

  // ─── Dashboard ──────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    })).query(async ({ input }) => {
      return db.getDashboardStats(input.startDate, input.endDate);
    }),
    recentMovements: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      limit: z.number().int().min(1).max(50).optional(),
    })).query(async ({ input }) => {
      return db.getRecentMovements(input.limit || 15, input.startDate, input.endDate);
    }),
    lowStock: protectedProcedure.query(async () => {
      return db.getLowStockProducts(10);
    }),
    resultadoPeriodo: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    })).query(async ({ input }) => {
      return db.getResultadoPeriodo(input.startDate, input.endDate);
    }),
  }),

  // ─── Products ───────────────────────────────────────
  products: router({
    list: protectedProcedure.query(async () => {
      return db.listProducts();
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      return db.getProduct(input.id);
    }),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(255).optional(),
      category: z.string().max(100).optional(),
      unit: z.string().max(20).optional(),
      minStock: z.number().min(0).max(999999999).optional(),
      barcode: z.string().max(50).optional().nullable(),
      reference: z.string().max(100).optional().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Sanitize string inputs
      if (data.name) data.name = sanitizeString(data.name);
      if (data.category) data.category = sanitizeString(data.category);
      if (data.unit) data.unit = sanitizeString(data.unit);
      if (data.barcode) data.barcode = sanitizeString(data.barcode);
      if (data.reference) data.reference = sanitizeString(data.reference);

      const result = await db.updateProduct(id, data);

      // Audit log
      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "UPDATE",
        resource: "product",
        resourceId: id,
        details: JSON.stringify(data),
        ipAddress: getIp(ctx.req),
      });

      return result;
    }),
    movements: protectedProcedure.input(z.object({
      productId: z.number().int().positive(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    })).query(async ({ input }) => {
      return db.getStockMovements({
        productId: input.productId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),
  }),

  // ─── Entities ───────────────────────────────────────
  entities: router({
    list: protectedProcedure.input(z.object({
      type: z.enum(["fornecedor", "cliente"]).optional(),
    }).optional()).query(async ({ input }) => {
      return db.listEntities(input?.type);
    }),
    listWithSummary: protectedProcedure.query(async () => {
      return db.getEntitySummaryForList();
    }),
  }),

  // ─── Invoices ───────────────────────────────────────
  invoices: router({
    list: protectedProcedure.input(z.object({
      type: z.enum(["entrada", "saida"]).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      entityDocument: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }).optional()).query(async ({ input }) => {
      return db.listInvoices(input);
    }),
    // List distinct CNPJs from invoices for filter dropdown
    cnpjs: protectedProcedure.query(async () => {
      return db.listInvoiceCnpjs();
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const invoice = await db.getInvoice(input.id);
      if (!invoice) return null;
      const items = await db.getInvoiceItems(input.id);
      return { ...invoice, items };
    }),

    // Upload and process invoice — with file validation and audit
    upload: protectedProcedure.input(z.object({
      type: z.enum(["entrada", "saida"]),
      fileBase64: z.string().min(1),
      fileName: z.string().min(1).max(255),
      fileType: z.string().min(1).max(100),
    })).mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const ip = getIp(ctx.req);

      // ── Security: Validate file type ──
      if (!isAllowedFileType(input.fileType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tipo de arquivo não permitido. Use PDF, JPG, PNG, WebP, GIF, BMP, TIFF ou XML.",
        });
      }

      // ── Security: Validate file size (max 20MB) ──
      if (!isAllowedFileSize(input.fileBase64)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Arquivo muito grande. O tamanho máximo permitido é 20MB.",
        });
      }

      // ── Security: Sanitize file name ──
      const safeFileName = input.fileName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .substring(0, 100);

      // 1. Upload file to S3
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `invoices/${userId}/${nanoid()}-${safeFileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.fileType);

      // Audit: log upload
      await logAudit({
        userId,
        userName: ctx.user.name,
        action: "UPLOAD",
        resource: "invoice",
        resourceId: null,
        details: `Tipo: ${input.type}, Arquivo: ${safeFileName}`,
        ipAddress: ip,
      });

      // 2. Create invoice record
      const invoice = await db.createInvoice({
        type: input.type,
        fileUrl,
        fileKey,
        status: "processando",
        userId,
      });

      // 3. Process: XML directly or LLM for images/PDFs
      try {
        const isXml = input.fileType === "application/xml" || input.fileType === "text/xml" || input.fileName.toLowerCase().endsWith(".xml");
        let extractedData: any;

        if (isXml) {
          // Parse XML directly — instant and 100% accurate
          const xmlContent = fileBuffer.toString("utf-8");
          const nfeData = parseNFeXml(xmlContent);
          const entity = getEntityFromNFe(xmlContent, input.type);
          extractedData = {
            invoiceNumber: nfeData.invoiceNumber,
            entityName: entity.name,
            entityDocument: entity.document,
            issueDate: nfeData.issueDate,
            totalValue: nfeData.totalValue,
            items: nfeData.items,
            accessKey: nfeData.accessKey,
            series: nfeData.series,
            nature: nfeData.nature,
            source: "xml",
          };
        } else {
          // Use LLM for images and PDFs
          extractedData = await processInvoiceWithLLM(fileUrl, input.fileType, input.type);
          extractedData.source = "llm";
        }

        // 4. Calculate invoice hash and check for duplicates
        const invoiceHash = db.calculateInvoiceHash({
          invoiceNumber: extractedData.invoiceNumber,
          invoiceSeries: extractedData.series,
          entityDocument: extractedData.entityDocument,
          issueDate: extractedData.issueDate ? new Date(extractedData.issueDate) : null,
          totalValue: extractedData.totalValue,
        });

        const isDuplicate = await db.checkInvoiceDuplicate(invoiceHash);
        if (isDuplicate) {
          const existingInvoice = await db.getInvoiceByHash(invoiceHash);
          // Delete the newly created invoice since it's a duplicate
          await db.updateInvoice(invoice.id, { status: "erro" });
          throw new TRPCError({
            code: "CONFLICT",
            message: `Nota fiscal duplicada! Já existe uma nota com esses dados (ID: ${existingInvoice?.id}). Número: ${extractedData.invoiceNumber}, Data: ${extractedData.issueDate}, Valor: R$ ${extractedData.totalValue}`,
          });
        }

        // 5. Update invoice with extracted data and hash
        const entityType = input.type === "entrada" ? "fornecedor" : "cliente";
        let entityId: number | undefined;

        if (extractedData.entityName) {
          const entity = await db.findOrCreateEntity({
            name: extractedData.entityName,
            type: entityType,
            document: extractedData.entityDocument,
          });
          entityId = entity.id;
        }

        await db.updateInvoice(invoice.id, {
          invoiceNumber: extractedData.invoiceNumber || null,
          invoiceSeries: extractedData.series || null,
          entityId: entityId || null,
          entityName: extractedData.entityName || null,
          entityDocument: extractedData.entityDocument || null,
          issueDate: extractedData.issueDate ? new Date(extractedData.issueDate) : null,
          totalValue: extractedData.totalValue ? String(extractedData.totalValue) : "0",
          invoiceHash: invoiceHash,
          status: "concluido",
          rawExtraction: JSON.stringify(extractedData),
        });

        // 5. Process items
        const invoiceItemsData: any[] = [];
        for (const item of extractedData.items || []) {
          const product = await db.findOrCreateProduct({
            name: item.name,
            unit: item.unit || "un",
            category: "Produtos de Limpeza",
            reference: item.reference || undefined,
          });

          invoiceItemsData.push({
            invoiceId: invoice.id,
            productId: product.id,
            productName: item.name,
            productReference: item.reference || null,
            cfop: item.cfop || null,
            quantity: String(item.quantity || 0),
            unitPrice: item.unitPrice ? String(item.unitPrice) : null,
            totalPrice: item.totalPrice ? String(item.totalPrice) : null,
            unit: item.unit || "un",
          });

          // Update stock
          const quantityChange = input.type === "entrada"
            ? Math.abs(item.quantity || 0)
            : -Math.abs(item.quantity || 0);

          await db.updateProductStock(product.id, quantityChange, item.unitPrice);

          // Record movement - use issueDate from NF as movementDate
          const updatedProduct = await db.getProduct(product.id);
          const movementDate = extractedData.issueDate ? new Date(extractedData.issueDate) : new Date();
          await db.createStockMovement({
            productId: product.id,
            invoiceId: invoice.id,
            type: input.type,
            quantity: String(Math.abs(item.quantity || 0)),
            unitPrice: item.unitPrice ? String(item.unitPrice) : null,
            totalPrice: item.totalPrice ? String(item.totalPrice) : null,
            balanceAfter: updatedProduct?.currentStock || "0",
            cfop: item.cfop || null,
            userId,
            movementDate,
          });
        }

        if (invoiceItemsData.length > 0) {
          await db.createInvoiceItems(invoiceItemsData);
        }

        // Audit: log successful processing
        await logAudit({
          userId,
          userName: ctx.user.name,
          action: "PROCESS_INVOICE",
          resource: "invoice",
          resourceId: invoice.id,
          details: `NF ${extractedData.invoiceNumber || "s/n"} - ${(extractedData.items || []).length} itens processados`,
          ipAddress: ip,
        });

        const updatedInvoice = await db.getInvoice(invoice.id);
        const items = await db.getInvoiceItems(invoice.id);
        return { ...updatedInvoice, items, extractedData };

      } catch (error: any) {
        await db.updateInvoice(invoice.id, {
          status: "erro",
          rawExtraction: JSON.stringify({ error: error.message }),
        });

        // Audit: log error
        await logAudit({
          userId,
          userName: ctx.user.name,
          action: "PROCESS_INVOICE_ERROR",
          resource: "invoice",
          resourceId: invoice.id,
          details: error.message,
          ipAddress: ip,
        });

        throw error;
      }
    }),
  }),

  // ─── Reports ────────────────────────────────────────
  reports: router({
    movements: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      productId: z.number().int().positive().optional(),
      entityId: z.number().int().positive().optional(),
    })).query(async ({ input }) => {
      return db.getMovementReport(input.startDate, input.endDate, input.productId, input.entityId);
    }),
    revenue: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    })).query(async ({ input }) => {
      return db.getRevenueByPeriod(input.startDate, input.endDate);
    }),
    productSales: protectedProcedure.input(z.object({
      productId: z.number().int().positive(),
      startDate: z.date(),
      endDate: z.date(),
    })).query(async ({ input }) => {
      return db.getProductSalesByMonth(input.productId, input.startDate, input.endDate);
    }),

    monthlyComparison: protectedProcedure.query(async () => {
      return db.getMonthlyComparison();
    }),

    exportExcel: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      viewMode: z.enum(["financeiro", "quantidade"]).optional(),
      productId: z.number().int().positive().optional(),
      entityId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      const movements = await db.getMovementReport(input.startDate, input.endDate, input.productId, input.entityId);
      const buffer = await generateExcel(movements, input.startDate, input.endDate, input.viewMode || "financeiro");
      const base64 = buffer.toString("base64");

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "EXPORT",
        resource: "report",
        resourceId: null,
        details: `Exporta\u00e7\u00e3o Excel: ${input.startDate.toISOString().split("T")[0]} a ${input.endDate.toISOString().split("T")[0]}`,
        ipAddress: getIp(ctx.req),
      });

      return {
        base64,
        filename: `relatorio-estoque-${input.startDate.toISOString().split("T")[0]}-a-${input.endDate.toISOString().split("T")[0]}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),

    exportPDF: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      viewMode: z.enum(["financeiro", "quantidade"]).optional(),
      productId: z.number().int().positive().optional(),
      entityId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      const movements = await db.getMovementReport(input.startDate, input.endDate, input.productId, input.entityId);
      const buffer = await generatePDF(movements, input.startDate, input.endDate, input.viewMode || "financeiro");
      const base64 = buffer.toString("base64");

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "EXPORT",
        resource: "report",
        resourceId: null,
        details: `Exportação PDF: ${input.startDate.toISOString().split("T")[0]} a ${input.endDate.toISOString().split("T")[0]}`,
        ipAddress: getIp(ctx.req),
      });

      return {
        base64,
        filename: `relatorio-estoque-${input.startDate.toISOString().split("T")[0]}-a-${input.endDate.toISOString().split("T")[0]}.pdf`,
        mimeType: "application/pdf",
      };
    }),

    curvaAbcVendas: protectedProcedure.input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    })).query(async ({ input }) => {
      return db.getCurvaAbcVendas(input.startDate, input.endDate);
    }),

    curvaAbcCompras: protectedProcedure.input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    })).query(async ({ input }) => {
      return db.getCurvaAbcCompras(input.startDate, input.endDate);
    }),

    curvaAbcInsumos: protectedProcedure.query(async () => {
      return db.getCurvaAbcInsumos();
    }),

    // ─── Relatórios agrupados por Entidade ─────────────────
    movementsByEntity: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      type: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getMovementsByEntity(input.startDate, input.endDate, input.type);
    }),

    entityDrillDown: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      entityId: z.number().optional(),
      entityDocument: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getEntityDrillDown(input.startDate, input.endDate, input.entityId, input.entityDocument);
    }),

    materialDrillDown: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      productId: z.number(),
    })).query(async ({ input }) => {
      return db.getMaterialDrillDown(input.startDate, input.endDate, input.productId);
    }),

    // ─── Ranking ─────────────────────────
    entityRanking: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      entityType: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getEntityRanking(input.startDate, input.endDate, input.entityType);
    }),

    // ─── Movimentações por Material ─────────────────────────
    movementsByMaterial: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      type: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getMovementsByMaterial(input.startDate, input.endDate, input.type);
    }),

    // ─── Exportação: Por Fornecedor/Cliente ─────────────────────────
    exportEntityGroupExcel: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      type: z.string().optional(),
    })).mutation(async ({ input }) => {
      const entities = await db.getMovementsByEntity(input.startDate, input.endDate, input.type);
      const buffer = await generateEntityGroupExcel(entities, input.startDate, input.endDate);
      return {
        data: buffer.toString("base64"),
        filename: `relatorio-por-fornecedor-${input.startDate.toISOString().split("T")[0]}-a-${input.endDate.toISOString().split("T")[0]}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),

    // ─── Exportação: Por Material ─────────────────────────
    exportMaterialGroupExcel: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      type: z.string().optional(),
    })).mutation(async ({ input }) => {
      const materials = await db.getMovementsByMaterial(input.startDate, input.endDate, input.type);
      const buffer = await generateMaterialGroupExcel(materials, input.startDate, input.endDate);
      return {
        data: buffer.toString("base64"),
        filename: `relatorio-por-material-${input.startDate.toISOString().split("T")[0]}-a-${input.endDate.toISOString().split("T")[0]}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),

    // ─── Dashboard Executivo ─────────────────────────
    margemBrutaProdutos: protectedProcedure.query(async () => {
      return db.getMargemBrutaProdutos();
    }),

    monthlyRevenue: protectedProcedure.query(async () => {
      return db.getMonthlyRevenue();
    }),

    insumosClasseAAlerta: protectedProcedure.query(async () => {
      return db.getInsumosClasseABaixoEstoque();
    }),

    // ─── Exportação: Ranking ─────────────────────────
    exportRankingExcel: protectedProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      entityType: z.string().optional(),
    })).mutation(async ({ input }) => {
      const ranking = await db.getEntityRanking(input.startDate, input.endDate, input.entityType);
      const title = input.entityType === "fornecedor" ? "Ranking de Fornecedores" : input.entityType === "cliente" ? "Ranking de Clientes" : "Ranking Geral";
      const buffer = await generateRankingExcel(ranking, input.startDate, input.endDate, title);
      return {
        data: buffer.toString("base64"),
        filename: `ranking-${input.entityType || "geral"}-${input.startDate.toISOString().split("T")[0]}-a-${input.endDate.toISOString().split("T")[0]}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),
  }),

  // ─── Admin: User Management ─────────────────────────
  admin: router({
    listUsers: adminProcedure.query(async () => {
      return db.listAllUsers();
    }),
    updateUserRole: adminProcedure.input(z.object({
      userId: z.number().int().positive(),
      role: z.enum(["user", "admin"]),
    })).mutation(async ({ ctx, input }) => {
      // Prevent self-demotion
      if (input.userId === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode remover seu próprio acesso de administrador.",
        });
      }

      const result = await db.updateUserRole(input.userId, input.role);

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "UPDATE_ROLE",
        resource: "user",
        resourceId: input.userId,
        details: `Role alterado para: ${input.role}`,
        ipAddress: getIp(ctx.req),
      });

      return result;
    }),
    deleteUser: adminProcedure.input(z.object({
      userId: z.number().int().positive(),
    })).mutation(async ({ ctx, input }) => {
      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode excluir sua própria conta.",
        });
      }

      await db.deleteUser(input.userId);

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "DELETE_USER",
        resource: "user",
        resourceId: input.userId,
        details: null,
        ipAddress: getIp(ctx.req),
      });

      return { success: true };
    }),
    createUser: adminProcedure.input(z.object({
      username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/, "Usuário deve conter apenas letras, números, pontos, hífens ou underscores."),
      name: z.string().min(1).max(255),
      password: z.string().min(6).max(255),
      role: z.enum(["user", "admin"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      // Normalize username to lowercase for consistent matching
      const normalizedUsername = input.username.trim().toLowerCase();

      // Check if username already exists
      const existing = await db.getUserByUsername(normalizedUsername);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Este nome de usuário já está em uso." });
      }

      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(input.password, 12);

      const user = await db.createLocalUser({
        username: normalizedUsername,
        name: sanitizeString(input.name),
        passwordHash: hash,
        role: input.role || "user",
      });

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "CREATE_USER",
        resource: "user",
        resourceId: user?.id || null,
        details: `Usuário criado: ${input.username} (${input.role || "user"})`,
        ipAddress: getIp(ctx.req),
      });

      return user;
    }),
    resetPassword: adminProcedure.input(z.object({
      userId: z.number().int().positive(),
      newPassword: z.string().min(6).max(255),
    })).mutation(async ({ ctx, input }) => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(input.newPassword, 12);
      await db.updateUserPassword(input.userId, hash);

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "RESET_PASSWORD",
        resource: "user",
        resourceId: input.userId,
        details: "Senha resetada pelo admin",
        ipAddress: getIp(ctx.req),
      });

      return { success: true };
    }),
    auditLogs: adminProcedure.input(z.object({
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }).optional()).query(async ({ input }) => {
      return db.getAuditLogs(input?.limit || 50, input?.offset || 0);
    }),

    // ─── Clear All Data (Admin Only) ──
    clearAllData: adminProcedure.mutation(async ({ ctx }) => {
      await db.clearAllData();

      await logAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        action: "CLEAR_ALL_DATA",
        resource: "system",
        resourceId: null,
        details: "Todos os dados do sistema foram limpos pelo administrador",
        ipAddress: getIp(ctx.req),
      });

      return { success: true };
    }),
  }),

  // ─── Invoice Search ────────────────────────────────────
  invoiceSearch: router({
    search: protectedProcedure.input(z.object({
      query: z.string().max(255),
      type: z.enum(["entrada", "saida"]).optional(),
    })).query(async ({ input }) => {
      return db.searchInvoices(sanitizeString(input.query), input.type);
    }),
  }),

  // ==================== CATEGORIAS DE GASTOS ====================
  categories: router({
    list: protectedProcedure.query(async () => {
      return db.listCategories();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["fixa", "variavel"]),
    })).mutation(async ({ input }) => {
      return db.createCategory(input);
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteCategory(input.id);
      return { success: true };
    }),
  }),

  // ==================== CONTAS FINANCEIRAS ====================
  financialAccounts: router({
    list: protectedProcedure.query(async () => {
      return db.listFinancialAccounts();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["caixa", "conta_corrente", "cartao", "poupanca", "outro"]),
      initialBalance: z.string().default("0"),
    })).mutation(async ({ input }) => {
      return db.createFinancialAccount({ ...input, currentBalance: input.initialBalance });
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteFinancialAccount(input.id);
      return { success: true };
    }),
  }),

  // ==================== CONTAS A PAGAR ====================
  accountsPayable: router({
    list: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      status: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.listAccountsPayable(start, end, input?.status);
    }),
    summary: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getAccountsPayableSummary(start, end);
    }),
    upcoming: protectedProcedure.input(z.object({
      days: z.number().default(7),
    }).optional()).query(async ({ input }) => {
      return db.getUpcomingPayables(input?.days || 7);
    }),
    create: protectedProcedure.input(z.object({
      description: z.string().min(1).max(500),
      value: z.string(),
      dueDate: z.number(),
      categoryId: z.number().optional(),
      entityId: z.number().optional(),
      entityName: z.string().optional(),
      accountId: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      return db.createAccountPayable({
        ...input,
        dueDate: new Date(input.dueDate),
        userId: ctx.user.id,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      description: z.string().min(1).max(500).optional(),
      value: z.string().optional(),
      dueDate: z.number().optional(),
      categoryId: z.number().optional(),
      entityName: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
      await db.updateAccountPayable(id, updateData);
      return { success: true };
    }),
    markPaid: protectedProcedure.input(z.object({
      id: z.number(),
      paidDate: z.number(),
      paidValue: z.number(),
      accountId: z.number().optional(),
    })).mutation(async ({ input }) => {
      await db.markAccountPaid(input.id, new Date(input.paidDate), input.paidValue, input.accountId);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteAccountPayable(input.id);
      return { success: true };
    }),
    exportExcel: protectedProcedure.input(z.object({
      startDate: z.number(),
      endDate: z.number(),
      status: z.string().optional(),
    })).query(async ({ input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      const items = await db.listAccountsPayable(start, end, input?.status);
      const categories = await db.listCategories();
      const categoryNames: Record<number, string> = {};
      categories.forEach((c: { id: number; name: string }) => { categoryNames[c.id] = c.name; });
      const buffer = await generatePayableExcel(items, start, end, categoryNames);
      return buffer.toString("base64");
    }),
  }),

  // ==================== CONTAS A RECEBER ====================
  accountsReceivable: router({
    list: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      status: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.listAccountsReceivable(start, end, input?.status);
    }),
    summary: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getAccountsReceivableSummary(start, end);
    }),
    create: protectedProcedure.input(z.object({
      description: z.string().min(1).max(500),
      value: z.string(),
      expectedDate: z.number(),
      entityId: z.number().optional(),
      entityName: z.string().optional(),
      accountId: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      return db.createAccountReceivable({
        ...input,
        expectedDate: new Date(input.expectedDate),
        userId: ctx.user.id,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      description: z.string().min(1).max(500).optional(),
      value: z.string().optional(),
      expectedDate: z.number().optional(),
      entityName: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.expectedDate) updateData.expectedDate = new Date(data.expectedDate);
      await db.updateAccountReceivable(id, updateData);
      return { success: true };
    }),
    markReceived: protectedProcedure.input(z.object({
      id: z.number(),
      receivedDate: z.number(),
      receivedValue: z.number(),
      accountId: z.number().optional(),
    })).mutation(async ({ input }) => {
      await db.markAccountReceived(input.id, new Date(input.receivedDate), input.receivedValue, input.accountId);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteAccountReceivable(input.id);
      return { success: true };
    }),
    exportExcel: protectedProcedure.input(z.object({
      startDate: z.number(),
      endDate: z.number(),
      status: z.string().optional(),
    })).query(async ({ input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      const items = await db.listAccountsReceivable(start, end, input?.status);
      const buffer = await generateReceivableExcel(items, start, end);
      return buffer.toString("base64");
    }),
  }),

  // ==================== INSUMOS ====================
  insumos: router({
    list: protectedProcedure.query(async () => {
      return db.listInsumos();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getInsumo(input.id);
    }),
    categories: protectedProcedure.query(async () => {
      return db.listInsumoCategories();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(255),
      category: z.string().max(100).optional(),
      unit: z.string().max(20).default("un"),
      currentStock: z.string().default("0"),
      minStock: z.string().default("0"),
      unitPrice: z.string().default("0"),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createInsumo(input);
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "CREATE", resource: "insumo", resourceId: result.id,
        details: `Insumo criado: ${input.name}`, ipAddress: getIp(ctx.req),
      });
      return result;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      category: z.string().max(100).optional().nullable(),
      unit: z.string().max(20).optional(),
      currentStock: z.string().optional(),
      minStock: z.string().optional(),
      unitPrice: z.string().optional(),
      notes: z.string().optional().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateInsumo(id, data as any);
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "UPDATE", resource: "insumo", resourceId: id,
        details: JSON.stringify(data), ipAddress: getIp(ctx.req),
      });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteInsumo(input.id);
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "DELETE", resource: "insumo", resourceId: input.id,
        details: null, ipAddress: getIp(ctx.req),
      });
      return { success: true };
    }),
    adjustStock: protectedProcedure.input(z.object({
      id: z.number(),
      quantity: z.number(),
      reason: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateInsumoStock(input.id, input.quantity);
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "ADJUST_STOCK", resource: "insumo", resourceId: input.id,
        details: `Ajuste: ${input.quantity > 0 ? "+" : ""}${input.quantity} - ${input.reason || "Ajuste manual"}`,
        ipAddress: getIp(ctx.req),
      });
      return { success: true };
    }),
  }),

  // ==================== FICHA TÉCNICA ====================
  fichaTecnica: router({
    list: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      return db.listFichaTecnica(input.productId);
    }),
    productCost: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      return db.getProductCost(input.productId);
    }),
    allCosts: protectedProcedure.query(async () => {
      return db.getAllProductCosts();
    }),
    add: protectedProcedure.input(z.object({
      productId: z.number(),
      insumoId: z.number(),
      quantityPerUnit: z.string(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.addFichaTecnicaItem(input);
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "ADD_FICHA", resource: "ficha_tecnica", resourceId: result.id,
        details: `Produto ${input.productId}, Insumo ${input.insumoId}, Qtd ${input.quantityPerUnit}`,
        ipAddress: getIp(ctx.req),
      });
      return result;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      quantityPerUnit: z.string().optional(),
      notes: z.string().optional().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateFichaTecnicaItem(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteFichaTecnicaItem(input.id);
      return { success: true };
    }),
  }),

  // ==================== PRODUÇÃO ====================
  production: router({
    list: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.listProductionOrders(start, end);
    }),
    create: protectedProcedure.input(z.object({
      productId: z.number(),
      quantity: z.string(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createProductionOrder({
        ...input,
        userId: ctx.user.id,
        status: "pendente",
      });
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "CREATE", resource: "production_order", resourceId: result.id,
        details: `Produto ${input.productId}, Qtd ${input.quantity}`,
        ipAddress: getIp(ctx.req),
      });
      return result;
    }),
    execute: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const result = await db.executeProduction(input.id);
      await logAudit({
        userId: ctx.user.id, userName: ctx.user.name,
        action: "EXECUTE_PRODUCTION", resource: "production_order", resourceId: input.id,
        details: `Custo total: R$ ${result.totalCost.toFixed(2)}, Qtd: ${result.quantityProduced}`,
        ipAddress: getIp(ctx.req),
      });
      return result;
    }),
  }),

  // ==================== ANÁLISE DE VENDAS/COMPRAS ====================
  analysis: router({
    salesByProduct: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getSalesByProduct(start, end);
    }),
    salesByClient: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getSalesByClient(start, end);
    }),
    purchasesBySupplier: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getPurchasesBySupplier(start, end);
    }),
    purchasesByMaterial: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getPurchasesByMaterial(start, end);
    }),
    invoicesAdvanced: protectedProcedure.input(z.object({
      type: z.enum(["entrada", "saida"]).optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      entityDocument: z.string().optional(),
      productName: z.string().optional(),
      productReference: z.string().optional(),
      entityId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listInvoicesAdvanced({
        type: input?.type,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        entityDocument: input?.entityDocument,
        productName: input?.productName,
        productReference: input?.productReference,
        entityId: input?.entityId,
      });
    }),
  }),

  // ==================== CAIXA / MOVIMENTAÇÃO DIÁRIA ====================
  cash: router({
    list: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.listCashMovements(start, end);
    }),
    summary: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getCashSummary(start, end);
    }),
    byCategory: protectedProcedure.input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getCashByCategory(start, end);
    }),
    create: protectedProcedure.input(z.object({
      date: z.number(),
      type: z.enum(["entrada", "saida"]),
      description: z.string().min(1).max(500),
      value: z.string(),
      categoryId: z.number().optional(),
      accountId: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      return db.createCashMovement({
        ...input,
        date: new Date(input.date),
        userId: ctx.user.id,
      });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteCashMovement(input.id);
      return { success: true };
    }),
    exportExcel: protectedProcedure.input(z.object({
      startDate: z.number(),
      endDate: z.number(),
    })).query(async ({ input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      const items = await db.listCashMovements(start, end);
      const categories = await db.listCategories();
      const categoryNames: Record<number, string> = {};
      categories.forEach((c: { id: number; name: string }) => { categoryNames[c.id] = c.name; });
      const buffer = await generateCashExcel(items, start, end, categoryNames);
      return buffer.toString("base64");
    }),
  }),

  // ─── Vendas ABC (CSV Import) ────────────────────────────
  salesAbc: router({
    importCsv: protectedProcedure.input(z.object({
      csvContent: z.string(),
      fileName: z.string(),
      clientName: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // Parse CSV
      const lines = input.csvContent.split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo CSV vazio ou inválido" });

      const header = lines[0].split(";").map(h => h.trim());
      const expectedHeaders = ["CNPJ", "DATA VENDA", "COD PROD", "COD INTERNO", "DESC PRODUTO", "QTD VENDA", "VENDA BRUTA"];
      const isValid = expectedHeaders.every((h, i) => header[i]?.toUpperCase().includes(h.substring(0, 4)));
      if (!isValid) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato CSV inválido. Esperado: CNPJ;DATA VENDA;COD PROD;COD INTERNO;DESC PRODUTO;QTD VENDA;VENDA BRUTA" });

      const rows: { cnpj: string; saleDate: Date; productCode: string; internalCode: string; description: string; quantity: string; grossSale: string }[] = [];
      let totalValue = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(";");
        if (cols.length < 7) continue;
        const [cnpj, dateStr, productCode, internalCode, description, qtyStr, valueStr] = cols.map(c => c.trim());
        // Parse date DD/MM/YYYY
        const parts = dateStr.split("/");
        if (parts.length !== 3) continue;
        const saleDate = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
        if (isNaN(saleDate.getTime())) continue;
        const qty = parseFloat(qtyStr.replace(",", "."));
        const val = parseFloat(valueStr.replace(",", "."));
        if (isNaN(qty) || isNaN(val)) continue;
        totalValue += val;
        if (!minDate || saleDate < minDate) minDate = saleDate;
        if (!maxDate || saleDate > maxDate) maxDate = saleDate;
        rows.push({ cnpj, saleDate, productCode, internalCode, description, quantity: qty.toString(), grossSale: val.toFixed(2) });
      }

      if (rows.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum registro válido encontrado no CSV" });

      // Create batch
      const batchId = await db.createSalesImportBatch({
        fileName: input.fileName,
        clientName: input.clientName || null,
        periodStart: minDate,
        periodEnd: maxDate,
        totalRecords: rows.length,
        totalValue: totalValue.toFixed(2),
        userId: ctx.user.id,
      });

      // Insert data
      await db.insertSalesDataBulk(rows.map(r => ({
        batchId: batchId!,
        cnpj: r.cnpj,
        saleDate: r.saleDate,
        productCode: r.productCode,
        internalCode: r.internalCode,
        description: r.description,
        quantity: r.quantity,
        grossSale: r.grossSale,
      })));

      return { batchId, totalRecords: rows.length, totalValue, periodStart: minDate, periodEnd: maxDate };
    }),

    listBatches: protectedProcedure.query(async () => {
      return db.listSalesImportBatches();
    }),

    deleteBatch: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteSalesImportBatch(input.id);
      return { success: true };
    }),

    getData: protectedProcedure.input(z.object({
      batchId: z.number().optional(),
      cnpj: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      productCode: z.string().optional(),
      internalCode: z.string().optional(),
      description: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getSalesData({
        batchId: input.batchId,
        cnpj: input.cnpj,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        productCode: input.productCode,
        internalCode: input.internalCode,
        description: input.description,
      });
    }),

    byProduct: protectedProcedure.input(z.object({
      batchId: z.number().optional(),
      cnpj: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getCsvSalesByProduct({
        batchId: input.batchId,
        cnpj: input.cnpj,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

    summary: protectedProcedure.input(z.object({
      batchId: z.number().optional(),
      cnpj: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getSalesSummary({
        batchId: input.batchId,
        cnpj: input.cnpj,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

    cancellations: protectedProcedure.input(z.object({
      batchId: z.number().optional(),
      cnpj: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getSalesCancellations({
        batchId: input.batchId,
        cnpj: input.cnpj,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

    byCnpj: protectedProcedure.input(z.object({
      batchId: z.number().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getSalesByCnpj({
        batchId: input.batchId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

    distinctCnpjs: protectedProcedure.input(z.object({
      batchId: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getDistinctSalesCnpjs(input.batchId);
    }),
  }),

  // ─── Comissões ────────────────────────────
  commission: router({
    list: protectedProcedure.query(async () => {
      return db.listCommissionConfigs();
    }),
    upsert: protectedProcedure.input(z.object({
      clientName: z.string().min(1),
      cnpjPattern: z.string().optional(),
      percentage: z.string(),
    })).mutation(async ({ input, ctx }) => {
      await db.upsertCommissionConfig({
        clientName: input.clientName,
        cnpjPattern: input.cnpjPattern || null,
        percentage: input.percentage,
        userId: ctx.user.id,
      });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteCommissionConfig(input.id);
      return { success: true };
    }),
    getByClient: protectedProcedure.input(z.object({ clientName: z.string() })).query(async ({ input }) => {
      return db.getCommissionByClient(input.clientName);
    }),
  }),
  // ─── Integração Cometa Supermercados ────────────────────────────
  cometa: router({
    pedidos: protectedProcedure.query(async () => {
      const pedidos = await cometaSyncService.getPedidos();
      // Agrupar itens por número de pedido
      const pedidosMap = new Map<string, any>();
      for (const item of pedidos) {
        const key = item.numero_pedido;
        if (!pedidosMap.has(key)) {
          pedidosMap.set(key, {
            id: item.numero_pedido,
            numero_pedido: item.numero_pedido,
            data: item.data_emissao_pedido,
            loja: `Loja ${item.loja}`,
            loja_numero: item.loja,
            cnpj: item.cnpj,
            status: item.status_pedido === "P" ? "pendente" : "entregue",
            status_raw: item.status_pedido,
            frete: item.frete,
            comprador: item.comprador,
            prazo_pagamento: item.prazo_pagamento,
            observacao: item.observacao,
            produtos: [],
            valor_total: 0,
            total_unidades: 0,
          });
        }
        const pedido = pedidosMap.get(key)!;
        pedido.produtos.push({
          nome: item.descricao_produto,
          codigo: item.codigo_produto,
          ean: item.ean_produto,
          qtd: item.total_unidades,
          qtd_embalagem: item.qtd_embalagem,
          valor_unitario: item.valor_bruto_unitario,
          valor: `R$ ${item.valor_total.toFixed(2).replace(".", ",")}`,
          valor_numerico: item.valor_total,
        });
        pedido.valor_total += item.valor_total;
        pedido.total_unidades += item.total_unidades;
      }
      return Array.from(pedidosMap.values()).map(p => ({
        ...p,
        total: `R$ ${p.valor_total.toFixed(2).replace(".", ",")}`,
        itens: p.produtos.length,
      }));
    }),
    estoque: protectedProcedure.query(async () => {
      const estoque = await cometaSyncService.getEstoque();
      return estoque.map(item => ({
        id: `${item.loja}-${item.codigo_produto}`,
        codigo_produto: item.codigo_produto,
        nome: item.descricao_produto,
        ean: item.ean,
        loja: `Loja ${item.loja}`,
        loja_numero: item.loja,
        quantidade: item.estq_loja,
        quantidade_avaria: item.estq_avaria,
        status: item.estq_loja === 0 ? "zerado" : item.estq_loja < 10 ? "baixo" : "ok",
      }));
    }),
    vendas: protectedProcedure.query(async () => {
      const vendas = await cometaSyncService.getVendas();
      return vendas.map(v => ({
        loja: v.LOJA.LOJA,
        nome_loja: v.LOJA.NOME,
        cnpj: v.LOJA.CNPJ,
        vendas: v.VENDAS.map(item => ({
          data: item.DATA,
          ean: item.EAN,
          cod_interno: item.COD_INTERNO,
          produto: item.PRODUTO,
          qtd: item.QTD,
          venda: item.VENDA,
          custo: item.CUSTO,
        })),
        total_venda: v.VENDAS.reduce((sum, item) => sum + item.VENDA, 0),
        total_itens: v.VENDAS.reduce((sum, item) => sum + item.QTD, 0),
      }));
    }),
    lojas: protectedProcedure.query(async () => {
      return cometaSyncService.getLojas();
    }),
    produtos: protectedProcedure.query(async () => {
      return cometaSyncService.getProdutos();
    }),
    syncStatus: protectedProcedure.query(async () => {
      return cometaSyncService.getSyncStatus();
    }),
    forceSync: protectedProcedure.mutation(async () => {
      cometaSyncService.invalidateCache();
      // Buscar dados imediatamente após invalidar o cache
      try {
        const [pedidos, vendas, estoque] = await Promise.all([
          cometaSyncService.getPedidos(),
          cometaSyncService.getVendas(),
          cometaSyncService.getEstoque(),
        ]);
        return {
          success: true,
          message: `Dados atualizados: ${pedidos.length} pedidos, ${vendas.length} lojas com vendas, ${estoque.length} itens de estoque.`,
          pedidos: pedidos.length,
          vendas: vendas.length,
          estoque: estoque.length,
        };
      } catch (error) {
        return {
          success: false,
          message: `Erro ao buscar dados: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),

    testConnection: protectedProcedure.query(async () => {
      return cometaSyncService.testConnection();
    }),

    exportPedidosPDF: protectedProcedure.input(z.object({
      filtroStatus: z.enum(["pendente", "entregue", "todos"]).default("pendente"),
      filtroLoja: z.number().int().positive().optional(),
      filtroProdutoCodigo: z.string().optional(),
      filtroDataInicio: z.string().optional(),
      filtroDataFim: z.string().optional(),
      filtroSearch: z.string().optional(),
    })).mutation(async ({ input }) => {
      const pedidosRaw = await cometaSyncService.getPedidos();
      const pedidosMap = new Map<string, CometaPedidoRelatorio>();
      for (const item of pedidosRaw) {
        const key = item.numero_pedido;
        if (!pedidosMap.has(key)) {
          pedidosMap.set(key, {
            id: item.numero_pedido,
            numero_pedido: item.numero_pedido,
            data: item.data_emissao_pedido,
            loja: `Loja ${item.loja}`,
            loja_numero: item.loja,
            cnpj: item.cnpj,
            status: item.status_pedido === "P" ? "pendente" : "entregue",
            status_raw: item.status_pedido,
            frete: item.frete,
            comprador: item.comprador,
            prazo_pagamento: item.prazo_pagamento,
            observacao: item.observacao,
            produtos: [],
            valor_total: 0,
            total_unidades: 0,
            total: "",
            itens: 0,
          });
        }
        const pedido = pedidosMap.get(key)!;
        pedido.produtos.push({
          nome: item.descricao_produto,
          codigo: item.codigo_produto,
          ean: item.ean_produto,
          qtd: item.total_unidades,
          qtd_embalagem: item.qtd_embalagem,
          valor_unitario: item.valor_bruto_unitario,
          valor: `R$ ${item.valor_total.toFixed(2).replace(".", ",")}`,
          valor_numerico: item.valor_total,
        });
        pedido.valor_total += item.valor_total;
        pedido.total_unidades += item.total_unidades;
      }
      let pedidos = Array.from(pedidosMap.values()).map(p => ({
        ...p,
        total: `R$ ${p.valor_total.toFixed(2).replace(".", ",")}`,
        itens: p.produtos.length,
      }));

      // Aplicar filtros
      if (input.filtroStatus !== "todos") pedidos = pedidos.filter(p => p.status === input.filtroStatus);
      if (input.filtroLoja) pedidos = pedidos.filter(p => p.loja_numero === input.filtroLoja);
      if (input.filtroProdutoCodigo) pedidos = pedidos.filter(p => p.produtos.some(pr => pr.codigo === input.filtroProdutoCodigo));
      if (input.filtroDataInicio || input.filtroDataFim) {
        pedidos = pedidos.filter(p => {
          const parts = p.data.split("/");
          if (parts.length !== 3) return true;
          const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
          if (input.filtroDataInicio && d < new Date(input.filtroDataInicio)) return false;
          if (input.filtroDataFim && d > new Date(input.filtroDataFim)) return false;
          return true;
        });
      }
      if (input.filtroSearch) {
        const s = input.filtroSearch.toLowerCase();
        pedidos = pedidos.filter(p =>
          p.id.toLowerCase().includes(s) ||
          p.loja.toLowerCase().includes(s) ||
          p.cnpj.includes(s) ||
          p.produtos.some(pr => pr.nome.toLowerCase().includes(s) || pr.codigo.toLowerCase().includes(s) || pr.ean.includes(s))
        );
      }

      const filtrosAplicados = {
        status: input.filtroStatus,
        loja: input.filtroLoja ? `Loja ${input.filtroLoja}` : undefined,
        produto: input.filtroProdutoCodigo,
        dataInicio: input.filtroDataInicio,
        dataFim: input.filtroDataFim,
        busca: input.filtroSearch,
      };

      const buffer = await generateCometaPedidosPDF(pedidos, input.filtroStatus, filtrosAplicados);
      const base64 = buffer.toString("base64");
      const statusLabel = input.filtroStatus === "pendente" ? "pendentes" : input.filtroStatus === "entregue" ? "entregues" : "todos";
      return {
        base64,
        filename: `pedidos-cometa-${statusLabel}-${new Date().toISOString().split("T")[0]}.pdf`,
        mimeType: "application/pdf",
      };
    }),

    exportPedidosExcel: protectedProcedure.input(z.object({
      filtroStatus: z.enum(["pendente", "entregue", "todos"]).default("pendente"),
      filtroLoja: z.number().int().positive().optional(),
      filtroProdutoCodigo: z.string().optional(),
      filtroDataInicio: z.string().optional(),
      filtroDataFim: z.string().optional(),
      filtroSearch: z.string().optional(),
    })).mutation(async ({ input }) => {
      const pedidosRaw = await cometaSyncService.getPedidos();
      const pedidosMap = new Map<string, CometaPedidoRelatorio>();
      for (const item of pedidosRaw) {
        const key = item.numero_pedido;
        if (!pedidosMap.has(key)) {
          pedidosMap.set(key, {
            id: item.numero_pedido,
            numero_pedido: item.numero_pedido,
            data: item.data_emissao_pedido,
            loja: `Loja ${item.loja}`,
            loja_numero: item.loja,
            cnpj: item.cnpj,
            status: item.status_pedido === "P" ? "pendente" : "entregue",
            status_raw: item.status_pedido,
            frete: item.frete,
            comprador: item.comprador,
            prazo_pagamento: item.prazo_pagamento,
            observacao: item.observacao,
            produtos: [],
            valor_total: 0,
            total_unidades: 0,
            total: "",
            itens: 0,
          });
        }
        const pedido = pedidosMap.get(key)!;
        pedido.produtos.push({
          nome: item.descricao_produto,
          codigo: item.codigo_produto,
          ean: item.ean_produto,
          qtd: item.total_unidades,
          qtd_embalagem: item.qtd_embalagem,
          valor_unitario: item.valor_bruto_unitario,
          valor: `R$ ${item.valor_total.toFixed(2).replace(".", ",")}`,
          valor_numerico: item.valor_total,
        });
        pedido.valor_total += item.valor_total;
        pedido.total_unidades += item.total_unidades;
      }
      let pedidos = Array.from(pedidosMap.values()).map(p => ({
        ...p,
        total: `R$ ${p.valor_total.toFixed(2).replace(".", ",")}`,
        itens: p.produtos.length,
      }));

      // Aplicar filtros
      if (input.filtroStatus !== "todos") pedidos = pedidos.filter(p => p.status === input.filtroStatus);
      if (input.filtroLoja) pedidos = pedidos.filter(p => p.loja_numero === input.filtroLoja);
      if (input.filtroProdutoCodigo) pedidos = pedidos.filter(p => p.produtos.some(pr => pr.codigo === input.filtroProdutoCodigo));
      if (input.filtroDataInicio || input.filtroDataFim) {
        pedidos = pedidos.filter(p => {
          const parts = p.data.split("/");
          if (parts.length !== 3) return true;
          const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
          if (input.filtroDataInicio && d < new Date(input.filtroDataInicio)) return false;
          if (input.filtroDataFim && d > new Date(input.filtroDataFim)) return false;
          return true;
        });
      }
      if (input.filtroSearch) {
        const s = input.filtroSearch.toLowerCase();
        pedidos = pedidos.filter(p =>
          p.id.toLowerCase().includes(s) ||
          p.loja.toLowerCase().includes(s) ||
          p.cnpj.includes(s) ||
          p.produtos.some(pr => pr.nome.toLowerCase().includes(s) || pr.codigo.toLowerCase().includes(s) || pr.ean.includes(s))
        );
      }

      const buffer = await generateCometaPedidosExcel(pedidos, input.filtroStatus);
      const base64 = buffer.toString("base64");
      const statusLabel = input.filtroStatus === "pendente" ? "pendentes" : input.filtroStatus === "entregue" ? "entregues" : "todos";
      return {
        base64,
        filename: `pedidos-cometa-${statusLabel}-${new Date().toISOString().split("T")[0]}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),

    exportVendasPDF: protectedProcedure.input(z.object({
      tipo: z.enum(["diario", "acumulado", "por_produto"]).default("diario"),
      filtroLoja: z.number().optional(),
      filtroDataInicio: z.string().optional(),
      filtroDataFim: z.string().optional(),
    })).mutation(async ({ input }) => {
      const vendas = await cometaSyncService.getVendas();
      // Montar lista flat de itens
      let items: Array<{ data: string; ean: string; cod_interno: string; produto: string; qtd: number; venda: number; custo: number; nome_loja: string; loja_num: number }> = [];
      vendas.forEach((v: any) => {
        v.VENDAS.forEach((i: any) => {
          items.push({
            data: i.DATA,
            ean: i.EAN,
            cod_interno: i.COD_INTERNO,
            produto: i.PRODUTO,
            qtd: i.QTD,
            venda: i.VENDA,
            custo: i.CUSTO,
            nome_loja: v.LOJA.NOME,
            loja_num: v.LOJA.LOJA,
          });
        });
      });
      // Aplicar filtros
      if (input.filtroLoja) items = items.filter(i => i.loja_num === input.filtroLoja);
      if (input.filtroDataInicio || input.filtroDataFim) {
        items = items.filter(i => {
          const parts = i.data.split("/");
          if (parts.length !== 3) return true;
          const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
          if (input.filtroDataInicio && d < new Date(input.filtroDataInicio)) return false;
          if (input.filtroDataFim && d > new Date(input.filtroDataFim)) return false;
          return true;
        });
      }
      const lojaLabel = input.filtroLoja ? vendas.find((v: any) => v.LOJA.LOJA === input.filtroLoja)?.LOJA.NOME : undefined;
      const buffer = generateCometaVendasPDF(items, input.tipo, {
        loja: lojaLabel,
        dataInicio: input.filtroDataInicio,
        dataFim: input.filtroDataFim,
      });
      const base64 = buffer.toString("base64");
      const tipoLabel = input.tipo === "diario" ? "diario" : input.tipo === "acumulado" ? "acumulado" : "por-produto";
      return {
        base64,
        filename: `vendas-cometa-${tipoLabel}-${new Date().toISOString().split("T")[0]}.pdf`,
        mimeType: "application/pdf",
      };
    }),

    exportVendasExcel: protectedProcedure.input(z.object({
      tipo: z.enum(["diario", "acumulado", "por_produto"]).default("diario"),
      filtroLoja: z.number().optional(),
      filtroDataInicio: z.string().optional(),
      filtroDataFim: z.string().optional(),
    })).mutation(async ({ input }) => {
      const vendas = await cometaSyncService.getVendas();
      let items: Array<{ data: string; ean: string; cod_interno: string; produto: string; qtd: number; venda: number; custo: number; nome_loja: string; loja_num: number }> = [];
      vendas.forEach((v: any) => {
        v.VENDAS.forEach((i: any) => {
          items.push({
            data: i.DATA,
            ean: i.EAN,
            cod_interno: i.COD_INTERNO,
            produto: i.PRODUTO,
            qtd: i.QTD,
            venda: i.VENDA,
            custo: i.CUSTO,
            nome_loja: v.LOJA.NOME,
            loja_num: v.LOJA.LOJA,
          });
        });
      });
      if (input.filtroLoja) items = items.filter(i => i.loja_num === input.filtroLoja);
      if (input.filtroDataInicio || input.filtroDataFim) {
        items = items.filter(i => {
          const parts = i.data.split("/");
          if (parts.length !== 3) return true;
          const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
          if (input.filtroDataInicio && d < new Date(input.filtroDataInicio)) return false;
          if (input.filtroDataFim && d > new Date(input.filtroDataFim)) return false;
          return true;
        });
      }
      const lojaLabel = input.filtroLoja ? vendas.find((v: any) => v.LOJA.LOJA === input.filtroLoja)?.LOJA.NOME : undefined;
      const buffer = await generateCometaVendasExcel(items, input.tipo, {
        loja: lojaLabel,
        dataInicio: input.filtroDataInicio,
        dataFim: input.filtroDataFim,
      });
      const base64 = buffer.toString("base64");
      const tipoLabel = input.tipo === "diario" ? "diario" : input.tipo === "acumulado" ? "acumulado" : "por-produto";
      return {
        base64,
        filename: `vendas-cometa-${tipoLabel}-${new Date().toISOString().split("T")[0]}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── LLM Invoice Processing ────────────────────────────
async function processInvoiceWithLLM(fileUrl: string, fileType: string, invoiceType: "entrada" | "saida") {
  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf";

  const content: any[] = [
    {
      type: "text",
      text: `Você é um especialista em leitura de notas fiscais brasileiras. Analise esta nota fiscal de ${invoiceType === "entrada" ? "ENTRADA (compra)" : "SAÍDA (venda)"} e extraia os seguintes dados em formato JSON:

{
  "invoiceNumber": "número da nota fiscal",
  "entityName": "nome do ${invoiceType === "entrada" ? "fornecedor" : "cliente"}",
  "entityDocument": "CNPJ ou CPF",
  "issueDate": "data de emissão no formato YYYY-MM-DD",
  "totalValue": valor_total_numerico,
  "items": [
    {
      "name": "nome do produto",
      "reference": "código do produto (cProd) na nota",
      "cfop": "código CFOP do item",
      "quantity": quantidade_numerica,
      "unit": "unidade (un, kg, lt, cx, etc)",
      "unitPrice": preco_unitario_numerico,
      "totalPrice": preco_total_numerico
    }
  ]
}

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou texto adicional
- Valores numéricos devem ser números, não strings
- Se não conseguir ler algum campo, use null
- Extraia TODOS os itens/produtos da nota
- Datas no formato YYYY-MM-DD
- Valores monetários em reais (BRL)
- O campo reference é o código do produto (cProd) que aparece na nota
- O campo cfop é o código fiscal de operações e prestações de cada item`,
    },
  ];

  if (isImage) {
    content.push({
      type: "image_url",
      image_url: { url: fileUrl, detail: "high" },
    });
  } else if (isPdf) {
    content.push({
      type: "file_url",
      file_url: { url: fileUrl, mime_type: "application/pdf" },
    });
  }

  const result = await invokeLLM({
    messages: [
      {
        role: "user",
        content,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "invoice_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            invoiceNumber: { type: ["string", "null"] },
            entityName: { type: ["string", "null"] },
            entityDocument: { type: ["string", "null"] },
            issueDate: { type: ["string", "null"] },
            totalValue: { type: ["number", "null"] },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  reference: { type: ["string", "null"] },
                  cfop: { type: ["string", "null"] },
                  quantity: { type: ["number", "null"] },
                  unit: { type: ["string", "null"] },
                  unitPrice: { type: ["number", "null"] },
                  totalPrice: { type: ["number", "null"] },
                },
                required: ["name", "reference", "cfop", "quantity", "unit", "unitPrice", "totalPrice"],
                additionalProperties: false,
              },
            },
          },
          required: ["invoiceNumber", "entityName", "entityDocument", "issueDate", "totalValue", "items"],
          additionalProperties: false,
        },
      },
    },
  });

  const responseText = typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : "";

  try {
    return JSON.parse(responseText);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Não foi possível extrair dados da nota fiscal. Tente com uma imagem mais nítida.");
  }
}
