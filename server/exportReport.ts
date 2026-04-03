import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const LOGO_CDN_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663173005738/IcODfaokDzcHpBaM.png";

function getLogoPath(): string | null {
  const base = process.cwd();
  const candidates = [
    path.join(base, "client/public/logo-lustra-mil.png"),
    path.join(base, "dist/public/logo-lustra-mil.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export interface MovementRow {
  id: number;
  productId: number | null;
  productName: string | null;
  type: string;
  quantity: string | number;
  unitPrice: string | number | null;
  totalPrice: string | number | null;
  createdAt: Date | string;
  movementDate?: Date | string | null;
}

export interface ReportSummary {
  totalEntradas: number;
  totalSaidas: number;
  totalValueIn: number;
  totalValueOut: number;
  productCount: number;
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function computeSummary(movements: MovementRow[]): ReportSummary {
  const productSet = new Set<number>();
  let totalEntradas = 0, totalSaidas = 0, totalValueIn = 0, totalValueOut = 0;
  movements.forEach((m) => {
    if (m.productId) productSet.add(m.productId);
    const qty = parseFloat(String(m.quantity));
    const val = parseFloat(String(m.totalPrice || 0));
    if (m.type === "entrada") {
      totalEntradas += qty;
      totalValueIn += val;
    } else {
      totalSaidas += qty;
      totalValueOut += val;
    }
  });
  return { totalEntradas, totalSaidas, totalValueIn, totalValueOut, productCount: productSet.size };
}

// ─── Excel Export ────────────────────────────────────────

export async function generateExcel(
  movements: MovementRow[],
  startDate: Date,
  endDate: Date,
  viewMode: string = "financeiro"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil - Controle de Estoque";
  workbook.created = new Date();

  const summary = computeSummary(movements);

  // ─── Sheet 1: Resumo ──────────────────────────
  const resumoSheet = workbook.addWorksheet("Resumo", {
    properties: { tabColor: { argb: "FF1E40AF" } },
  });

  // Title
  resumoSheet.mergeCells("A1:F1");
  const titleCell = resumoSheet.getCell("A1");
  titleCell.value = "Lustra Mil - Relatório de Estoque";
  titleCell.font = { size: 16, bold: true, color: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center" };

  // Period (sempre por data da nota)
  resumoSheet.mergeCells("A2:F2");
  const periodCell = resumoSheet.getCell("A2");
  periodCell.value = `Período (data da nota): ${formatDate(startDate)} a ${formatDate(endDate)}`;
  periodCell.font = { size: 11, color: { argb: "FF666666" } };
  periodCell.alignment = { horizontal: "center" };

  // View mode + data da nota
  resumoSheet.mergeCells("A3:F3");
  const viewCell = resumoSheet.getCell("A3");
  viewCell.value = `Visão: ${viewMode === "financeiro" ? "Financeira (R$)" : "Quantidade (un)"} — Dados por data da nota fiscal`;
  viewCell.font = { size: 10, color: { argb: "FF999999" } };
  viewCell.alignment = { horizontal: "center" };

  // Logo (se existir) — à esquerda do título
  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      const imageId = workbook.addImage({
        filename: logoPath,
        extension: "png",
      });
      resumoSheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 45 } });
      resumoSheet.getRow(1).height = 50;
    } catch (_) {}
  }

  // Empty row
  resumoSheet.addRow([]);

  // Summary section
  const summaryHeader = resumoSheet.addRow(["RESUMO DO PERÍODO"]);
  summaryHeader.getCell(1).font = { size: 12, bold: true, color: { argb: "FF1E40AF" } };

  const summaryData = [
    ["Total de Compras (Entradas)", formatCurrency(summary.totalValueIn)],
    ["Total de Vendas (Saídas)", formatCurrency(summary.totalValueOut)],
    ["Balanço do Período", formatCurrency(summary.totalValueOut - summary.totalValueIn)],
    ["Quantidade Entradas", `${summary.totalEntradas.toFixed(2)} un`],
    ["Quantidade Saídas", `${summary.totalSaidas.toFixed(2)} un`],
    ["Saldo Quantidade", `${(summary.totalEntradas - summary.totalSaidas).toFixed(2)} un`],
    ["Produtos Movimentados", String(summary.productCount)],
  ];

  summaryData.forEach(([label, value]) => {
    const row = resumoSheet.addRow([label, value]);
    row.getCell(1).font = { size: 10, color: { argb: "FF333333" } };
    row.getCell(2).font = { size: 10, bold: true };
  });

  // Column widths
  resumoSheet.getColumn(1).width = 35;
  resumoSheet.getColumn(2).width = 25;

  // ─── Sheet 2: Movimentações ────────────────────
  const movSheet = workbook.addWorksheet("Movimentações", {
    properties: { tabColor: { argb: "FF059669" } },
  });

  // Header row
  const headerRow = movSheet.addRow(["Data", "Tipo", "Produto", "Quantidade", "Preço Unit.", "Valor Total"]);
  headerRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1E40AF" } },
    };
  });

  // Data rows
  movements.forEach((m, index) => {
    const qty = parseFloat(String(m.quantity));
    const unitPrice = m.unitPrice ? parseFloat(String(m.unitPrice)) : 0;
    const total = m.totalPrice ? parseFloat(String(m.totalPrice)) : 0;

    const row = movSheet.addRow([
      formatDate(m.movementDate || m.createdAt),
      m.type === "entrada" ? "Entrada" : "Saída",
      m.productName || "N/A",
      qty.toFixed(2),
      formatCurrency(unitPrice),
      formatCurrency(total),
    ]);

    // Alternating row colors
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }

    // Color type column
    const typeCell = row.getCell(2);
    typeCell.font = {
      bold: true,
      color: { argb: m.type === "entrada" ? "FF059669" : "FFD97706" },
    };
  });

  // Totals row
  const totalsRow = movSheet.addRow([
    "TOTAIS",
    "",
    "",
    (summary.totalEntradas + summary.totalSaidas).toFixed(2),
    "",
    formatCurrency(summary.totalValueIn + summary.totalValueOut),
  ]);
  totalsRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FF" } };
    cell.border = {
      top: { style: "double", color: { argb: "FF1E40AF" } },
    };
  });

  // Column widths
  movSheet.getColumn(1).width = 14;
  movSheet.getColumn(2).width = 12;
  movSheet.getColumn(3).width = 30;
  movSheet.getColumn(4).width = 14;
  movSheet.getColumn(5).width = 16;
  movSheet.getColumn(6).width = 18;

  // Auto-filter
  movSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: movements.length + 1, column: 6 },
  };

  // ─── Sheet 3: Por Produto ─────────────────────
  const prodSheet = workbook.addWorksheet("Por Produto", {
    properties: { tabColor: { argb: "FFD97706" } },
  });

  // Aggregate by product
  const productMap: Record<string, { entradas: number; saidas: number; valueIn: number; valueOut: number }> = {};
  movements.forEach((m) => {
    const name = m.productName || "Desconhecido";
    if (!productMap[name]) productMap[name] = { entradas: 0, saidas: 0, valueIn: 0, valueOut: 0 };
    const qty = parseFloat(String(m.quantity));
    const val = parseFloat(String(m.totalPrice || 0));
    if (m.type === "entrada") {
      productMap[name].entradas += qty;
      productMap[name].valueIn += val;
    } else {
      productMap[name].saidas += qty;
      productMap[name].valueOut += val;
    }
  });

  const prodHeader = prodSheet.addRow(["Produto", "Entradas (un)", "Saídas (un)", "Valor Compras", "Valor Vendas", "Balanço"]);
  prodHeader.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
    cell.alignment = { horizontal: "center" };
  });

  Object.entries(productMap)
    .sort((a, b) => (b[1].valueIn + b[1].valueOut) - (a[1].valueIn + a[1].valueOut))
    .forEach(([name, data], index) => {
      const row = prodSheet.addRow([
        name,
        data.entradas.toFixed(2),
        data.saidas.toFixed(2),
        formatCurrency(data.valueIn),
        formatCurrency(data.valueOut),
        formatCurrency(data.valueOut - data.valueIn),
      ]);
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        });
      }
    });

  prodSheet.getColumn(1).width = 30;
  prodSheet.getColumn(2).width = 16;
  prodSheet.getColumn(3).width = 14;
  prodSheet.getColumn(4).width = 18;
  prodSheet.getColumn(5).width = 18;
  prodSheet.getColumn(6).width = 18;

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── PDF Export ──────────────────────────────────────────

export async function generatePDF(
  movements: MovementRow[],
  startDate: Date,
  endDate: Date,
  viewMode: string = "financeiro"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: "Relatório de Estoque - Lustra Mil",
        Author: "Lustra Mil - Produtos de Limpeza",
        Subject: `Relatório ${formatDate(startDate)} a ${formatDate(endDate)}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const summary = computeSummary(movements);

    const blue = "#1e40af";
    const green = "#059669";
    const orange = "#d97706";
    const gray = "#64748b";
    const lightBg = "#f0f4ff";

    // ─── Logo (se existir) ──────────────────────────
    const logoPath = getLogoPath();
    const headerStartY = 40;
    if (logoPath) {
      try {
        doc.image(logoPath, 40, headerStartY, { width: 120, height: 50 });
      } catch (_) {}
    }

    // ─── Header texto ──────────────────────────
    const textY = logoPath ? headerStartY + 52 : headerStartY;
    doc.y = textY;
    doc.fontSize(16).fillColor(blue).text("Relatório de Estoque", { align: "center" });
    doc.fontSize(9).fillColor(gray).text(
      `Visão: ${viewMode === "financeiro" ? "Financeira (R$)" : "Quantidade (un)"} — Dados por data da nota fiscal`,
      { align: "center" }
    );
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(blue).lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    // ─── Period ──────────────────────────
    const periodY = doc.y;
    doc.rect(40, periodY, 515, 32).fillAndStroke(lightBg, blue);
    doc.fontSize(10).fillColor(blue).text(
      `Período (data da nota): ${formatDate(startDate)} a ${formatDate(endDate)}`,
      40, periodY + 10, { align: "center", width: 515 }
    );
    doc.moveDown(1.5);

    // ─── Summary Cards ───────────────────
    const cardWidth = 165;
    const cardHeight = 55;
    const cardY = doc.y;
    const cards = [
      { label: "Compras (Entradas)", value: formatCurrency(summary.totalValueIn), sub: `${summary.totalEntradas.toFixed(0)} un`, color: green },
      { label: "Vendas (Saídas)", value: formatCurrency(summary.totalValueOut), sub: `${summary.totalSaidas.toFixed(0)} un`, color: orange },
      { label: "Balanço do Período", value: formatCurrency(summary.totalValueOut - summary.totalValueIn), sub: `${summary.productCount} produtos`, color: blue },
    ];

    cards.forEach((card, i) => {
      const x = 40 + i * (cardWidth + 10);
      doc.rect(x, cardY, cardWidth, cardHeight).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fontSize(7).fillColor(gray).text(card.label.toUpperCase(), x + 8, cardY + 8, { width: cardWidth - 16 });
      doc.fontSize(14).fillColor(card.color).text(card.value, x + 8, cardY + 22, { width: cardWidth - 16 });
      doc.fontSize(7).fillColor(gray).text(card.sub, x + 8, cardY + 40, { width: cardWidth - 16 });
    });

    doc.y = cardY + cardHeight + 15;

    // ─── Table ───────────────────────────
    doc.fontSize(11).fillColor(blue).text("Movimentações Detalhadas", 40, doc.y);
    doc.fontSize(8).fillColor(gray).text(`${movements.length} registros`, { align: "right" });
    doc.moveDown(0.5);

    // Table header
    const tableX = 40;
    const colWidths = [60, 55, 150, 55, 70, 75];
    const headers = ["Data", "Tipo", "Produto", "Qtd", "Preço Unit.", "Total"];
    const headerY = doc.y;

    doc.rect(tableX, headerY, 515, 18).fill(blue);
    let xPos = tableX;
    headers.forEach((h, i) => {
      doc.fontSize(8).fillColor("white").text(h, xPos + 4, headerY + 5, {
        width: colWidths[i] - 8,
        align: i >= 3 ? "right" : "left",
      });
      xPos += colWidths[i];
    });

    doc.y = headerY + 18;

    // Table rows
    const maxRowsPerPage = 32;
    let rowCount = 0;

    movements.forEach((m, index) => {
      if (rowCount >= maxRowsPerPage && doc.y > 680) {
        doc.addPage();
        doc.y = 40;
        rowCount = 0;

        // Re-draw header on new page
        const newHeaderY = doc.y;
        doc.rect(tableX, newHeaderY, 515, 18).fill(blue);
        let nx = tableX;
        headers.forEach((h, i) => {
          doc.fontSize(8).fillColor("white").text(h, nx + 4, newHeaderY + 5, {
            width: colWidths[i] - 8,
            align: i >= 3 ? "right" : "left",
          });
          nx += colWidths[i];
        });
        doc.y = newHeaderY + 18;
      }

      const rowY = doc.y;
      const rowHeight = 16;

      // Alternating background
      if (index % 2 === 1) {
        doc.rect(tableX, rowY, 515, rowHeight).fill("#f8fafc");
      }

      // Bottom border
      doc.moveTo(tableX, rowY + rowHeight).lineTo(tableX + 515, rowY + rowHeight).strokeColor("#e2e8f0").lineWidth(0.5).stroke();

      const qty = parseFloat(String(m.quantity));
      const unitPrice = m.unitPrice ? parseFloat(String(m.unitPrice)) : 0;
      const total = m.totalPrice ? parseFloat(String(m.totalPrice)) : 0;

      const rowData = [
        formatDate(m.movementDate || m.createdAt),
        m.type === "entrada" ? "Entrada" : "Saída",
        (m.productName || "N/A").substring(0, 30),
        qty.toFixed(2),
        formatCurrency(unitPrice),
        formatCurrency(total),
      ];

      let rx = tableX;
      rowData.forEach((val, i) => {
        const textColor = i === 1 ? (m.type === "entrada" ? green : orange) : "#333333";
        const fontWeight = i === 1 ? true : false;
        doc.fontSize(7.5).fillColor(textColor);
        if (fontWeight) doc.font("Helvetica-Bold");
        doc.text(val, rx + 4, rowY + 4, {
          width: colWidths[i] - 8,
          align: i >= 3 ? "right" : "left",
        });
        if (fontWeight) doc.font("Helvetica");
        rx += colWidths[i];
      });

      doc.y = rowY + rowHeight;
      rowCount++;
    });

    // Totals row
    const totY = doc.y;
    doc.rect(tableX, totY, 515, 20).fill(lightBg);
    doc.moveTo(tableX, totY).lineTo(tableX + 515, totY).strokeColor(blue).lineWidth(1.5).stroke();

    doc.fontSize(8).fillColor(blue).font("Helvetica-Bold");
    doc.text("TOTAIS", tableX + 4, totY + 6, { width: colWidths[0] + colWidths[1] + colWidths[2] - 8 });
    doc.text((summary.totalEntradas + summary.totalSaidas).toFixed(2), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 4, totY + 6, {
      width: colWidths[3] - 8, align: "right",
    });
    doc.text(formatCurrency(summary.totalValueIn + summary.totalValueOut),
      tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 4, totY + 6, {
        width: colWidths[5] - 8, align: "right",
      });
    doc.font("Helvetica");

    doc.y = totY + 30;

    // ─── Footer ──────────────────────────
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.fontSize(7).fillColor(gray).text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} — Lustra Mil Produtos de Limpeza`,
      { align: "center" }
    );

    doc.end();
  });
}

// ─── Export Excel: Contas a Pagar ──────────────────────────
export async function generatePayableExcel(
  items: { id: number; description: string; value: string; dueDate: Date | string; status: string; paidDate?: Date | string | null; entityName?: string | null; categoryId?: number | null }[],
  startDate: Date,
  endDate: Date,
  categoryNames: Record<number, string>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil";
  const sheet = workbook.addWorksheet("Contas a Pagar", { properties: { tabColor: { argb: "FFDC2626" } } });
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 22;
  sheet.addRow(["Lustra Mil - Contas a Pagar"]).getCell(1).font = { size: 14, bold: true };
  sheet.addRow([`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(["Vencimento", "Descrição", "Valor", "Status", "Pago em", "Fornecedor", "Categoria"]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  items.forEach((i) => {
    sheet.addRow([
      formatDate(i.dueDate),
      i.description || "",
      parseFloat(String(i.value)) || 0,
      i.status,
      i.paidDate ? formatDate(i.paidDate) : "-",
      i.entityName || "-",
      i.categoryId && categoryNames[i.categoryId] ? categoryNames[i.categoryId] : "-",
    ]);
  });
  sheet.addRow([]);
  const total = items.reduce((s, i) => s + parseFloat(String(i.value)) || 0, 0);
  sheet.addRow(["Total", "", total, "", "", "", ""]).getCell(3).numFmt = '"R$"#,##0.00';
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── Export Excel: Contas a Receber ───────────────────────
export async function generateReceivableExcel(
  items: { id: number; description: string; value: string; expectedDate: Date | string; status: string; receivedDate?: Date | string | null; entityName?: string | null }[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil";
  const sheet = workbook.addWorksheet("Contas a Receber", { properties: { tabColor: { argb: "FF059669" } } });
  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 22;
  sheet.addRow(["Lustra Mil - Contas a Receber"]).getCell(1).font = { size: 14, bold: true };
  sheet.addRow([`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(["Previsão", "Descrição", "Valor", "Status", "Recebido em", "Cliente"]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  items.forEach((i) => {
    sheet.addRow([
      formatDate(i.expectedDate),
      i.description || "",
      parseFloat(String(i.value)) || 0,
      i.status,
      i.receivedDate ? formatDate(i.receivedDate) : "-",
      i.entityName || "-",
    ]);
  });
  sheet.addRow([]);
  const total = items.reduce((s, i) => s + parseFloat(String(i.value)) || 0, 0);
  sheet.addRow(["Total", "", total, "", "", ""]).getCell(3).numFmt = '"R$"#,##0.00';
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── Export Excel: Caixa ─────────────────────────────────
export async function generateCashExcel(
  items: { id: number; date: Date | string; type: string; description: string; value: string; categoryId?: number | null }[],
  startDate: Date,
  endDate: Date,
  categoryNames: Record<number, string>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil";
  const sheet = workbook.addWorksheet("Caixa", { properties: { tabColor: { argb: "FF2563EB" } } });
  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 18;
  sheet.addRow(["Lustra Mil - Movimentações de Caixa"]).getCell(1).font = { size: 14, bold: true };
  sheet.addRow([`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(["Data", "Tipo", "Descrição", "Valor", "Categoria"]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  items.forEach((i) => {
    sheet.addRow([
      formatDate(i.date),
      i.type === "entrada" ? "Entrada" : "Saída",
      i.description || "",
      parseFloat(String(i.value)) || 0,
      i.categoryId && categoryNames[i.categoryId] ? categoryNames[i.categoryId] : "-",
    ]);
  });
  sheet.addRow([]);
  const entradas = items.filter((i) => i.type === "entrada").reduce((s, i) => s + parseFloat(String(i.value)) || 0, 0);
  const saidas = items.filter((i) => i.type === "saida").reduce((s, i) => s + parseFloat(String(i.value)) || 0, 0);
  sheet.addRow(["Total Entradas", "", "", entradas, ""]).getCell(4).numFmt = '"R$"#,##0.00';
  sheet.addRow(["Total Saídas", "", "", saidas, ""]).getCell(4).numFmt = '"R$"#,##0.00';
  sheet.addRow(["Saldo", "", "", entradas - saidas, ""]).getCell(4).numFmt = '"R$"#,##0.00';
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}


// ─── Export: Por Fornecedor/Cliente ────────────────────

export interface EntityGroupRow {
  entityName: string;
  entityDocument: string;
  totalEntradas: number;
  totalSaidas: number;
  qtdEntradas: number;
  qtdSaidas: number;
  totalMovements: number;
  totalProducts: number;
  totalInvoices: number;
}

export async function generateEntityGroupExcel(
  entities: EntityGroupRow[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil - Controle de Estoque";

  const sheet = workbook.addWorksheet("Por Fornecedor-Cliente", {
    properties: { tabColor: { argb: "FF7C3AED" } },
  });

  // Title
  sheet.mergeCells("A1:H1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "Lustra Mil - Relatório Por Fornecedor/Cliente";
  titleCell.font = { size: 16, bold: true, color: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A2:H2");
  const periodCell = sheet.getCell("A2");
  periodCell.value = `Período (data da nota): ${formatDate(startDate)} a ${formatDate(endDate)}`;
  periodCell.font = { size: 11, color: { argb: "FF666666" } };
  periodCell.alignment = { horizontal: "center" };

  // Logo
  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 45 } });
      sheet.getRow(1).height = 50;
    } catch (_) {}
  }

  sheet.addRow([]);

  // Header
  const headerRow = sheet.addRow([
    "Fornecedor/Cliente", "CNPJ/CPF", "Compras (R$)", "Vendas (R$)", "Total (R$)",
    "Qtd Compras", "Qtd Vendas", "Notas", "Movimentações"
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
    cell.alignment = { horizontal: "center" };
  });

  // Data
  let totalCompras = 0, totalVendas = 0;
  entities.forEach((e, idx) => {
    const total = e.totalEntradas + e.totalSaidas;
    totalCompras += e.totalEntradas;
    totalVendas += e.totalSaidas;
    const row = sheet.addRow([
      e.entityName, e.entityDocument,
      e.totalEntradas, e.totalSaidas, total,
      e.qtdEntradas.toFixed(2), e.qtdSaidas.toFixed(2),
      e.totalInvoices, e.totalMovements
    ]);
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    [3, 4, 5].forEach(col => { row.getCell(col).numFmt = '"R$"#,##0.00'; });
  });

  // Totals
  const totRow = sheet.addRow(["TOTAIS", "", totalCompras, totalVendas, totalCompras + totalVendas, "", "", "", ""]);
  totRow.eachCell((cell) => { cell.font = { bold: true }; });
  [3, 4, 5].forEach(col => { totRow.getCell(col).numFmt = '"R$"#,##0.00'; });

  // Column widths
  [35, 20, 15, 15, 15, 12, 12, 10, 14].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── Export: Por Material ────────────────────

export interface MaterialGroupRow {
  productName: string;
  reference: string;
  category: string;
  totalEntradas: number;
  totalSaidas: number;
  qtdEntradas: number;
  qtdSaidas: number;
  totalMovements: number;
  totalEntities: number;
  entityNames: string;
}

export async function generateMaterialGroupExcel(
  materials: MaterialGroupRow[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil - Controle de Estoque";

  const sheet = workbook.addWorksheet("Por Material", {
    properties: { tabColor: { argb: "FF059669" } },
  });

  // Title
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "Lustra Mil - Relatório Por Material";
  titleCell.font = { size: 16, bold: true, color: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A2:I2");
  const periodCell = sheet.getCell("A2");
  periodCell.value = `Período (data da nota): ${formatDate(startDate)} a ${formatDate(endDate)}`;
  periodCell.font = { size: 11, color: { argb: "FF666666" } };
  periodCell.alignment = { horizontal: "center" };

  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 45 } });
      sheet.getRow(1).height = 50;
    } catch (_) {}
  }

  sheet.addRow([]);

  // Header
  const headerRow = sheet.addRow([
    "Material", "Referência", "Categoria", "Compras (R$)", "Vendas (R$)", "Total (R$)",
    "Qtd Compras", "Qtd Vendas", "Fornecedores/Clientes"
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.alignment = { horizontal: "center" };
  });

  // Data
  let totalCompras = 0, totalVendas = 0;
  materials.forEach((m, idx) => {
    const total = m.totalEntradas + m.totalSaidas;
    totalCompras += m.totalEntradas;
    totalVendas += m.totalSaidas;
    const row = sheet.addRow([
      m.productName, m.reference, m.category,
      m.totalEntradas, m.totalSaidas, total,
      m.qtdEntradas.toFixed(2), m.qtdSaidas.toFixed(2),
      m.entityNames
    ]);
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    [4, 5, 6].forEach(col => { row.getCell(col).numFmt = '"R$"#,##0.00'; });
  });

  // Totals
  const totRow = sheet.addRow(["TOTAIS", "", "", totalCompras, totalVendas, totalCompras + totalVendas, "", "", ""]);
  totRow.eachCell((cell) => { cell.font = { bold: true }; });
  [4, 5, 6].forEach(col => { totRow.getCell(col).numFmt = '"R$"#,##0.00'; });

  // Column widths
  [30, 15, 15, 15, 15, 15, 12, 12, 40].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── Export: Ranking ────────────────────

export interface RankingRow {
  rank: number;
  entityName: string;
  entityDocument: string;
  totalValue: number;
  totalQtd: number;
  totalInvoices: number;
  totalProducts: number;
  ticketMedio: number;
}

export async function generateRankingExcel(
  ranking: RankingRow[],
  startDate: Date,
  endDate: Date,
  title: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil - Controle de Estoque";

  const sheet = workbook.addWorksheet("Ranking", {
    properties: { tabColor: { argb: "FFD97706" } },
  });

  sheet.mergeCells("A1:H1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Lustra Mil - ${title}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A2:H2");
  const periodCell = sheet.getCell("A2");
  periodCell.value = `Período (data da nota): ${formatDate(startDate)} a ${formatDate(endDate)}`;
  periodCell.font = { size: 11, color: { argb: "FF666666" } };
  periodCell.alignment = { horizontal: "center" };

  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 45 } });
      sheet.getRow(1).height = 50;
    } catch (_) {}
  }

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    "#", "Nome", "CNPJ/CPF", "Faturamento (R$)", "Quantidade", "Notas", "Produtos", "Ticket Médio (R$)"
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
    cell.alignment = { horizontal: "center" };
  });

  ranking.forEach((r, idx) => {
    const row = sheet.addRow([
      r.rank, r.entityName, r.entityDocument,
      r.totalValue, r.totalQtd.toFixed(2), r.totalInvoices, r.totalProducts, r.ticketMedio
    ]);
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    [4, 8].forEach(col => { row.getCell(col).numFmt = '"R$"#,##0.00'; });

    // Medal colors for top 3
    if (idx < 3) {
      const colors = ["FFFFD700", "FFC0C0C0", "FFCD7F32"];
      row.getCell(1).font = { bold: true, color: { argb: colors[idx] } };
    }
  });

  [5, 30, 20, 18, 12, 10, 10, 18].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── Interfaces para Pedidos Cometa ─────────────────────────────────────────

export interface CometaPedidoRelatorio {
  id: string;
  numero_pedido: string;
  data: string;
  loja: string;
  loja_numero: number;
  cnpj: string;
  status: string;
  status_raw: string;
  frete: string;
  comprador: { nome: string; codigo: string };
  prazo_pagamento: string;
  observacao: string;
  produtos: {
    nome: string;
    codigo: string;
    ean: string;
    qtd: number;
    qtd_embalagem: number;
    valor_unitario: number;
    valor: string;
    valor_numerico: number;
  }[];
  valor_total: number;
  total_unidades: number;
  total: string;
  itens: number;
}

// ─── PDF de Pedidos Pendentes (Expedição) ────────────────────────────────────

export function generateCometaPedidosPDF(
  pedidos: CometaPedidoRelatorio[],
  filtroStatus: "pendente" | "entregue" | "todos" = "pendente",
  filtrosAplicados?: {
    status?: string;
    loja?: string;
    produto?: string;
    dataInicio?: string;
    dataFim?: string;
    busca?: string;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, info: {
      Title: "Relatório de Pedidos - Lustra Mil",
      Author: "Lustra Mil - Produtos de Limpeza",
    }});

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const blue = "#1e40af";
    const green = "#059669";
    const orange = "#d97706";
    const red = "#dc2626";
    const gray = "#64748b";
    const lightBlue = "#eff6ff";
    const lightGray = "#f8fafc";
    const darkGray = "#374151";

    // Pedidos já chegam filtrados do backend
    const pedidosFiltrados = pedidos;

    const totalValor = pedidosFiltrados.reduce((s, p) => s + p.valor_total, 0);
    const totalUnidades = pedidosFiltrados.reduce((s, p) => s + p.total_unidades, 0);
    const totalProdutosDistintos = new Set(
      pedidosFiltrados.flatMap(p => p.produtos.map(pr => pr.codigo))
    ).size;

    const statusLabel = filtroStatus === "pendente" ? "Pendentes" : filtroStatus === "entregue" ? "Entregues" : "Todos";
    const dataGeracao = new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // ─── Cabeçalho ────────────────────────────────────────────────────────────
    const logoPath = getLogoPath();
    if (logoPath) {
      try { doc.image(logoPath, 40, 35, { width: 110, height: 44 }); } catch (_) {}
    }

    // Título à direita
    doc.fontSize(18).fillColor(blue).text("RELATÓRIO DE PEDIDOS", 40, 38, { width: 515, align: "right" });
    doc.fontSize(10).fillColor(gray).text(`Cometa Supermercados — ${statusLabel}`, 40, 60, { width: 515, align: "right" });
    doc.fontSize(8).fillColor(gray).text(`Emitido em: ${dataGeracao}`, 40, 74, { width: 515, align: "right" });

    doc.moveTo(40, 88).lineTo(555, 88).strokeColor(blue).lineWidth(2).stroke();
    doc.y = 98;

    // ─── Filtros aplicados (se houver) ───────────────────────────────────────
    if (filtrosAplicados) {
      const filtrosAtivos: string[] = [];
      if (filtrosAplicados.status && filtrosAplicados.status !== "todos") filtrosAtivos.push(`Status: ${filtrosAplicados.status === "pendente" ? "Pendente" : "Entregue"}`);
      if (filtrosAplicados.loja) filtrosAtivos.push(`Loja: ${filtrosAplicados.loja}`);
      if (filtrosAplicados.produto) filtrosAtivos.push(`Produto: ${filtrosAplicados.produto}`);
      if (filtrosAplicados.dataInicio || filtrosAplicados.dataFim) filtrosAtivos.push(`Período: ${filtrosAplicados.dataInicio || "início"} → ${filtrosAplicados.dataFim || "fim"}`);
      if (filtrosAplicados.busca) filtrosAtivos.push(`Busca: "${filtrosAplicados.busca}"`);
      if (filtrosAtivos.length > 0) {
        doc.rect(40, doc.y, 515, 20).fill("#fef9c3").stroke("#fbbf24");
        doc.fontSize(8).fillColor("#92400e").text(`Filtros: ${filtrosAtivos.join(" | ")}`, 46, doc.y - 16, { width: 503 });
        doc.y += 8;
      }
    }

    // ─── Cards de resumo ──────────────────────────────────────────────────────
    const cardW = 120;
    const cardH = 52;
    const cardY = doc.y;
    const cards = [
      { label: "PEDIDOS", value: String(pedidosFiltrados.length), sub: statusLabel, color: blue },
      { label: "UNIDADES", value: totalUnidades.toString(), sub: "para separar", color: green },
      { label: "PRODUTOS DISTINTOS", value: String(totalProdutosDistintos), sub: "SKUs diferentes", color: orange },
      { label: "VALOR TOTAL", value: formatCurrency(totalValor), sub: "todos os pedidos", color: red },
    ];
    cards.forEach((card, i) => {
      const x = 40 + i * (cardW + 8);
      doc.rect(x, cardY, cardW, cardH).fillAndStroke(lightBlue, blue);
      doc.fontSize(7).fillColor(gray).text(card.label, x + 6, cardY + 6, { width: cardW - 12 });
      doc.fontSize(13).fillColor(card.color).text(card.value, x + 6, cardY + 18, { width: cardW - 12 });
      doc.fontSize(7).fillColor(gray).text(card.sub, x + 6, cardY + 36, { width: cardW - 12 });
    });
    doc.y = cardY + cardH + 14;

    // ─── Consolidado de Produtos (para produção) ──────────────────────────────
    doc.fontSize(11).fillColor(blue).text("CONSOLIDADO PARA PRODUÇÃO / SEPARAÇÃO", 40, doc.y, { underline: false });
    doc.fontSize(8).fillColor(gray).text("Soma total de cada produto em todos os pedidos pendentes", 40, doc.y);
    doc.moveDown(0.4);

    // Consolidar produtos
    const prodMap = new Map<string, { nome: string; codigo: string; ean: string; qtd: number; valor_total: number }>();
    pedidosFiltrados.forEach(pedido => {
      pedido.produtos.forEach(pr => {
        const key = pr.codigo;
        if (!prodMap.has(key)) {
          prodMap.set(key, { nome: pr.nome, codigo: pr.codigo, ean: pr.ean, qtd: 0, valor_total: 0 });
        }
        const entry = prodMap.get(key)!;
        entry.qtd += pr.qtd;
        entry.valor_total += pr.valor_numerico;
      });
    });
    const prodConsolidados = Array.from(prodMap.values()).sort((a, b) => b.qtd - a.qtd);

    // Tabela consolidada
    const tX = 40;
    const colsConsolidado = [40, 200, 100, 70, 100];
    const headersConsolidado = ["Cód.", "Produto", "EAN", "Qtd Total", "Valor Total"];
    const hY = doc.y;
    doc.rect(tX, hY, 515, 16).fill(blue);
    let xp = tX;
    headersConsolidado.forEach((h, i) => {
      doc.fontSize(8).fillColor("white").text(h, xp + 3, hY + 4, { width: colsConsolidado[i] - 6, align: i >= 3 ? "right" : "left" });
      xp += colsConsolidado[i];
    });
    doc.y = hY + 16;

    prodConsolidados.forEach((pr, idx) => {
      if (doc.y > 720) { doc.addPage(); doc.y = 40; }
      const rowY = doc.y;
      const bg = idx % 2 === 0 ? "white" : lightGray;
      doc.rect(tX, rowY, 515, 14).fill(bg);
      let xr = tX;
      const rowData = [pr.codigo, pr.nome, pr.ean, pr.qtd.toString(), formatCurrency(pr.valor_total)];
      rowData.forEach((val, i) => {
        doc.fontSize(7.5).fillColor(darkGray).text(val, xr + 3, rowY + 3, {
          width: colsConsolidado[i] - 6,
          align: i >= 3 ? "right" : "left",
          ellipsis: true,
        });
        xr += colsConsolidado[i];
      });
      doc.y = rowY + 14;
    });

    // Linha de total
    const totY = doc.y;
    doc.rect(tX, totY, 515, 16).fill("#e0e7ff");
    doc.fontSize(8).fillColor(blue).text("TOTAL GERAL", tX + 3, totY + 4, { width: 340 });
    doc.fontSize(8).fillColor(blue).text(totalUnidades.toString(), tX + 340, totY + 4, { width: 70, align: "right" });
    doc.fontSize(8).fillColor(blue).text(formatCurrency(totalValor), tX + 410, totY + 4, { width: 100, align: "right" });
    doc.y = totY + 24;

    // ─── Detalhamento por Pedido ──────────────────────────────────────────────
    doc.addPage();
    doc.y = 40;
    doc.fontSize(13).fillColor(blue).text("DETALHAMENTO POR PEDIDO", 40, doc.y);
    doc.fontSize(8).fillColor(gray).text("Pedidos agrupados por loja com produtos e quantidades", 40, doc.y);
    doc.moveDown(0.6);

    // Ordenar por loja
    const pedidosOrdenados = [...pedidosFiltrados].sort((a, b) => a.loja_numero - b.loja_numero);

    pedidosOrdenados.forEach((pedido) => {
      if (doc.y > 680) { doc.addPage(); doc.y = 40; }

      // Cabeçalho do pedido
      const pedY = doc.y;
      const statusColor = pedido.status === "pendente" ? orange : green;
      doc.rect(40, pedY, 515, 22).fill(lightBlue);
      doc.rect(40, pedY, 4, 22).fill(blue);
      doc.fontSize(9).fillColor(blue).text(`Pedido #${pedido.numero_pedido}`, 50, pedY + 4);
      doc.fontSize(8).fillColor(gray).text(`${pedido.loja}  •  ${pedido.data}  •  ${pedido.itens} produto(s)  •  ${pedido.total_unidades} unidades`, 50, pedY + 14);
      doc.fontSize(9).fillColor(statusColor).text(pedido.status === "pendente" ? "PENDENTE" : "ENTREGUE", 380, pedY + 4, { width: 175, align: "right" });
      doc.fontSize(9).fillColor(blue).text(pedido.total, 380, pedY + 14, { width: 175, align: "right" });
      doc.y = pedY + 26;

      // Produtos do pedido
      const colsProd = [40, 185, 90, 50, 55, 75, 80];
      const headersProd = ["Cód.", "Produto", "EAN", "Qtd", "Emb.", "Vl. Unit.", "Total"];
      const hpY = doc.y;
      doc.rect(40, hpY, 515, 13).fill("#dbeafe");
      let xh = 40;
      headersProd.forEach((h, i) => {
        doc.fontSize(7).fillColor(blue).text(h, xh + 2, hpY + 3, { width: colsProd[i] - 4, align: i >= 3 ? "right" : "left" });
        xh += colsProd[i];
      });
      doc.y = hpY + 13;

      pedido.produtos.forEach((pr, idx) => {
        if (doc.y > 730) { doc.addPage(); doc.y = 40; }
        const prY = doc.y;
        const bg = idx % 2 === 0 ? "white" : "#f9fafb";
        doc.rect(40, prY, 515, 13).fill(bg);
        let xpr = 40;
        const vals = [pr.codigo, pr.nome, pr.ean, String(pr.qtd), String(pr.qtd_embalagem), formatCurrency(pr.valor_unitario), pr.valor];
        vals.forEach((v, i) => {
          doc.fontSize(7).fillColor(darkGray).text(v, xpr + 2, prY + 3, {
            width: colsProd[i] - 4,
            align: i >= 3 ? "right" : "left",
            ellipsis: true,
          });
          xpr += colsProd[i];
        });
        doc.y = prY + 13;
      });

      // Observação
      if (pedido.observacao) {
        const obsY = doc.y;
        doc.rect(40, obsY, 515, 12).fill("#fef9c3");
        doc.fontSize(6.5).fillColor("#92400e").text(`Obs: ${pedido.observacao}`, 44, obsY + 3, { width: 507, ellipsis: true });
        doc.y = obsY + 12;
      }

      doc.moveDown(0.5);
    });

    // ─── Rodapé ───────────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(7).fillColor(gray).text(
        `Lustra Mil — Relatório de Pedidos ${statusLabel} — Página ${i + 1} de ${range.count}`,
        40, 820, { align: "center", width: 515 }
      );
    }

    doc.end();
  });
}

// ─── Excel de Pedidos Cometa ──────────────────────────────────────────────────

export async function generateCometaPedidosExcel(
  pedidos: CometaPedidoRelatorio[],
  filtroStatus: "pendente" | "entregue" | "todos" = "pendente"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lustra Mil";

  const pedidosFiltrados = filtroStatus === "todos"
    ? pedidos
    : pedidos.filter(p => p.status === filtroStatus);

  const statusLabel = filtroStatus === "pendente" ? "Pendentes" : filtroStatus === "entregue" ? "Entregues" : "Todos";

  // ─── Aba 1: Consolidado por Produto ──────────────────────────────────────
  const sheetConsolidado = workbook.addWorksheet("Consolidado por Produto", {
    properties: { tabColor: { argb: "FF1E40AF" } },
  });

  sheetConsolidado.mergeCells("A1:G1");
  const t1 = sheetConsolidado.getCell("A1");
  t1.value = `Lustra Mil — Pedidos ${statusLabel} — Consolidado por Produto`;
  t1.font = { size: 14, bold: true, color: { argb: "FF1E40AF" } };
  t1.alignment = { horizontal: "center" };

  sheetConsolidado.mergeCells("A2:G2");
  const t2 = sheetConsolidado.getCell("A2");
  t2.value = `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`;
  t2.font = { size: 9, color: { argb: "FF666666" } };
  t2.alignment = { horizontal: "center" };

  sheetConsolidado.addRow([]);

  const hConsolidado = sheetConsolidado.addRow(["Código", "Produto", "EAN", "Qtd Total", "Valor Total (R$)", "Pedidos", "Lojas"]);
  hConsolidado.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });

  const prodMap = new Map<string, { nome: string; codigo: string; ean: string; qtd: number; valor: number; pedidos: Set<string>; lojas: Set<string> }>();
  pedidosFiltrados.forEach(pedido => {
    pedido.produtos.forEach(pr => {
      if (!prodMap.has(pr.codigo)) {
        prodMap.set(pr.codigo, { nome: pr.nome, codigo: pr.codigo, ean: pr.ean, qtd: 0, valor: 0, pedidos: new Set(), lojas: new Set() });
      }
      const e = prodMap.get(pr.codigo)!;
      e.qtd += pr.qtd;
      e.valor += pr.valor_numerico;
      e.pedidos.add(pedido.numero_pedido);
      e.lojas.add(pedido.loja);
    });
  });

  Array.from(prodMap.values()).sort((a, b) => b.qtd - a.qtd).forEach((pr, idx) => {
    const row = sheetConsolidado.addRow([pr.codigo, pr.nome, pr.ean, pr.qtd, pr.valor, pr.pedidos.size, pr.lojas.size]);
    if (idx % 2 === 1) {
      row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FF" } }; });
    }
    row.getCell(5).numFmt = '"R$"#,##0.00';
  });

  [12, 40, 18, 12, 18, 10, 10].forEach((w, i) => { sheetConsolidado.getColumn(i + 1).width = w; });

  // ─── Aba 2: Detalhamento por Pedido ──────────────────────────────────────
  const sheetPedidos = workbook.addWorksheet("Pedidos Detalhados", {
    properties: { tabColor: { argb: "FF059669" } },
  });

  sheetPedidos.mergeCells("A1:J1");
  const t3 = sheetPedidos.getCell("A1");
  t3.value = `Lustra Mil — Pedidos ${statusLabel} — Detalhamento Completo`;
  t3.font = { size: 14, bold: true, color: { argb: "FF1E40AF" } };
  t3.alignment = { horizontal: "center" };
  sheetPedidos.addRow([]);

  const hPedidos = sheetPedidos.addRow(["Pedido", "Data", "Loja", "CNPJ", "Status", "Código Produto", "Produto", "EAN", "Qtd", "Valor (R$)"]);
  hPedidos.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.alignment = { horizontal: "center" };
  });

  pedidosFiltrados.sort((a, b) => a.loja_numero - b.loja_numero).forEach(pedido => {
    pedido.produtos.forEach((pr, idx) => {
      const row = sheetPedidos.addRow([
        pedido.numero_pedido,
        pedido.data,
        pedido.loja,
        pedido.cnpj,
        pedido.status === "pendente" ? "Pendente" : "Entregue",
        pr.codigo,
        pr.nome,
        pr.ean,
        pr.qtd,
        pr.valor_numerico,
      ]);
      if (idx % 2 === 1) {
        row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } }; });
      }
      row.getCell(10).numFmt = '"R$"#,##0.00';
    });
  });

  [14, 12, 12, 18, 12, 12, 40, 18, 10, 14].forEach((w, i) => { sheetPedidos.getColumn(i + 1).width = w; });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
