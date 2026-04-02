import { describe, expect, it } from "vitest";
import { parseNFeXml, getEntityFromNFe } from "./nfeParser";

// Sample NF-e XML for testing
const sampleNFeXml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35240112345678000199550010000001231234567890" versao="4.00">
      <ide>
        <nNF>123</nNF>
        <serie>1</serie>
        <natOp>Venda de mercadoria</natOp>
        <dhEmi>2024-01-15T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Distribuidora ABC Ltda</xNome>
        <xFant>ABC Limpeza</xFant>
      </emit>
      <dest>
        <CNPJ>98765432000188</CNPJ>
        <xNome>Lustra Mil Produtos de Limpeza</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <xProd>Desinfetante Lavanda 5L</xProd>
          <qCom>10.0000</qCom>
          <uCom>UN</uCom>
          <vUnCom>12.5000</vUnCom>
          <vProd>125.00</vProd>
          <NCM>34022000</NCM>
          <CFOP>5102</CFOP>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <xProd>Detergente Neutro 500ml</xProd>
          <qCom>50.0000</qCom>
          <uCom>UN</uCom>
          <vUnCom>3.5000</vUnCom>
          <vProd>175.00</vProd>
          <NCM>34022000</NCM>
          <CFOP>5102</CFOP>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>300.00</vNF>
          <vProd>300.00</vProd>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>35240112345678000199550010000001231234567890</chNFe>
    </infProt>
  </protNFe>
</nfeProc>`;

const minimalNFeXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe>
  <infNFe>
    <ide>
      <nNF>456</nNF>
      <dEmi>2024-03-20</dEmi>
    </ide>
    <emit>
      <CPF>12345678901</CPF>
      <xNome>Fornecedor Individual</xNome>
    </emit>
    <dest>
      <CNPJ>11222333000144</CNPJ>
      <xNome>Cliente Teste</xNome>
    </dest>
    <det nItem="1">
      <prod>
        <xProd>Agua Sanitaria 1L</xProd>
        <qCom>100</qCom>
        <uCom>UN</uCom>
        <vUnCom>2.50</vUnCom>
        <vProd>250.00</vProd>
      </prod>
    </det>
    <total>
      <ICMSTot>
        <vNF>250.00</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;

// ─── parseNFeXml Tests ──────────────────────────────────
describe("parseNFeXml", () => {
  it("extracts invoice number from full NF-e XML", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.invoiceNumber).toBe("123");
  });

  it("extracts series from full NF-e XML", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.series).toBe("1");
  });

  it("extracts issue date in YYYY-MM-DD format", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.issueDate).toBe("2024-01-15");
  });

  it("extracts emitter name as entity", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.entityName).toBe("Distribuidora ABC Ltda");
  });

  it("extracts emitter CNPJ as entity document", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.entityDocument).toBe("12345678000199");
  });

  it("extracts total value", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.totalValue).toBe(300);
  });

  it("extracts all items", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.items).toHaveLength(2);
  });

  it("extracts first item details correctly", () => {
    const result = parseNFeXml(sampleNFeXml);
    const item = result.items[0];
    expect(item.name).toBe("Desinfetante Lavanda 5L");
    expect(item.quantity).toBe(10);
    expect(item.unit).toBe("UN");
    expect(item.unitPrice).toBe(12.5);
    expect(item.totalPrice).toBe(125);
    expect(item.ncm).toBe("34022000");
    expect(item.cfop).toBe("5102");
  });

  it("extracts second item details correctly", () => {
    const result = parseNFeXml(sampleNFeXml);
    const item = result.items[1];
    expect(item.name).toBe("Detergente Neutro 500ml");
    expect(item.quantity).toBe(50);
    expect(item.unitPrice).toBe(3.5);
    expect(item.totalPrice).toBe(175);
  });

  it("extracts access key from protNFe", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.accessKey).toBe("35240112345678000199550010000001231234567890");
  });

  it("extracts nature of operation", () => {
    const result = parseNFeXml(sampleNFeXml);
    expect(result.nature).toBe("Venda de mercadoria");
  });

  // Minimal XML tests
  it("handles minimal NF-e XML without nfeProc wrapper", () => {
    const result = parseNFeXml(minimalNFeXml);
    expect(result.invoiceNumber).toBe("456");
  });

  it("handles dEmi date format (without time)", () => {
    const result = parseNFeXml(minimalNFeXml);
    expect(result.issueDate).toBe("2024-03-20");
  });

  it("handles CPF as entity document", () => {
    const result = parseNFeXml(minimalNFeXml);
    expect(result.entityDocument).toBe("12345678901");
  });

  it("handles single item (not array)", () => {
    const result = parseNFeXml(minimalNFeXml);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Agua Sanitaria 1L");
  });

  it("returns null for missing optional fields", () => {
    const result = parseNFeXml(minimalNFeXml);
    expect(result.series).toBeNull();
    expect(result.nature).toBeNull();
  });

  // Edge cases
  it("handles empty XML gracefully", () => {
    const result = parseNFeXml("<root></root>");
    expect(result.invoiceNumber).toBeNull();
    expect(result.items).toHaveLength(0);
    expect(result.totalValue).toBeNull();
  });
});

// ─── getEntityFromNFe Tests ─────────────────────────────
describe("getEntityFromNFe", () => {
  it("returns emitter for entrada (purchase)", () => {
    const entity = getEntityFromNFe(sampleNFeXml, "entrada");
    expect(entity.name).toBe("Distribuidora ABC Ltda");
    expect(entity.document).toBe("12345678000199");
  });

  it("returns recipient for saida (sale)", () => {
    const entity = getEntityFromNFe(sampleNFeXml, "saida");
    expect(entity.name).toBe("Lustra Mil Produtos de Limpeza");
    expect(entity.document).toBe("98765432000188");
  });

  it("handles minimal XML for entrada", () => {
    const entity = getEntityFromNFe(minimalNFeXml, "entrada");
    expect(entity.name).toBe("Fornecedor Individual");
    expect(entity.document).toBe("12345678901");
  });

  it("handles minimal XML for saida", () => {
    const entity = getEntityFromNFe(minimalNFeXml, "saida");
    expect(entity.name).toBe("Cliente Teste");
    expect(entity.document).toBe("11222333000144");
  });
});

// ─── Security: isAllowedFileType with XML ───────────────
describe("security: XML file type support", () => {
  it("accepts application/xml", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("application/xml")).toBe(true);
  });

  it("accepts text/xml", async () => {
    const { isAllowedFileType } = await import("./security");
    expect(isAllowedFileType("text/xml")).toBe(true);
  });
});
