export interface Signer {
  signTransaction(tx: any): Promise<any>;
}

export interface ReserveProofConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  signer: Signer;
}

export interface AttestationInput {
  reserveBalance: bigint;
  outstandingSupply: bigint;
  supportingDocHash: string;
}

export interface Attestation {
  id: string;
  issuer: string;
  reserveBalance: bigint;
  outstandingSupply: bigint;
  supportingDocHash: string;
  signers: string[];
  state: 'Pending' | 'Finalized';
  submittedAt: number;
  finalizedAt?: number;
}

export interface IssuerEntry {
  address: string;
  name: string;
  asset: string;
  attestationWindowSeconds: number;
  requiredAttestors: string[];
  minSigners: number;
  status: 'Active' | 'Suspended';
}

export interface BankBalanceAdapter {
  fetchBalance(issuerId: string): Promise<{ balance: bigint; asOf: Date }>;
}

export class ReserveProofClient {
  constructor(config: ReserveProofConfig) {
    // Implementation in Phase 3
  }

  async registerIssuer(issuer: IssuerEntry): Promise<any> {
    throw new Error('Not implemented');
  }

  async submitAttestation(issuer: string, attestation: AttestationInput): Promise<{ attestationId: string; txResult: any }> {
    throw new Error('Not implemented');
  }

  async coSignAttestation(attestationId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async getLatestAttestation(issuer: string): Promise<Attestation | null> {
    throw new Error('Not implemented');
  }

  async getReserveRatio(issuer: string): Promise<number | null> {
    throw new Error('Not implemented');
  }

  async isStale(issuer: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async flagStale(issuer: string): Promise<any> {
    throw new Error('Not implemented');
  }
}

export class MockBankAdapter implements BankBalanceAdapter {
  constructor(private balance: bigint = BigInt(1_000_000_00)) {}

  async fetchBalance(issuerId: string): Promise<{ balance: bigint; asOf: Date }> {
    return {
      balance: this.balance,
      asOf: new Date(),
    };
  }
}
