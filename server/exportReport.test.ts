import { describe, it, expect } from "vitest";
import { generateExcel, generatePDF, type MovementRow } from "./exportReport";

const sampleMovements: MovementRow[] = [
  {
    id: 1,
    productId: 10,
    productName: "Detergente Neutro 500ml",
    type: "entrada",
    quantity: "50",
    unitPrice: "3.50",
    totalPrice: "175.00",
    createdAt: new Date("2025-06-15T10:00:00"),
  },
  {
    id: 2,
    productId: 10,
    productName: "Detergente Neutro 500ml",
    type: "saida",
    quantity: "20",
    unitPrice: "5.00",
    totalPrice: "100.00",
    createdAt: new Date("2025-06-18T14:00:00"),
  },
  {
    id: 3,
    productId: 20,
    productName: "Água Sanitária 1L",
    type: "entrada",
    quantity: "100",
    unitPrice: "2.00",
    totalPrice: "200.00",
    createdAt: new Date("2025-06-20T09:00:00"),
  },
  {
    id: 4,
    productId: 20,
    productName: "Água Sanitária 1L",
    type: "saida",
    quantity: "30",
    unitPrice: "3.50",
    totalPrice: "105.00",
    createdAt: new Date("2025-06-22T16:00:00"),
  },
];

const startDate = new Date("2025-06-01T00:00:00");
const endDate = new Date("2025-06-30T23:59:59");

describe("generateExcel", () => {
  it("returns a Buffer with valid XLSX content", async () => {
    const buffer = await generateExcel(sampleMovements, startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // XLSX files start with PK (ZIP signature)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("generates Excel for empty movements", async () => {
    const buffer = await generateExcel([], startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // Still a valid XLSX
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("generates Excel for quantidade view mode", async () => {
    const buffer = await generateExcel(sampleMovements, startDate, endDate, "quantidade");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("generates larger file with more movements", async () => {
    const manyMovements: MovementRow[] = [];
    for (let i = 0; i < 100; i++) {
      manyMovements.push({
        id: i + 1,
        productId: (i % 5) + 1,
        productName: `Produto ${(i % 5) + 1}`,
        type: i % 2 === 0 ? "entrada" : "saida",
        quantity: String(Math.floor(Math.random() * 100) + 1),
        unitPrice: String((Math.random() * 50 + 1).toFixed(2)),
        totalPrice: String((Math.random() * 5000 + 10).toFixed(2)),
        createdAt: new Date(2025, 5, (i % 28) + 1),
      });
    }
    const buffer = await generateExcel(manyMovements, startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("generatePDF", () => {
  it("returns a Buffer with valid PDF content", async () => {
    const buffer = await generatePDF(sampleMovements, startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF files start with %PDF
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("generates PDF for empty movements", async () => {
    const buffer = await generatePDF([], startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("generates PDF for quantidade view mode", async () => {
    const buffer = await generatePDF(sampleMovements, startDate, endDate, "quantidade");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles movements with null values gracefully", async () => {
    const movementsWithNulls: MovementRow[] = [
      {
        id: 1,
        productId: null,
        productName: null,
        type: "entrada",
        quantity: "10",
        unitPrice: null,
        totalPrice: null,
        createdAt: new Date("2025-06-15"),
      },
    ];
    const buffer = await generatePDF(movementsWithNulls, startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("generates multi-page PDF with many movements", async () => {
    const manyMovements: MovementRow[] = [];
    for (let i = 0; i < 100; i++) {
      manyMovements.push({
        id: i + 1,
        productId: (i % 5) + 1,
        productName: `Produto de Limpeza ${(i % 5) + 1}`,
        type: i % 2 === 0 ? "entrada" : "saida",
        quantity: String(Math.floor(Math.random() * 100) + 1),
        unitPrice: String((Math.random() * 50 + 1).toFixed(2)),
        totalPrice: String((Math.random() * 5000 + 10).toFixed(2)),
        createdAt: new Date(2025, 5, (i % 28) + 1),
      });
    }
    const buffer = await generatePDF(manyMovements, startDate, endDate, "financeiro");
    expect(buffer).toBeInstanceOf(Buffer);
    // Multi-page PDF should be larger
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
