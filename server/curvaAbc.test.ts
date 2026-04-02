import { describe, it, expect } from "vitest";

// Test the ABC classification logic
function classifyAbc(accumPercent: number): "A" | "B" | "C" {
  if (accumPercent <= 80) return "A";
  if (accumPercent <= 95) return "B";
  return "C";
}

describe("Curva ABC Classification", () => {
  it("should classify items with accum <= 80% as class A", () => {
    expect(classifyAbc(0)).toBe("A");
    expect(classifyAbc(10)).toBe("A");
    expect(classifyAbc(50)).toBe("A");
    expect(classifyAbc(79.99)).toBe("A");
    expect(classifyAbc(80)).toBe("A");
  });

  it("should classify items with accum 80-95% as class B", () => {
    expect(classifyAbc(80.01)).toBe("B");
    expect(classifyAbc(85)).toBe("B");
    expect(classifyAbc(90)).toBe("B");
    expect(classifyAbc(95)).toBe("B");
  });

  it("should classify items with accum > 95% as class C", () => {
    expect(classifyAbc(95.01)).toBe("C");
    expect(classifyAbc(99)).toBe("C");
    expect(classifyAbc(100)).toBe("C");
  });
});

describe("Curva ABC Data Processing", () => {
  const sampleItems = [
    { name: "Produto A", value: 50000, qty: 100 },
    { name: "Produto B", value: 30000, qty: 200 },
    { name: "Produto C", value: 10000, qty: 500 },
    { name: "Produto D", value: 5000, qty: 150 },
    { name: "Produto E", value: 3000, qty: 50 },
    { name: "Produto F", value: 1000, qty: 300 },
    { name: "Produto G", value: 500, qty: 80 },
    { name: "Produto H", value: 300, qty: 20 },
    { name: "Produto I", value: 100, qty: 10 },
    { name: "Produto J", value: 100, qty: 5 },
  ];

  it("should calculate correct percentages by value", () => {
    const totalValue = sampleItems.reduce((s, i) => s + i.value, 0);
    expect(totalValue).toBe(100000);

    const pctA = (50000 / 100000) * 100;
    expect(pctA).toBe(50);

    const pctB = (30000 / 100000) * 100;
    expect(pctB).toBe(30);
  });

  it("should calculate correct accumulated percentages", () => {
    const totalValue = sampleItems.reduce((s, i) => s + i.value, 0);
    const sorted = [...sampleItems].sort((a, b) => b.value - a.value);

    let accum = 0;
    const classified = sorted.map((item) => {
      const pct = (item.value / totalValue) * 100;
      accum += pct;
      return { ...item, pct, accum, class: classifyAbc(accum) };
    });

    // Produto A: 50% accum -> A
    expect(classified[0].class).toBe("A");
    expect(classified[0].accum).toBe(50);

    // Produto A + B: 80% accum -> A
    expect(classified[1].class).toBe("A");
    expect(classified[1].accum).toBe(80);

    // Produto C: 90% accum -> B
    expect(classified[2].class).toBe("B");
    expect(classified[2].accum).toBe(90);

    // Produto D: 95% accum -> B
    expect(classified[3].class).toBe("B");
    expect(classified[3].accum).toBe(95);

    // Produto E: 98% accum -> C
    expect(classified[4].class).toBe("C");
    expect(classified[4].accum).toBe(98);
  });

  it("should classify by quantity differently than by value", () => {
    const totalQty = sampleItems.reduce((s, i) => s + i.qty, 0);
    expect(totalQty).toBe(1415);

    const sortedByQty = [...sampleItems].sort((a, b) => b.qty - a.qty);
    // Top by qty: C(500), F(300), B(200), D(150), A(100)...
    expect(sortedByQty[0].name).toBe("Produto C");
    expect(sortedByQty[1].name).toBe("Produto F");

    let accum = 0;
    const classifiedQty = sortedByQty.map((item) => {
      const pct = (item.qty / totalQty) * 100;
      accum += pct;
      return { ...item, pct, accum, class: classifyAbc(accum) };
    });

    // Produto C by qty: ~35.3% -> A
    expect(classifiedQty[0].class).toBe("A");
    // Produto F by qty: ~35.3 + 21.2 = ~56.5% -> A
    expect(classifiedQty[1].class).toBe("A");
  });

  it("should handle empty data", () => {
    const empty: typeof sampleItems = [];
    const total = empty.reduce((s, i) => s + i.value, 0);
    expect(total).toBe(0);
  });

  it("should handle single item", () => {
    const single = [{ name: "Único", value: 1000, qty: 10 }];
    const total = single.reduce((s, i) => s + i.value, 0);
    const pct = (single[0].value / total) * 100;
    expect(pct).toBe(100);
    expect(classifyAbc(pct)).toBe("C"); // 100% accum -> technically C but it's the only item
  });

  it("should correctly identify A items as ~20% of items representing ~80% of value", () => {
    const totalValue = sampleItems.reduce((s, i) => s + i.value, 0);
    const sorted = [...sampleItems].sort((a, b) => b.value - a.value);

    let accum = 0;
    const classA = sorted.filter((item) => {
      const pct = (item.value / totalValue) * 100;
      accum += pct;
      return classifyAbc(accum) === "A";
    });

    // Class A should be a small number of items (2 out of 10 = 20%)
    expect(classA.length).toBe(2);
    const valueA = classA.reduce((s, i) => s + i.value, 0);
    expect((valueA / totalValue) * 100).toBe(80);
  });
});

describe("Curva ABC Formatting", () => {
  it("should format BRL currency correctly", () => {
    const fmtBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    expect(fmtBRL(1000)).toContain("1.000");
    expect(fmtBRL(0)).toContain("0,00");
  });

  it("should format percentages correctly", () => {
    const fmtPct = (v: number) => v.toFixed(2) + "%";
    expect(fmtPct(50)).toBe("50.00%");
    expect(fmtPct(33.333)).toBe("33.33%");
    expect(fmtPct(100)).toBe("100.00%");
    expect(fmtPct(0)).toBe("0.00%");
  });
});
