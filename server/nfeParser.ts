import { XMLParser } from "fast-xml-parser";

export interface NFeItem {
  name: string;
  reference: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  ncm?: string | null;
  cfop?: string | null;
}

export interface NFeData {
  invoiceNumber: string | null;
  entityName: string | null;
  entityDocument: string | null;
  issueDate: string | null;
  totalValue: number | null;
  items: NFeItem[];
  series?: string | null;
  accessKey?: string | null;
  nature?: string | null;
}

/**
 * Parse NF-e XML and extract structured invoice data.
 * Supports both full NF-e XML (with <nfeProc>) and simplified formats.
 */
export function parseNFeXml(xmlContent: string): NFeData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) => {
      // Ensure 'det' (items) is always an array even with single item
      return name === "det";
    },
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);

  // Navigate to the NFe node — handles both <nfeProc><NFe> and standalone <NFe>
  const nfeProc = parsed.nfeProc || parsed.NFe || parsed;
  const nfe = nfeProc.NFe || nfeProc;
  const infNFe = nfe.infNFe || nfe.infNfe || {};

  // ─── Identification ──────────────────────────────
  const ide = infNFe.ide || {};
  const invoiceNumber = ide.nNF ? String(ide.nNF) : null;
  const series = ide.serie ? String(ide.serie) : null;
  const nature = ide.natOp ? String(ide.natOp) : null;

  // Parse issue date
  let issueDate: string | null = null;
  if (ide.dhEmi) {
    // Format: 2024-01-15T10:30:00-03:00
    const dateStr = String(ide.dhEmi);
    issueDate = dateStr.substring(0, 10); // YYYY-MM-DD
  } else if (ide.dEmi) {
    issueDate = String(ide.dEmi);
  }

  // Access key from infNFe attributes or protNFe
  let accessKey: string | null = null;
  if (infNFe["@_Id"]) {
    accessKey = String(infNFe["@_Id"]).replace(/^NFe/, "");
  }
  const protNFe = nfeProc.protNFe || nfe.protNFe;
  if (!accessKey && protNFe?.infProt?.chNFe) {
    accessKey = String(protNFe.infProt.chNFe);
  }

  // ─── Entity (Emitter or Recipient) ───────────────
  // For entrada (purchase): entity is the emitter (emit)
  // For saída (sale): entity is the recipient (dest)
  // We extract both and let the caller decide
  const emit = infNFe.emit || {};
  const dest = infNFe.dest || {};

  // Default to emitter (most common for purchase invoices)
  const entityName = emit.xNome ? String(emit.xNome) :
                     emit.xFant ? String(emit.xFant) : null;
  const entityDocument = emit.CNPJ ? String(emit.CNPJ) :
                         emit.CPF ? String(emit.CPF) : null;

  // ─── Totals ──────────────────────────────────────
  const total = infNFe.total || {};
  const icmsTot = total.ICMSTot || {};
  const totalValue = icmsTot.vNF != null ? Number(icmsTot.vNF) :
                     icmsTot.vProd != null ? Number(icmsTot.vProd) : null;

  // ─── Items ───────────────────────────────────────
  const detArray = infNFe.det || [];
  const items: NFeItem[] = [];

  for (const det of detArray) {
    const prod = det.prod || {};

    items.push({
      name: prod.xProd ? String(prod.xProd) : "Produto sem nome",
      reference: prod.cProd ? String(prod.cProd) : null,
      quantity: prod.qCom != null ? Number(prod.qCom) :
                prod.qTrib != null ? Number(prod.qTrib) : null,
      unit: prod.uCom ? String(prod.uCom) :
            prod.uTrib ? String(prod.uTrib) : null,
      unitPrice: prod.vUnCom != null ? Number(prod.vUnCom) :
                 prod.vUnTrib != null ? Number(prod.vUnTrib) : null,
      totalPrice: prod.vProd != null ? Number(prod.vProd) : null,
      ncm: prod.NCM ? String(prod.NCM) : null,
      cfop: prod.CFOP ? String(prod.CFOP) : null,
    });
  }

  return {
    invoiceNumber,
    entityName,
    entityDocument,
    issueDate,
    totalValue,
    items,
    series,
    accessKey,
    nature,
  };
}

/**
 * Determine if the entity in the XML is the supplier or client
 * based on the invoice type (entrada/saida).
 * For entrada: the emitter (emit) is the supplier
 * For saida: the recipient (dest) is the client
 */
export function getEntityFromNFe(xmlContent: string, type: "entrada" | "saida"): {
  name: string | null;
  document: string | null;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);
  const nfeProc = parsed.nfeProc || parsed.NFe || parsed;
  const nfe = nfeProc.NFe || nfeProc;
  const infNFe = nfe.infNFe || nfe.infNfe || {};

  if (type === "entrada") {
    // For purchases, the entity is the emitter (supplier)
    const emit = infNFe.emit || {};
    return {
      name: emit.xNome ? String(emit.xNome) : emit.xFant ? String(emit.xFant) : null,
      document: emit.CNPJ ? String(emit.CNPJ) : emit.CPF ? String(emit.CPF) : null,
    };
  } else {
    // For sales, the entity is the recipient (client)
    const dest = infNFe.dest || {};
    return {
      name: dest.xNome ? String(dest.xNome) : dest.xFant ? String(dest.xFant) : null,
      document: dest.CNPJ ? String(dest.CNPJ) : dest.CPF ? String(dest.CPF) : null,
    };
  }
}
