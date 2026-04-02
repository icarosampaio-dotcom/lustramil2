import { describe, it, expect } from "vitest";

// Test CSV parsing logic (same logic as in the router)
function parseCsvLine(line: string) {
  const cols = line.split(";");
  if (cols.length < 7) return null;
  const [cnpj, dateStr, productCode, internalCode, description, qtyStr, valueStr] = cols.map(c => c.trim());
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const saleDate = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
  if (isNaN(saleDate.getTime())) return null;
  const qty = parseFloat(qtyStr.replace(",", "."));
  const val = parseFloat(valueStr.replace(",", "."));
  if (isNaN(qty) || isNaN(val)) return null;
  return { cnpj, saleDate, productCode, internalCode, description, quantity: qty, grossSale: val };
}

function validateCsvHeader(headerLine: string) {
  const header = headerLine.split(";").map(h => h.trim());
  const expectedHeaders = ["CNPJ", "DATA VENDA", "COD PROD", "COD INTERNO", "DESC PRODUTO", "QTD VENDA", "VENDA BRUTA"];
  return expectedHeaders.every((h, i) => header[i]?.toUpperCase().includes(h.substring(0, 4)));
}

function calculateCommission(totalValue: number, percentage: number) {
  const discountValue = totalValue * (percentage / 100);
  const totalToPay = totalValue - discountValue;
  return { discountValue, totalToPay };
}

describe("Vendas ABC - CSV Parser", () => {
  it("validates correct CSV header", () => {
    const header = "CNPJ;DATA VENDA;COD PROD;COD INTERNO;DESC PRODUTO;QTD VENDA;VENDA BRUTA";
    expect(validateCsvHeader(header)).toBe(true);
  });

  it("rejects invalid CSV header", () => {
    const header = "Nome;Data;Valor";
    expect(validateCsvHeader(header)).toBe(false);
  });

  it("parses valid CSV line correctly", () => {
    const line = "06887668000160;01/01/2026;7898960412123;1234;SABAO EM PO 1KG;10,00;150,00";
    const result = parseCsvLine(line);
    expect(result).not.toBeNull();
    expect(result!.cnpj).toBe("06887668000160");
    expect(result!.productCode).toBe("7898960412123");
    expect(result!.internalCode).toBe("1234");
    expect(result!.description).toBe("SABAO EM PO 1KG");
    expect(result!.quantity).toBe(10);
    expect(result!.grossSale).toBe(150);
  });

  it("parses date correctly as UTC", () => {
    const line = "06887668000160;15/01/2026;7898960412123;1234;PRODUTO;5,00;50,00";
    const result = parseCsvLine(line);
    expect(result).not.toBeNull();
    expect(result!.saleDate.getUTCFullYear()).toBe(2026);
    expect(result!.saleDate.getUTCMonth()).toBe(0); // January = 0
    expect(result!.saleDate.getUTCDate()).toBe(15);
  });

  it("handles negative quantities (cancellations)", () => {
    const line = "06887668000160;10/01/2026;7898960412123;1234;PRODUTO;-3,00;-45,00";
    const result = parseCsvLine(line);
    expect(result).not.toBeNull();
    expect(result!.quantity).toBe(-3);
    expect(result!.grossSale).toBe(-45);
  });

  it("handles decimal quantities with comma separator", () => {
    const line = "06887668000160;10/01/2026;7898960412123;1234;PRODUTO;2,50;37,50";
    const result = parseCsvLine(line);
    expect(result).not.toBeNull();
    expect(result!.quantity).toBe(2.5);
    expect(result!.grossSale).toBe(37.5);
  });

  it("returns null for line with too few columns", () => {
    const line = "06887668000160;01/01/2026;7898960412123";
    expect(parseCsvLine(line)).toBeNull();
  });

  it("returns null for invalid date format", () => {
    const line = "06887668000160;2026-01-01;7898960412123;1234;PRODUTO;5,00;50,00";
    expect(parseCsvLine(line)).toBeNull();
  });

  it("returns null for non-numeric quantity", () => {
    const line = "06887668000160;01/01/2026;7898960412123;1234;PRODUTO;abc;50,00";
    expect(parseCsvLine(line)).toBeNull();
  });

  it("returns null for non-numeric value", () => {
    const line = "06887668000160;01/01/2026;7898960412123;1234;PRODUTO;5,00;abc";
    expect(parseCsvLine(line)).toBeNull();
  });

  it("parses multiple lines and aggregates", () => {
    const csv = [
      "CNPJ;DATA VENDA;COD PROD;COD INTERNO;DESC PRODUTO;QTD VENDA;VENDA BRUTA",
      "06887668000160;01/01/2026;7898960412123;1234;SABAO PO 1KG;10,00;150,00",
      "06887668000160;02/01/2026;7898960412456;5678;DETERGENTE 500ML;5,00;25,00",
      "06887668000160;03/01/2026;7898960412123;1234;SABAO PO 1KG;-2,00;-30,00",
    ];
    const lines = csv.slice(1); // skip header
    const parsed = lines.map(l => parseCsvLine(l)).filter(Boolean);
    expect(parsed).toHaveLength(3);
    const total = parsed.reduce((sum, p) => sum + p!.grossSale, 0);
    expect(total).toBe(145); // 150 + 25 - 30
  });
});

describe("Vendas ABC - Commission Calculation", () => {
  it("calculates 35% commission correctly", () => {
    const { discountValue, totalToPay } = calculateCommission(1000, 35);
    expect(discountValue).toBe(350);
    expect(totalToPay).toBe(650);
  });

  it("calculates 0% commission", () => {
    const { discountValue, totalToPay } = calculateCommission(1000, 0);
    expect(discountValue).toBe(0);
    expect(totalToPay).toBe(1000);
  });

  it("calculates 100% commission", () => {
    const { discountValue, totalToPay } = calculateCommission(500, 100);
    expect(discountValue).toBe(500);
    expect(totalToPay).toBe(0);
  });

  it("handles decimal percentages", () => {
    const { discountValue, totalToPay } = calculateCommission(1000, 12.5);
    expect(discountValue).toBe(125);
    expect(totalToPay).toBe(875);
  });

  it("handles zero total value", () => {
    const { discountValue, totalToPay } = calculateCommission(0, 35);
    expect(discountValue).toBe(0);
    expect(totalToPay).toBe(0);
  });
});

describe("Vendas ABC - CNPJ Formatting", () => {
  function fmtCnpj(cnpj: string) {
    const c = cnpj.replace(/\D/g, "");
    if (c.length === 14) {
      return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
    }
    return cnpj;
  }

  it("formats 14-digit CNPJ correctly", () => {
    expect(fmtCnpj("06887668000160")).toBe("06.887.668/0001-60");
  });

  it("returns original string for non-14-digit input", () => {
    expect(fmtCnpj("12345")).toBe("12345");
  });

  it("handles already formatted CNPJ", () => {
    expect(fmtCnpj("06.887.668/0001-60")).toBe("06.887.668/0001-60");
  });
});

describe("Vendas ABC - Date Parsing", () => {
  it("parses DD/MM/YYYY format to correct UTC date", () => {
    const parts = "31/01/2026".split("/");
    const d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(31);
  });

  it("does not shift date due to timezone", () => {
    const parts = "31/01/2026".split("/");
    const d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
    // When displayed with UTC timezone, should still be 31
    const formatted = d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    expect(formatted).toBe("31/01/2026");
  });

  it("handles leap year date", () => {
    const parts = "29/02/2028".split("/");
    const d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
    expect(d.getUTCDate()).toBe(29);
    expect(d.getUTCMonth()).toBe(1);
  });
});
