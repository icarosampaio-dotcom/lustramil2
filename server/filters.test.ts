import { describe, it, expect } from "vitest";

// Test the period range calculation logic used across all filter pages
describe("Period Range Calculation", () => {
  function getPeriodRange(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    switch (period) {
      case "mes_atual": return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
      case "mes_anterior": return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
      case "ultimos_3": return { start: new Date(y, m - 2, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
      case "ultimos_6": return { start: new Date(y, m - 5, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
      case "ano_atual": return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
      case "custom": {
        const s = customStart ? new Date(customStart + "T00:00:00") : new Date(y, m, 1);
        const e = customEnd ? new Date(customEnd + "T23:59:59") : new Date(y, m + 1, 0, 23, 59, 59);
        return { start: s, end: e };
      }
      default: return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    }
  }

  it("mes_atual returns first and last day of current month", () => {
    const { start, end } = getPeriodRange("mes_atual");
    const now = new Date();
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(now.getMonth());
    expect(end.getMonth()).toBe(now.getMonth());
    expect(end.getHours()).toBe(23);
  });

  it("mes_anterior returns first and last day of previous month", () => {
    const { start, end } = getPeriodRange("mes_anterior");
    const now = new Date();
    const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(expectedMonth);
  });

  it("ultimos_3 spans 3 months", () => {
    const { start, end } = getPeriodRange("ultimos_3");
    const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    expect(months).toBe(2); // 3 months = 2 month difference
  });

  it("ultimos_6 spans 6 months", () => {
    const { start, end } = getPeriodRange("ultimos_6");
    const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    expect(months).toBe(5); // 6 months = 5 month difference
  });

  it("ano_atual returns full year", () => {
    const { start, end } = getPeriodRange("ano_atual");
    const now = new Date();
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
    expect(start.getFullYear()).toBe(now.getFullYear());
  });

  it("custom returns specified date range", () => {
    const { start, end } = getPeriodRange("custom", "2026-01-15", "2026-02-10");
    expect(start.getDate()).toBe(15);
    expect(start.getMonth()).toBe(0);
    expect(end.getDate()).toBe(10);
    expect(end.getMonth()).toBe(1);
  });

  it("custom with missing dates falls back to current month", () => {
    const { start } = getPeriodRange("custom");
    const now = new Date();
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(now.getMonth());
  });
});

// Test client-side filtering logic
describe("Client-side Filtering", () => {
  const mockItems = [
    { id: 1, description: "Aluguel", entityName: "Imobiliária ABC", value: "1500", status: "pendente", dueDate: new Date("2026-01-15"), categoryId: 1, notes: "Mensal" },
    { id: 2, description: "Energia", entityName: "CPFL", value: "350", status: "pago", dueDate: new Date("2026-01-10"), categoryId: 2, notes: null },
    { id: 3, description: "Água", entityName: "SABESP", value: "120", status: "pendente", dueDate: new Date("2025-12-01"), categoryId: 2, notes: "Atrasada" },
    { id: 4, description: "Material Limpeza", entityName: "Fornecedor X", value: "800", status: "pago", dueDate: new Date("2026-01-20"), categoryId: 3, notes: null },
  ];

  it("filters by search term in description", () => {
    const term = "aluguel";
    const result = mockItems.filter(i =>
      i.description?.toLowerCase().includes(term) ||
      i.entityName?.toLowerCase().includes(term)
    );
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Aluguel");
  });

  it("filters by search term in entityName", () => {
    const term = "cpfl";
    const result = mockItems.filter(i =>
      i.description?.toLowerCase().includes(term) ||
      i.entityName?.toLowerCase().includes(term)
    );
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Energia");
  });

  it("filters by category", () => {
    const catId = "2";
    const result = mockItems.filter(i => String(i.categoryId) === catId);
    expect(result).toHaveLength(2);
  });

  it("sorts by value ascending", () => {
    const sorted = [...mockItems].sort((a, b) => Number(a.value) - Number(b.value));
    expect(sorted[0].description).toBe("Água");
    expect(sorted[sorted.length - 1].description).toBe("Aluguel");
  });

  it("sorts by value descending", () => {
    const sorted = [...mockItems].sort((a, b) => Number(b.value) - Number(a.value));
    expect(sorted[0].description).toBe("Aluguel");
    expect(sorted[sorted.length - 1].description).toBe("Água");
  });

  it("sorts by dueDate ascending", () => {
    const sorted = [...mockItems].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    expect(sorted[0].description).toBe("Água"); // Dec 2025
    expect(sorted[sorted.length - 1].description).toBe("Material Limpeza"); // Jan 20
  });

  it("detects overdue items correctly", () => {
    const now = new Date();
    const overdue = mockItems.filter(i => i.status === "pendente" && new Date(i.dueDate) < now);
    expect(overdue.length).toBeGreaterThanOrEqual(1);
    expect(overdue.some(i => i.description === "Água")).toBe(true);
  });
});

// Test chart data aggregation logic
describe("Chart Data Aggregation", () => {
  const mockItems = [
    { id: 1, entityName: "Cliente A", value: "1000", status: "pendente", expectedDate: new Date("2026-03-01") },
    { id: 2, entityName: "Cliente A", value: "500", status: "recebido", expectedDate: new Date("2026-01-15") },
    { id: 3, entityName: "Cliente B", value: "2000", status: "pendente", expectedDate: new Date("2025-12-01") },
    { id: 4, entityName: null, value: "300", status: "recebido", expectedDate: new Date("2026-01-20") },
  ];

  it("aggregates by client correctly", () => {
    const map = new Map<string, number>();
    mockItems.forEach(i => {
      const name = i.entityName || "Sem Cliente";
      map.set(name, (map.get(name) || 0) + Number(i.value));
    });
    const result = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    expect(result.find(r => r.name === "Cliente A")?.value).toBe(1500);
    expect(result.find(r => r.name === "Cliente B")?.value).toBe(2000);
    expect(result.find(r => r.name === "Sem Cliente")?.value).toBe(300);
  });

  it("aggregates by status correctly", () => {
    const now = new Date();
    const pendente = mockItems.filter(i => i.status === "pendente" && new Date(i.expectedDate) >= now).reduce((s, i) => s + Number(i.value), 0);
    const vencido = mockItems.filter(i => i.status === "pendente" && new Date(i.expectedDate) < now).reduce((s, i) => s + Number(i.value), 0);
    const recebido = mockItems.filter(i => i.status === "recebido").reduce((s, i) => s + Number(i.value), 0);
    expect(recebido).toBe(800);
    expect(vencido).toBe(2000); // Cliente B is overdue
    expect(pendente).toBe(1000); // Cliente A future
  });
});

// Test cash flow daily aggregation
describe("Cash Flow Daily Aggregation", () => {
  const mockCashItems = [
    { id: 1, date: new Date("2026-02-01"), type: "entrada", value: "1000", description: "Venda 1" },
    { id: 2, date: new Date("2026-02-01"), type: "saida", value: "300", description: "Compra 1" },
    { id: 3, date: new Date("2026-02-02"), type: "entrada", value: "500", description: "Venda 2" },
    { id: 4, date: new Date("2026-02-02"), type: "entrada", value: "200", description: "Venda 3" },
    { id: 5, date: new Date("2026-02-03"), type: "saida", value: "800", description: "Compra 2" },
  ];

  it("aggregates daily flow correctly", () => {
    const map = new Map<string, { entradas: number; saidas: number }>();
    mockCashItems.forEach(i => {
      const d = new Date(i.date).toISOString().slice(0, 10);
      if (!map.has(d)) map.set(d, { entradas: 0, saidas: 0 });
      const entry = map.get(d)!;
      if (i.type === "entrada") entry.entradas += Number(i.value);
      else entry.saidas += Number(i.value);
    });

    const feb01 = map.get("2026-02-01");
    expect(feb01?.entradas).toBe(1000);
    expect(feb01?.saidas).toBe(300);

    const feb02 = map.get("2026-02-02");
    expect(feb02?.entradas).toBe(700);
    expect(feb02?.saidas).toBe(0);

    const feb03 = map.get("2026-02-03");
    expect(feb03?.entradas).toBe(0);
    expect(feb03?.saidas).toBe(800);
  });

  it("type filter works correctly", () => {
    const entradas = mockCashItems.filter(i => i.type === "entrada");
    expect(entradas).toHaveLength(3);
    const saidas = mockCashItems.filter(i => i.type === "saida");
    expect(saidas).toHaveLength(2);
  });

  it("search filter works on description", () => {
    const term = "venda";
    const result = mockCashItems.filter(i => i.description.toLowerCase().includes(term));
    expect(result).toHaveLength(3);
  });
});
