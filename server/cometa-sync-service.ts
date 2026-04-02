import crypto from "crypto";

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

class CometaSyncService {
  private syncLogs: SyncResult[] = [];
  private notifications: CometaNotification[] = [];
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

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
    console.log("Iniciando sincronização completa...");
    const results: SyncResult[] = [];

    try {
      results.push(await this.syncVendas());
      results.push(await this.syncPedidos());
      results.push(await this.syncEstoque());
      results.push(await this.syncDevolucoes());

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
      // Simular chamada à API Cometa
      const mockVendas = [
        {
          id: `VENDA-${Date.now()}-1`,
          loja: "Centro",
          data: new Date(),
          total: 1250.50,
          itens: 5,
        },
        {
          id: `VENDA-${Date.now()}-2`,
          loja: "Norte",
          data: new Date(),
          total: 890.75,
          itens: 3,
        },
      ];

      for (const venda of mockVendas) {
        result.newRecords++;

        // Criar notificação
        this.addNotification({
          id: crypto.randomUUID(),
          type: "nova_venda",
          title: "Nova Venda Sincronizada",
          message: `Venda de R$ ${venda.total.toFixed(2)} na loja ${venda.loja}`,
          data: venda,
          timestamp: new Date(),
          read: false,
        });

        result.recordsProcessed++;
      }

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
      // Simular chamada à API Cometa
      const mockPedidos = [
        {
          id: `PEDIDO-${Date.now()}-1`,
          loja: "Centro",
          data: new Date(),
          total: 2100.00,
          itens: 8,
          status: "pendente",
        },
        {
          id: `PEDIDO-${Date.now()}-2`,
          loja: "Sul",
          data: new Date(),
          total: 450.75,
          itens: 2,
          status: "confirmado",
        },
      ];

      for (const pedido of mockPedidos) {
        result.newRecords++;

        // Criar notificação
        this.addNotification({
          id: crypto.randomUUID(),
          type: "novo_pedido",
          title: "🎉 Novo Pedido Recebido",
          message: `Pedido ${pedido.id} de R$ ${pedido.total.toFixed(2)} - ${pedido.itens} itens`,
          data: pedido,
          timestamp: new Date(),
          read: false,
        });

        result.recordsProcessed++;
      }

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
      // Simular chamada à API Cometa
      const mockEstoque = [
        {
          id: `ESTOQUE-${Date.now()}-1`,
          produto: "Detergente Neutro 500ml",
          loja: "Centro",
          quantidade: 245,
          minimo: 50,
        },
        {
          id: `ESTOQUE-${Date.now()}-2`,
          produto: "Desinfetante 1L",
          loja: "Norte",
          quantidade: 12,
          minimo: 100,
        },
      ];

      for (const estoque of mockEstoque) {
        result.newRecords++;

        // Alertar se estoque está baixo
        if (estoque.quantidade < estoque.minimo) {
          this.addNotification({
            id: crypto.randomUUID(),
            type: "estoque_atualizado",
            title: "⚠️ Estoque Baixo",
            message: `${estoque.produto} na ${estoque.loja}: ${estoque.quantidade} un (mín: ${estoque.minimo})`,
            data: estoque,
            timestamp: new Date(),
            read: false,
          });
        }

        result.recordsProcessed++;
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Erro desconhecido";
    }

    return result;
  }

  /**
   * Sincroniza devoluções do Cometa
   */
  private async syncDevolucoes(): Promise<SyncResult> {
    const result: SyncResult = {
      type: "devolucoes",
      success: false,
      recordsProcessed: 0,
      newRecords: 0,
      timestamp: new Date(),
    };

    try {
      // Simular chamada à API Cometa
      const mockDevolucoes = [
        {
          id: `DEVOLUCAO-${Date.now()}-1`,
          produto: "Detergente Neutro",
          loja: "Centro",
          quantidade: 5,
          motivo: "Produto Danificado",
          data: new Date(),
        },
      ];

      for (const devolucao of mockDevolucoes) {
        result.newRecords++;

        // Criar notificação
        this.addNotification({
          id: crypto.randomUUID(),
          type: "devolucao",
          title: "📦 Devolução Registrada",
          message: `${devolucao.quantidade} un de ${devolucao.produto} - Motivo: ${devolucao.motivo}`,
          data: devolucao,
          timestamp: new Date(),
          read: false,
        });

        result.recordsProcessed++;
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Erro desconhecido";
    }

    return result;
  }

  /**
   * Webhook para receber dados do Cometa em tempo real
   */
  async handleWebhook(payload: any) {
    console.log("Webhook recebido do Cometa:", payload);

    const { type, data } = payload;

    switch (type) {
      case "novo_pedido":
        await this.processPedidoWebhook(data);
        break;
      case "nova_venda":
        await this.processVendaWebhook(data);
        break;
      case "estoque_atualizado":
        await this.processEstoqueWebhook(data);
        break;
      case "devolucao":
        await this.processDevolucaoWebhook(data);
        break;
      default:
        console.log("Tipo de webhook desconhecido:", type);
    }
  }

  private async processPedidoWebhook(data: any) {
    console.log("Processando pedido via webhook:", data);
    this.addNotification({
      id: crypto.randomUUID(),
      type: "novo_pedido",
      title: "🎉 Novo Pedido via Webhook",
      message: `Pedido ${data.id} recebido em tempo real!`,
      data,
      timestamp: new Date(),
      read: false,
    });
  }

  private async processVendaWebhook(data: any) {
    console.log("Processando venda via webhook:", data);
    this.addNotification({
      id: crypto.randomUUID(),
      type: "nova_venda",
      title: "💰 Nova Venda via Webhook",
      message: `Venda de R$ ${data.total} registrada!`,
      data,
      timestamp: new Date(),
      read: false,
    });
  }

  private async processEstoqueWebhook(data: any) {
    console.log("Processando estoque via webhook:", data);
    if (data.quantidade < data.minimo) {
      this.addNotification({
        id: crypto.randomUUID(),
        type: "estoque_atualizado",
        title: "⚠️ Alerta de Estoque Baixo",
        message: `${data.produto}: ${data.quantidade} un (mín: ${data.minimo})`,
        data,
        timestamp: new Date(),
        read: false,
      });
    }
  }

  private async processDevolucaoWebhook(data: any) {
    console.log("Processando devolução via webhook:", data);
    this.addNotification({
      id: crypto.randomUUID(),
      type: "devolucao",
      title: "📦 Devolução via Webhook",
      message: `${data.quantidade} un de ${data.produto} devolvidas`,
      data,
      timestamp: new Date(),
      read: false,
    });
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
    };
  }
}

// Exportar instância única
export const cometaSyncService = new CometaSyncService();
