import { describe, it, expect } from "vitest";

// Test period range calculation logic (mirrors frontend getPeriodRange)
function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getPeriodRange(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  const now = new Date();

  if (period === "personalizado" && customStart && customEnd) {
    const s = new Date(customStart + "T00:00:00");
    const e = new Date(customEnd + "T23:59:59.999");
    return {
      start: s,
      end: e,
      label: `${s.toLocaleDateString("pt-BR")} \u2014 ${e.toLocaleDateString("pt-BR")}`,
    };
  }

  switch (period) {
    case "mes-atual": {
      const r = getMonthRange(0);
      return { ...r, label: formatMonthLabel(r.start) };
    }
    case "mes-anterior": {
      const r = getMonthRange(-1);
      return { ...r, label: formatMonthLabel(r.start) };
    }
    case "ultimos-3-meses": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: "Últimos 3 Meses" };
    }
    case "ultimos-6-meses": {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: "Últimos 6 Meses" };
    }
    case "ano-atual": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end, label: `Ano ${now.getFullYear()}` };
    }
    default: {
      const r = getMonthRange(0);
      return { ...r, label: formatMonthLabel(r.start) };
    }
  }
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase());
}

describe("Period filter logic", () => {
  it("mes-atual returns first and last day of current month", () => {
    const { start, end } = getPeriodRange("mes-atual");
    const now = new Date();
    expect(start.getMonth()).toBe(now.getMonth());
    expect(start.getFullYear()).toBe(now.getFullYear());
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(now.getMonth());
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("mes-anterior returns previous month range", () => {
    const { start, end } = getPeriodRange("mes-anterior");
    const now = new Date();
    const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    expect(start.getMonth()).toBe(expectedMonth);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(expectedMonth);
  });

  it("ultimos-3-meses spans 3 months", () => {
    const { start, end } = getPeriodRange("ultimos-3-meses");
    const now = new Date();
    // End should be end of current month
    expect(end.getMonth()).toBe(now.getMonth());
    // Start should be 2 months before current
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    expect(diffMonths).toBe(2);
  });

  it("ultimos-6-meses spans 6 months", () => {
    const { start, end } = getPeriodRange("ultimos-6-meses");
    const now = new Date();
    expect(end.getMonth()).toBe(now.getMonth());
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    expect(diffMonths).toBe(5);
  });

  it("ano-atual returns full year range", () => {
    const { start, end } = getPeriodRange("ano-atual");
    const now = new Date();
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(now.getFullYear());
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
    expect(end.getFullYear()).toBe(now.getFullYear());
  });

    it("personalizado returns custom date range", () => {
    const { start, end, label } = getPeriodRange("personalizado", "2025-06-01", "2025-06-30");
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(5); // June = 5
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(30);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(label).toContain("01/06/2025");
    expect(label).toContain("30/06/2025");
  });

  it("personalizado without dates defaults to current month", () => {
    const { start } = getPeriodRange("personalizado");
    const now = new Date();
    expect(start.getMonth()).toBe(now.getMonth());
    expect(start.getDate()).toBe(1);
  });

  it("unknown period defaults to current month", () => {
    const { start } = getPeriodRange("unknown");
    const now = new Date();
    expect(start.getMonth()).toBe(now.getMonth());
    expect(start.getDate()).toBe(1);
  });

  it("label for mes-atual contains month name", () => {
    const { label } = getPeriodRange("mes-atual");
    // Should contain a capitalized month name in Portuguese
    expect(label.length).toBeGreaterThan(5);
    // First char should be uppercase
    expect(label[0]).toBe(label[0].toUpperCase());
  });
});

describe("Pagination logic", () => {
  const ITEMS_PER_PAGE = 20;

  it("calculates total pages correctly", () => {
    expect(Math.max(1, Math.ceil(0 / ITEMS_PER_PAGE))).toBe(1);
    expect(Math.max(1, Math.ceil(1 / ITEMS_PER_PAGE))).toBe(1);
    expect(Math.max(1, Math.ceil(20 / ITEMS_PER_PAGE))).toBe(1);
    expect(Math.max(1, Math.ceil(21 / ITEMS_PER_PAGE))).toBe(2);
    expect(Math.max(1, Math.ceil(100 / ITEMS_PER_PAGE))).toBe(5);
  });

  it("slices items correctly for page 1", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const page = 1;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const sliced = items.slice(start, start + ITEMS_PER_PAGE);
    expect(sliced.length).toBe(20);
    expect(sliced[0]).toBe(0);
    expect(sliced[19]).toBe(19);
  });

  it("slices items correctly for page 2", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const page = 2;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const sliced = items.slice(start, start + ITEMS_PER_PAGE);
    expect(sliced.length).toBe(20);
    expect(sliced[0]).toBe(20);
    expect(sliced[19]).toBe(39);
  });

  it("slices items correctly for last page (partial)", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const page = 3;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const sliced = items.slice(start, start + ITEMS_PER_PAGE);
    expect(sliced.length).toBe(10);
    expect(sliced[0]).toBe(40);
    expect(sliced[9]).toBe(49);
  });
});

describe("Invoice period filtering logic", () => {
  it("filters invoices by date range", () => {
    const now = new Date();
    const { start, end } = getPeriodRange("mes-atual");

    const invoices = [
      { id: 1, createdAt: new Date(now.getFullYear(), now.getMonth(), 5).toISOString() }, // current month
      { id: 2, createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString() }, // last month
      { id: 3, createdAt: new Date(now.getFullYear(), now.getMonth(), 20).toISOString() }, // current month
      { id: 4, createdAt: new Date(now.getFullYear() - 1, 0, 10).toISOString() }, // last year
    ];

    const filtered = invoices.filter((inv) => {
      const invDate = new Date(inv.createdAt);
      return invDate >= start && invDate <= end;
    });

    expect(filtered.length).toBe(2);
    expect(filtered.map(f => f.id)).toEqual([1, 3]);
  });

  it("shows all invoices when period is 'todas'", () => {
    const invoices = [
      { id: 1, createdAt: new Date(2024, 0, 1).toISOString() },
      { id: 2, createdAt: new Date(2025, 5, 15).toISOString() },
      { id: 3, createdAt: new Date(2026, 1, 10).toISOString() },
    ];

    // "todas" uses range 2020-2030
    const start = new Date(2020, 0, 1);
    const end = new Date(2030, 11, 31, 23, 59, 59, 999);

    const filtered = invoices.filter((inv) => {
      const invDate = new Date(inv.createdAt);
      return invDate >= start && invDate <= end;
    });

    expect(filtered.length).toBe(3);
  });
});
