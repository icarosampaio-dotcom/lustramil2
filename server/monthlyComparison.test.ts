import { describe, it, expect } from "vitest";

describe("Monthly Comparison Data Structure", () => {
  // Test the data parsing logic used in the frontend
  const parseMonthlySummary = (agg: { type: string; count: number; totalValue: number }[]) => {
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

  const parseDailyData = (daily: { day: number; type: string; totalValue: number }[]) => {
    const map: Record<number, { day: number; valueIn: number; valueOut: number }> = {};
    daily.forEach((r) => {
      const d = Number(r.day);
      if (!map[d]) map[d] = { day: d, valueIn: 0, valueOut: 0 };
      if (r.type === "entrada") map[d].valueIn += Number(r.totalValue);
      else map[d].valueOut += Number(r.totalValue);
    });
    return Object.values(map).sort((a, b) => a.day - b.day);
  };

  it("parses monthly summary correctly with mixed types", () => {
    const agg = [
      { type: "entrada", count: 5, totalValue: 1500 },
      { type: "saida", count: 3, totalValue: 900 },
    ];
    const result = parseMonthlySummary(agg);
    expect(result.entradas).toBe(5);
    expect(result.saidas).toBe(3);
    expect(result.valueIn).toBe(1500);
    expect(result.valueOut).toBe(900);
    expect(result.count).toBe(8);
  });

  it("parses monthly summary with only entradas", () => {
    const agg = [{ type: "entrada", count: 10, totalValue: 5000 }];
    const result = parseMonthlySummary(agg);
    expect(result.entradas).toBe(10);
    expect(result.saidas).toBe(0);
    expect(result.valueIn).toBe(5000);
    expect(result.valueOut).toBe(0);
  });

  it("parses monthly summary with empty data", () => {
    const result = parseMonthlySummary([]);
    expect(result.entradas).toBe(0);
    expect(result.saidas).toBe(0);
    expect(result.valueIn).toBe(0);
    expect(result.valueOut).toBe(0);
    expect(result.count).toBe(0);
  });

  it("parses daily data correctly", () => {
    const daily = [
      { day: 1, type: "entrada", totalValue: 500 },
      { day: 1, type: "saida", totalValue: 200 },
      { day: 5, type: "entrada", totalValue: 300 },
      { day: 10, type: "saida", totalValue: 150 },
    ];
    const result = parseDailyData(daily);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ day: 1, valueIn: 500, valueOut: 200 });
    expect(result[1]).toEqual({ day: 5, valueIn: 300, valueOut: 0 });
    expect(result[2]).toEqual({ day: 10, valueIn: 0, valueOut: 150 });
  });

  it("parses daily data with empty input", () => {
    const result = parseDailyData([]);
    expect(result).toHaveLength(0);
  });

  it("aggregates multiple entries for same day", () => {
    const daily = [
      { day: 3, type: "entrada", totalValue: 100 },
      { day: 3, type: "entrada", totalValue: 200 },
      { day: 3, type: "saida", totalValue: 50 },
    ];
    const result = parseDailyData(daily);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ day: 3, valueIn: 300, valueOut: 50 });
  });

  it("returns days sorted in ascending order", () => {
    const daily = [
      { day: 15, type: "entrada", totalValue: 100 },
      { day: 3, type: "saida", totalValue: 200 },
      { day: 28, type: "entrada", totalValue: 300 },
    ];
    const result = parseDailyData(daily);
    expect(result[0].day).toBe(3);
    expect(result[1].day).toBe(15);
    expect(result[2].day).toBe(28);
  });

  // Test variation calculation logic
  it("calculates variation percentage correctly", () => {
    const current = { valueIn: 2000, valueOut: 3000 };
    const previous = { valueIn: 1500, valueOut: 2500 };
    const curTotal = current.valueIn + current.valueOut;
    const prevTotal = previous.valueIn + previous.valueOut;
    const variation = ((curTotal - prevTotal) / prevTotal) * 100;
    expect(variation).toBeCloseTo(25, 1); // 5000 vs 4000 = +25%
  });

  it("handles zero previous month gracefully", () => {
    const current = { valueIn: 1000, valueOut: 500 };
    const previous = { valueIn: 0, valueOut: 0 };
    const curTotal = current.valueIn + current.valueOut;
    const prevTotal = previous.valueIn + previous.valueOut;
    const variation = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : curTotal > 0 ? 100 : 0;
    expect(variation).toBe(100);
  });

  it("handles both months zero", () => {
    const current = { valueIn: 0, valueOut: 0 };
    const previous = { valueIn: 0, valueOut: 0 };
    const curTotal = current.valueIn + current.valueOut;
    const prevTotal = previous.valueIn + previous.valueOut;
    const variation = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : curTotal > 0 ? 100 : 0;
    expect(variation).toBe(0);
  });

  it("calculates negative variation correctly", () => {
    const current = { valueIn: 800, valueOut: 1200 };
    const previous = { valueIn: 1500, valueOut: 2500 };
    const curTotal = current.valueIn + current.valueOut;
    const prevTotal = previous.valueIn + previous.valueOut;
    const variation = ((curTotal - prevTotal) / prevTotal) * 100;
    expect(variation).toBe(-50); // 2000 vs 4000 = -50%
  });

  // Test chart data generation logic (frontend)
  it("generates comparison chart data correctly", () => {
    const dailyCurrent = [
      { day: 1, valueIn: 500, valueOut: 300 },
      { day: 5, valueIn: 200, valueOut: 100 },
    ];
    const dailyPrevious = [
      { day: 1, valueIn: 400, valueOut: 200 },
      { day: 3, valueIn: 100, valueOut: 50 },
    ];

    const currentMap: Record<number, number> = {};
    const previousMap: Record<number, number> = {};
    dailyCurrent.forEach((d) => { currentMap[d.day] = d.valueOut + d.valueIn; });
    dailyPrevious.forEach((d) => { previousMap[d.day] = d.valueOut + d.valueIn; });

    const result: { day: string; mesAtual: number; mesAnterior: number }[] = [];
    for (let i = 1; i <= 31; i++) {
      if (currentMap[i] !== undefined || previousMap[i] !== undefined) {
        result.push({
          day: String(i).padStart(2, "0"),
          mesAtual: currentMap[i] || 0,
          mesAnterior: previousMap[i] || 0,
        });
      }
    }

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ day: "01", mesAtual: 800, mesAnterior: 600 });
    expect(result[1]).toEqual({ day: "03", mesAtual: 0, mesAnterior: 150 });
    expect(result[2]).toEqual({ day: "05", mesAtual: 300, mesAnterior: 0 });
  });
});
