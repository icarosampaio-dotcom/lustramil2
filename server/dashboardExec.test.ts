import { describe, it, expect } from "vitest";

// Test the classification logic and data structure expectations for the Dashboard Executivo

describe("Dashboard Executivo - Margem Bruta", () => {
  it("should calculate margin correctly", () => {
    const salePrice = 10.0;
    const productionCost = 6.0;
    const margin = salePrice - productionCost;
    const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0;

    expect(margin).toBe(4.0);
    expect(marginPercent).toBe(40.0);
  });

  it("should handle zero sale price", () => {
    const salePrice = 0;
    const productionCost = 5.0;
    const margin = salePrice - productionCost;
    const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0;

    expect(margin).toBe(-5.0);
    expect(marginPercent).toBe(0);
  });

  it("should handle zero production cost (no ficha)", () => {
    const salePrice = 10.0;
    const productionCost = 0;
    const margin = salePrice - productionCost;
    const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0;

    expect(margin).toBe(10.0);
    expect(marginPercent).toBe(100.0);
  });

  it("should detect negative margin", () => {
    const salePrice = 5.0;
    const productionCost = 8.0;
    const margin = salePrice - productionCost;
    const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0;

    expect(margin).toBe(-3.0);
    expect(marginPercent).toBeLessThan(0);
  });

  it("should classify margin colors correctly", () => {
    const getMarginColor = (pct: number) => {
      if (pct >= 30) return "emerald";
      if (pct >= 15) return "yellow";
      if (pct >= 0) return "orange";
      return "red";
    };

    expect(getMarginColor(50)).toBe("emerald");
    expect(getMarginColor(30)).toBe("emerald");
    expect(getMarginColor(20)).toBe("yellow");
    expect(getMarginColor(15)).toBe("yellow");
    expect(getMarginColor(10)).toBe("orange");
    expect(getMarginColor(0)).toBe("orange");
    expect(getMarginColor(-5)).toBe("red");
  });
});

describe("Dashboard Executivo - Monthly Revenue", () => {
  it("should calculate resultado correctly", () => {
    const vendas = 32015.76;
    const compras = 2056.0;
    const resultado = vendas - compras;

    expect(resultado).toBeCloseTo(29959.76, 2);
  });

  it("should calculate month-over-month growth", () => {
    const lastMonth = 32000;
    const prevMonth = 28000;
    const growth = ((lastMonth - prevMonth) / prevMonth) * 100;

    expect(growth).toBeCloseTo(14.29, 1);
  });

  it("should handle zero previous month (no division by zero)", () => {
    const lastMonth = 32000;
    const prevMonth = 0;
    const growth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

    expect(growth).toBe(0);
  });

  it("should format month names correctly", () => {
    const MONTH_NAMES: Record<string, string> = {
      "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
      "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
      "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    };

    expect(MONTH_NAMES["01"]).toBe("Jan");
    expect(MONTH_NAMES["06"]).toBe("Jun");
    expect(MONTH_NAMES["12"]).toBe("Dez");
  });

  it("should parse yearMonth format correctly", () => {
    const yearMonth = "2026-01";
    const [year, month] = yearMonth.split("-");
    expect(year).toBe("2026");
    expect(month).toBe("01");
    expect(`${month}/${year.slice(2)}`).toBe("01/26");
  });
});

describe("Dashboard Executivo - Alertas Insumos Classe A", () => {
  it("should classify insumos as classe A (top 80%)", () => {
    const classifyAbc = (accumPercent: number): "A" | "B" | "C" => {
      if (accumPercent <= 80) return "A";
      if (accumPercent <= 95) return "B";
      return "C";
    };

    expect(classifyAbc(10)).toBe("A");
    expect(classifyAbc(50)).toBe("A");
    expect(classifyAbc(80)).toBe("A");
    expect(classifyAbc(81)).toBe("B");
    expect(classifyAbc(95)).toBe("B");
    expect(classifyAbc(96)).toBe("C");
  });

  it("should detect low stock status correctly", () => {
    const getStatus = (currentStock: number, minStock: number) => {
      if (currentStock === 0) return "zerado";
      if (currentStock <= minStock) return "abaixo_minimo";
      return "ok";
    };

    expect(getStatus(0, 10)).toBe("zerado");
    expect(getStatus(5, 10)).toBe("abaixo_minimo");
    expect(getStatus(10, 10)).toBe("abaixo_minimo");
    expect(getStatus(15, 10)).toBe("ok");
  });

  it("should calculate deficit correctly", () => {
    const deficit = (currentStock: number, minStock: number) => Math.max(0, minStock - currentStock);

    expect(deficit(5, 10)).toBe(5);
    expect(deficit(0, 10)).toBe(10);
    expect(deficit(15, 10)).toBe(0);
    expect(deficit(10, 10)).toBe(0);
  });

  it("should filter only classe A with low stock", () => {
    const insumos = [
      { id: 1, stockValue: 1000, currentStock: 0, minStock: 10 },   // A + zerado
      { id: 2, stockValue: 800, currentStock: 5, minStock: 10 },    // A + baixo
      { id: 3, stockValue: 500, currentStock: 50, minStock: 10 },   // A + ok
      { id: 4, stockValue: 100, currentStock: 0, minStock: 5 },     // B/C + zerado
    ];

    const grandTotal = insumos.reduce((s, i) => s + i.stockValue, 0);
    const sorted = [...insumos].sort((a, b) => b.stockValue - a.stockValue);
    let accum = 0;
    const classeAIds = new Set<number>();
    for (const item of sorted) {
      const pv = grandTotal > 0 ? (item.stockValue / grandTotal) * 100 : 0;
      accum += pv;
      if (accum <= 80) classeAIds.add(item.id);
      else break;
    }

    const alerts = insumos.filter(
      i => classeAIds.has(i.id) && (i.currentStock <= i.minStock || i.currentStock === 0)
    );

    // id=1 (A, zerado) and id=2 (A, baixo) should be alerts
    // id=3 (A, ok) should NOT be alert
    // id=4 (not A) should NOT be alert
    expect(alerts.length).toBe(2);
    expect(alerts.map(a => a.id)).toContain(1);
    expect(alerts.map(a => a.id)).toContain(2);
    expect(alerts.map(a => a.id)).not.toContain(3);
    expect(alerts.map(a => a.id)).not.toContain(4);
  });
});

describe("Dashboard Executivo - Summary calculations", () => {
  it("should calculate average margin from products with cost", () => {
    const products = [
      { marginPercent: 40, productionCost: 6 },
      { marginPercent: 20, productionCost: 8 },
      { marginPercent: 0, productionCost: 0 },  // no ficha, should be excluded
    ];

    const withCost = products.filter(p => p.productionCost > 0);
    const avgMargin = withCost.length > 0
      ? withCost.reduce((s, p) => s + p.marginPercent, 0) / withCost.length
      : 0;

    expect(avgMargin).toBe(30);
  });

  it("should count products without ficha", () => {
    const products = [
      { salePrice: 10, productionCost: 6 },
      { salePrice: 5, productionCost: 0 },
      { salePrice: 8, productionCost: 0 },
    ];

    const noCostCount = products.filter(p => p.productionCost === 0 && p.salePrice > 0).length;
    expect(noCostCount).toBe(2);
  });
});
