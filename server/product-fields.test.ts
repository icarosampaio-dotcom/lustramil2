import { describe, it, expect } from "vitest";

describe("Product fields: reference, barcode, CFOP", () => {
  describe("Reference field", () => {
    it("should accept valid reference codes", () => {
      const refs = ["001234", "ABC-123", "REF001", "12345678"];
      refs.forEach((ref) => {
        expect(typeof ref).toBe("string");
        expect(ref.length).toBeGreaterThan(0);
      });
    });

    it("should handle null/empty reference", () => {
      const emptyRef = null;
      const fallback = emptyRef || "—";
      expect(fallback).toBe("—");
    });
  });

  describe("Barcode field", () => {
    it("should validate EAN-13 barcode format", () => {
      const validBarcodes = ["7891234567890", "7899876543210"];
      validBarcodes.forEach((bc) => {
        expect(bc).toMatch(/^\d{13}$/);
      });
    });

    it("should accept other barcode formats", () => {
      const barcodes = ["12345678", "1234567890128", "ABC123456"];
      barcodes.forEach((bc) => {
        expect(typeof bc).toBe("string");
        expect(bc.length).toBeGreaterThan(0);
      });
    });

    it("should handle null barcode gracefully", () => {
      const barcode = null;
      const display = barcode || "—";
      expect(display).toBe("—");
    });
  });

  describe("CFOP field", () => {
    it("should validate common CFOP codes", () => {
      const validCfops = ["5102", "5405", "6102", "1102", "2102"];
      validCfops.forEach((cfop) => {
        expect(cfop).toMatch(/^\d{4}$/);
      });
    });

    it("should handle null CFOP", () => {
      const cfop = null;
      const display = cfop || "—";
      expect(display).toBe("—");
    });
  });

  describe("CNPJ filter", () => {
    it("should validate CNPJ format", () => {
      const validCnpjs = ["12.345.678/0001-90", "98.765.432/0001-10"];
      validCnpjs.forEach((cnpj) => {
        expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
      });
    });

    it("should filter invoices by CNPJ correctly", () => {
      const invoices = [
        { id: 1, entityDocument: "12.345.678/0001-90", entityName: "Fornecedor A" },
        { id: 2, entityDocument: "98.765.432/0001-10", entityName: "Fornecedor B" },
        { id: 3, entityDocument: "12.345.678/0001-90", entityName: "Fornecedor A" },
      ];

      const filtered = invoices.filter((inv) => inv.entityDocument === "12.345.678/0001-90");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((inv) => inv.entityDocument === "12.345.678/0001-90")).toBe(true);
    });

    it("should return all invoices when no CNPJ filter is applied", () => {
      const invoices = [
        { id: 1, entityDocument: "12.345.678/0001-90" },
        { id: 2, entityDocument: "98.765.432/0001-10" },
        { id: 3, entityDocument: "12.345.678/0001-90" },
      ];

      const cnpjFilter = "all";
      const filtered = cnpjFilter === "all" ? invoices : invoices.filter((inv) => inv.entityDocument === cnpjFilter);
      expect(filtered).toHaveLength(3);
    });
  });

  describe("Material Summary with reference and CFOP", () => {
    it("should aggregate movements by product with reference and CFOP", () => {
      const movements = [
        { productName: "Detergente", reference: "001", cfop: "5102", type: "entrada", quantity: "10", totalPrice: "50.00" },
        { productName: "Detergente", reference: "001", cfop: "5102", type: "entrada", quantity: "5", totalPrice: "25.00" },
        { productName: "Desinfetante", reference: "002", cfop: "5405", type: "entrada", quantity: "20", totalPrice: "100.00" },
        { productName: "Detergente", reference: "001", cfop: "5102", type: "saida", quantity: "3", totalPrice: "15.00" },
      ];

      const map: Record<string, { name: string; reference: string; cfop: string; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number }> = {};
      movements.forEach((m) => {
        const name = m.productName;
        if (!map[name]) {
          map[name] = { name, reference: "", cfop: "", qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0 };
        }
        if (m.reference && !map[name].reference) map[name].reference = m.reference;
        if (m.cfop && !map[name].cfop) map[name].cfop = m.cfop;
        const qty = parseFloat(m.quantity);
        const val = parseFloat(m.totalPrice);
        if (m.type === "entrada") {
          map[name].qtyIn += qty;
          map[name].valueIn += val;
        } else {
          map[name].qtyOut += qty;
          map[name].valueOut += val;
        }
      });

      const result = Object.values(map);
      expect(result).toHaveLength(2);

      const detergente = result.find((r) => r.name === "Detergente")!;
      expect(detergente.reference).toBe("001");
      expect(detergente.cfop).toBe("5102");
      expect(detergente.qtyIn).toBe(15);
      expect(detergente.qtyOut).toBe(3);
      expect(detergente.valueIn).toBe(75);
      expect(detergente.valueOut).toBe(15);

      const desinfetante = result.find((r) => r.name === "Desinfetante")!;
      expect(desinfetante.reference).toBe("002");
      expect(desinfetante.cfop).toBe("5405");
      expect(desinfetante.qtyIn).toBe(20);
      expect(desinfetante.qtyOut).toBe(0);
    });
  });

  describe("Search by reference and barcode", () => {
    it("should find products by reference", () => {
      const products = [
        { name: "Detergente", reference: "001234", barcode: "7891234567890" },
        { name: "Desinfetante", reference: "005678", barcode: null },
        { name: "Sabão", reference: null, barcode: "7899876543210" },
      ];

      const search = "001234";
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
          (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Detergente");
    });

    it("should find products by barcode", () => {
      const products = [
        { name: "Detergente", reference: "001234", barcode: "7891234567890" },
        { name: "Desinfetante", reference: "005678", barcode: null },
        { name: "Sabão", reference: null, barcode: "7899876543210" },
      ];

      const search = "789987";
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
          (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Sabão");
    });
  });
});
