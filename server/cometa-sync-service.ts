import crypto from "crypto";

const COMETA_API_URL = "https://vendas.cometasupermercados.com.br";
const COMETA_EMAIL = "lustramil@yahoo.com.br";
const COMETA_PASSWORD = "oddRlCP4zn2o";

interface SyncResult {
  type: "vendas" | "pedidos" | "estoque" | "devolucoes";
  success: boolean;
  recordsProcessed: number;
  newRecords: number;
  timestamp: Date;
  error?: string;
}

interface CometaNotification {
  id: string;
  type: "novo_pedido" | "nova_venda" | "estoque_atualizado" | "devolucao";
  title: string;
  message: string;
  data: any;
  timestamp: Date;
  read: boolean;
}

// Tipos da API do Cometa
export interface CometaPedido {
  codigo_produto: string;
  numero_pedido: string;
  numero_fornecedor: string;
  data_emissao_pedido: string;
  descricao_produto: string;
  ean_produto: string;
  codigos_produto_fornecedor: string[];
  total_unidades: number;
  valor_bruto_unitario: number;
  qtd_embalagem: number;
  valor_total: number;
  status_pedido: string; // "P" = Pendente, "B" = Baixado/Entregue
  loja: number;
  cnpj: string;
  observacao: string;
  frete: string;
  comprador: { nome: string; codigo: string };
  forma_aquisicao: string;
  prazo_pagamento: string;
  motivo_divergencia: string | null;
}

export interface CometaEstoque {
  loja: number;
  codigo_produto: string;
  descricao_produto: string;
  ean: string;
  estq_loja: number;
  estq_avaria: number;
}

export interface CometaVendaItem {
  LOJA: number;
  DATA: string;
  EAN: string;
  COD_INTERNO: string;
  PLU: number;
  PRODUTO: string;
  DESCCOMPLETA: string;
  EMBALAGEM: string;
  QTD: number;
  VENDA: number;
  CUSTO: number;
}

export interface CometaVenda {
  LOJA: { LOJA: number; NOME: string; CNPJ: string };
  VENDAS: CometaVendaItem[];
}

export interface CometaLoja {
  loja: number;
  nome: string;
  cnpj: string;
  cep: string;
  bairro: string;
  rua: string;
}

export interface CometaProduto {
  prod_codigo: string;
  prod_descricao: string;
  prod_codbarras: string;
  prod_emb: string;
  fornecedor: { codigo: number; nome: string; cnpj: string };
  comprador: { codigo: string; nome: string };
}

class CometaSyncService {
  private syncLogs: SyncResult[] = [];
  private notifications: CometaNotification[] = [];
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // Cache para dados
  private cachedPedidos: CometaPedido[] | null = null;
  private cachedEstoque: CometaEstoque[] | null = null;
  private cachedVendas: CometaVenda[] | null = null;
  private cachedLojas: CometaLoja[] | null = null;
  private cachedProdutos: CometaProduto[] | null = null;
  private cacheTimestamp: Date | null = null;
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

  /**
   * Autentica na API do Cometa e retorna o token
   */
  async authenticate(): Promise<string> {
    // Verificar se token ainda é válido
    if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.authToken;
    }

    try {
      const response = await fetch(`${COMETA_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: COMETA_EMAIL, password: COMETA_PASSWORD }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Falha na autenticação: ${response.status}`);
      }

      const token = await response.text();
      this.authToken = token.trim();
      // Token válido por 23 horas
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      console.log("Autenticado na API do Cometa com sucesso");
      return this.authToken;
    } catch (error) {
      console.error("Erro ao autenticar na API do Cometa:", error);
      throw error;
    }
  }

  /**
   * Faz uma requisição autenticada à API do Cometa
   */
  private async fetchCometa(endpoint: string): Promise<any> {
    const token = await this.authenticate();
    const response = await fetch(`${COMETA_API_URL}${endpoint}`, {
      headers: { "Authorization": `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Erro na API Cometa ${endpoint}: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Verifica se o cache está válido
   */
  private isCacheValid(): boolean {
    if (!this.cacheTimestamp) return false;
    return (Date.now() - this.cacheTimestamp.getTime()) < this.CACHE_TTL_MS;
  }

  /**
   * Busca pedidos reais da API do Cometa
   */
  async getPedidos(): Promise<CometaPedido[]> {
    if (this.cachedPedidos && this.isCacheValid()) {
      return this.cachedPedidos;
    }
    try {
      const data = await this.fetchCometa("/pedido");
      this.cachedPedidos = Array.isArray(data) ? data : [];
      this.cacheTimestamp = new Date();
      return this.cachedPedidos;
    } catch (error) {
      console.error("Erro ao buscar pedidos do Cometa:", error);
      return this.cachedPedidos || [];
    }
  }

  /**
   * Busca estoque real da API do Cometa
   */
  async getEstoque(): Promise<CometaEstoque[]> {
    if (this.cachedEstoque && this.isCacheValid()) {
      return this.cachedEstoque;
    }
    try {
      const data = await this.fetchCometa("/estoque");
      this.cachedEstoque = Array.isArray(data) ? data : [];
      this.cacheTimestamp = new Date();
      return this.cachedEstoque;
    } catch (error) {
      console.error("Erro ao buscar estoque do Cometa:", error);
      return this.cachedEstoque || [];
    }
  }

  /**
   * Busca vendas reais da API do Cometa
   */
  async getVendas(): Promise<CometaVenda[]> {
    if (this.cachedVendas && this.isCacheValid()) {
      return this.cachedVendas;
    }
    try {
      const data = await this.fetchCometa("/venda");
      this.cachedVendas = Array.isArray(data) ? data : [];
      this.cacheTimestamp = new Date();
      return this.cachedVendas;
    } catch (error) {
      console.error("Erro ao buscar vendas do Cometa:", error);
      return this.cachedVendas || [];
    }
  }

  /**
   * Busca lojas reais da API do Cometa
   */
  async getLojas(): Promise<CometaLoja[]> {
    if (this.cachedLojas && this.isCacheValid()) {
      return this.cachedLojas;
    }
    try {
      const data = await this.fetchCometa("/loja");
      this.cachedLojas = Array.isArray(data) ? data : [];
      this.cacheTimestamp = new Date();
      return this.cachedLojas;
    } catch (error) {
      console.error("Erro ao buscar lojas do Cometa:", error);
      return this.cachedLojas || [];
    }
  }

  /**
   * Busca produtos reais da API do Cometa
   */
  async getProdutos(): Promise<CometaProduto[]> {
    if (this.cachedProdutos && this.isCacheValid()) {
      return this.cachedProdutos;
    }
    try {
      const data = await this.fetchCometa("/produto");
      this.cachedProdutos = Array.isArray(data) ? data : [];
      this.cacheTimestamp = new Date();
      return this.cachedProdutos;
    } catch (error) {
      console.error("Erro ao buscar produtos do Cometa:", error);
      return this.cachedProdutos || [];
    }
  }

  /**
   * Invalida o cache para forçar atualização
   */
  invalidateCache() {
    this.cachedPedidos = null;
    this.cachedEstoque = null;
    this.cachedVendas = null;
    this.cachedLojas = null;
    this.cachedProdutos = null;
    this.cacheTimestamp = null;
  }

  /**
   * Inicia sincronização automática com polling
   */
  startAutoSync(frequencyMinutes: number = 60) {
    if (this.isRunning) {
      console.log("Sincronização já está em execução");
      return;
    }

    this.isRunning = true;
    console.log(`Iniciando sincronização automática a cada ${frequencyMinutes} minutos`);

    // Sincronizar imediatamente
    this.syncAll();

    // Configurar polling
    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, frequencyMinutes * 60 * 1000);
  }

  /**
   * Para sincronização automática
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log("Sincronização automática parada");
    }
  }

  /**
   * Sincroniza todos os dados do Cometa
   */
  async syncAll() {
    console.log("Iniciando sincronização completa com API do Cometa...");
    const results: SyncResult[] = [];

    try {
      this.invalidateCache();
      results.push(await this.syncVendas());
      results.push(await this.syncPedidos());
      results.push(await this.syncEstoque());

      this.syncLogs.push(...results);
      console.log("Sincronização concluída com sucesso");
    } catch (error) {
      console.error("Erro durante sincronização:", error);
    }

    return results;
  }

  /**
   * Sincroniza vendas do Cometa
   */
  private async syncVendas(): Promise<SyncResult> {
    const result: SyncResult = {
      type: "vendas",
      success: false,
      recordsProcessed: 0,
      newRecords: 0,
      timestamp: new Date(),
    };

    try {
      const vendas = await this.getVendas();
      result.recordsProcessed = vendas.length;
      result.newRecords = vendas.length;
      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Erro desconhecido";
    }

    return result;
  }

  /**
   * Sincroniza pedidos do Cometa
   */
  private async syncPedidos(): Promise<SyncResult> {
    const result: SyncResult = {
      type: "pedidos",
      success: false,
      recordsProcessed: 0,
      newRecords: 0,
      timestamp: new Date(),
    };

    try {
      const pedidos = await this.getPedidos();
      result.recordsProcessed = pedidos.length;
      result.newRecords = pedidos.length;
      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Erro desconhecido";
    }

    return result;
  }

  /**
   * Sincroniza estoque do Cometa
   */
  private async syncEstoque(): Promise<SyncResult> {
    const result: SyncResult = {
      type: "estoque",
      success: false,
      recordsProcessed: 0,
      newRecords: 0,
      timestamp: new Date(),
    };

    try {
      const estoque = await this.getEstoque();
      result.recordsProcessed = estoque.length;
      result.newRecords = estoque.length;
      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Erro desconhecido";
    }

    return result;
  }

  /**
   * Sincroniza devoluções do Cometa (endpoint ainda não disponível)
   */
  private async syncDevolucoes(): Promise<SyncResult> {
    return {
      type: "devolucoes",
      success: true,
      recordsProcessed: 0,
      newRecords: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Webhook para receber dados do Cometa em tempo real
   */
  async handleWebhook(payload: any) {
    console.log("Webhook recebido do Cometa:", payload);
    const { type, data } = payload;
    switch (type) {
      case "novo_pedido":
        this.invalidateCache();
        break;
      case "nova_venda":
        this.invalidateCache();
        break;
      case "estoque_atualizado":
        this.invalidateCache();
        break;
      default:
        console.log("Tipo de webhook desconhecido:", type);
    }
  }

  /**
   * Adiciona notificação
   */
  private addNotification(notification: CometaNotification) {
    this.notifications.unshift(notification);
    console.log(`Notificação adicionada: ${notification.title}`);
  }

  /**
   * Retorna todas as notificações
   */
  getNotifications(limit: number = 50): CometaNotification[] {
    return this.notifications.slice(0, limit);
  }

  /**
   * Marca notificação como lida
   */
  markNotificationAsRead(id: string) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Retorna notificações não lidas
   */
  getUnreadNotifications(): CometaNotification[] {
    return this.notifications.filter(n => !n.read);
  }

  /**
   * Retorna logs de sincronização
   */
  getSyncLogs(limit: number = 100): SyncResult[] {
    return this.syncLogs.slice(0, limit);
  }

  /**
   * Retorna status da sincronização
   */
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.syncLogs[0]?.timestamp || null,
      totalSyncs: this.syncLogs.length,
      successfulSyncs: this.syncLogs.filter(s => s.success).length,
      failedSyncs: this.syncLogs.filter(s => !s.success).length,
      unreadNotifications: this.getUnreadNotifications().length,
      cacheValid: this.isCacheValid(),
      cacheAge: this.cacheTimestamp ? Math.round((Date.now() - this.cacheTimestamp.getTime()) / 1000) : null,
    };
  }
}

// Exportar instância única
export const cometaSyncService = new CometaSyncService();
