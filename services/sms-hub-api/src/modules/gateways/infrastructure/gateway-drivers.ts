import { GatewayStatus, GatewayType } from '../domain/gateway.enums';

export interface GatewayDriver {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  checkAvailability(): Promise<boolean>;
  sendMessage(input: { phone: string; message: string }): Promise<{
    status: string;
    externalId?: string;
    error?: string;
  }>;
}

export class FakeGatewayDriver implements GatewayDriver {
  constructor(private readonly gatewayName: string) {}

  async testConnection() {
    return { ok: true, message: `${this.gatewayName} simulado disponível.` };
  }

  async checkAvailability() {
    return true;
  }

  async sendMessage(input: { phone: string; message: string }) {
    if (!input.phone || !input.message) {
      return { status: 'FAILED', error: 'Telefone e mensagem são obrigatórios.' };
    }
    return {
      status: 'SENT',
      externalId: `fake-${Date.now()}`,
    };
  }
}

export function createGatewayDriver(type: GatewayType, name: string): GatewayDriver {
  switch (type) {
    case GatewayType.FAKE:
      return new FakeGatewayDriver(name);
    default:
      throw new Error(`Driver ${type} ainda não implementado.`);
  }
}
