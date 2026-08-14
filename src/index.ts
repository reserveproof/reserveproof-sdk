import { Keypair } from "@stellar/stellar-sdk";
import {
  Client as ContractClient,
  basicNodeSigner,
} from "@stellar/stellar-sdk/contract";

export interface WalletSigner {
  publicKey: string;
  signTransaction: (
    tx: string,
    opts?: {
      network?: string;
      networkPassphrase?: string;
      accountToSign?: string;
    },
  ) => Promise<string>;
}

export type Signer = Keypair | WalletSigner;

function isKeypair(signer: Signer): signer is Keypair {
  return (
    typeof (signer as Keypair).sign === "function" &&
    typeof (signer as Keypair).publicKey === "function"
  );
}

function toWalletSigner(
  signer: Signer,
  networkPassphrase: string,
): WalletSigner {
  if (!isKeypair(signer)) return signer;
  const { signTransaction } = basicNodeSigner(signer, networkPassphrase);
  return { publicKey: signer.publicKey(), signTransaction };
}

export interface ReserveProofConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  /** Required for any write operation (registerIssuer, submitAttestation, coSignAttestation, flagStale, ...). */
  signer?: Signer;
  /**
   * Source account to simulate read-only calls from. Defaults to the signer's
   * public key. Required if no signer is provided and you want to make read calls.
   */
  publicKey?: string;
}

export interface AttestationInput {
  reserveBalance: bigint;
  outstandingSupply: bigint;
  supportingDocHash: string; // hex-encoded, with or without "0x" prefix, 32 bytes
}

export interface Attestation {
  id: string;
  issuer: string;
  reserveBalance: bigint;
  outstandingSupply: bigint;
  supportingDocHash: string;
  signers: string[];
  state: "Pending" | "Finalized";
  submittedAt: number;
  finalizedAt?: number;
}

export interface IssuerInput {
  issuer: string;
  name: string;
  asset: string;
  attestationWindowSeconds: number;
  requiredAttestors: string[];
  minSigners: number;
}

export interface IssuerEntry {
  address: string;
  name: string;
  asset: string;
  attestationWindowSeconds: number;
  requiredAttestors: string[];
  minSigners: number;
  status: "Active" | "Suspended";
}

export interface BankBalanceAdapter {
  fetchBalance(issuerId: string): Promise<{ balance: bigint; asOf: Date }>;
}

export interface TxResult {
  transactionHash: string;
  ledgerCloseTime: number;
}

function hexToBuffer(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

function bufferToHex(buf: Buffer | Uint8Array): string {
  return "0x" + Buffer.from(buf).toString("hex");
}

/**
 * Soroban unit enums (no associated data, e.g. IssuerStatus, AttestationState)
 * come back from the RPC client as either a bare string tag or `{ tag, values }`
 * depending on SDK version -- normalize to the string tag either way.
 */
function unwrapEnumTag<T extends string>(value: unknown): T {
  if (typeof value === "string") return value as T;
  if (
    value &&
    typeof value === "object" &&
    "tag" in (value as Record<string, unknown>)
  ) {
    return (value as { tag: T }).tag;
  }
  throw new Error(`Unexpected enum shape: ${JSON.stringify(value)}`);
}

function mapIssuerEntry(raw: any): IssuerEntry {
  return {
    address: raw.address,
    name: raw.name,
    asset: raw.asset,
    attestationWindowSeconds: Number(raw.attestation_window_seconds),
    requiredAttestors: raw.required_attestors,
    minSigners: Number(raw.min_signers),
    status: unwrapEnumTag(raw.status),
  };
}

function mapAttestation(raw: any): Attestation {
  return {
    id: bufferToHex(raw.id),
    issuer: raw.issuer,
    reserveBalance: BigInt(raw.reserve_balance),
    outstandingSupply: BigInt(raw.outstanding_supply),
    supportingDocHash: bufferToHex(raw.supporting_doc_hash),
    signers: raw.signers,
    state: unwrapEnumTag(raw.state),
    submittedAt: Number(raw.submitted_at),
    finalizedAt:
      raw.finalized_at != null ? Number(raw.finalized_at) : undefined,
  };
}

function txResultFromSent(sent: any): TxResult {
  const hash =
    sent?.sendTransactionResponse?.hash ??
    sent?.getTransactionResponse?.txHash ??
    "";
  const createdAt = sent?.getTransactionResponse?.createdAt;
  return {
    transactionHash: hash,
    ledgerCloseTime:
      createdAt != null ? Number(createdAt) : Math.floor(Date.now() / 1000),
  };
}

export class ReserveProofClient {
  private contractId: string;
  private rpcUrl: string;
  private networkPassphrase: string;
  private walletSigner?: WalletSigner;
  private readPublicKey?: string;
  private clientPromise?: Promise<ContractClient>;

  constructor(config: ReserveProofConfig) {
    this.contractId = config.contractId;
    this.rpcUrl = config.rpcUrl;
    this.networkPassphrase = config.networkPassphrase;
    this.walletSigner = config.signer
      ? toWalletSigner(config.signer, config.networkPassphrase)
      : undefined;
    this.readPublicKey = config.publicKey ?? this.walletSigner?.publicKey;
  }

  private async client(): Promise<ContractClient> {
    if (!this.clientPromise) {
      this.clientPromise = ContractClient.from({
        contractId: this.contractId,
        rpcUrl: this.rpcUrl,
        networkPassphrase: this.networkPassphrase,
        publicKey: this.readPublicKey,
        signTransaction: this.walletSigner?.signTransaction,
      });
    }
    return this.clientPromise;
  }

  private requireSigner(): WalletSigner {
    if (!this.walletSigner) {
      throw new Error(
        "This operation requires a signer (none was provided to ReserveProofClient)",
      );
    }
    return this.walletSigner;
  }

  async registerIssuer(input: IssuerInput): Promise<TxResult> {
    const signer = this.requireSigner();
    const client = await this.client();
    const tx = await (client as any).register_issuer(
      {
        caller: signer.publicKey,
        issuer: input.issuer,
        name: input.name,
        asset: input.asset,
        attestation_window_seconds: BigInt(input.attestationWindowSeconds),
        required_attestors: input.requiredAttestors,
        min_signers: input.minSigners,
      },
      { publicKey: signer.publicKey },
    );
    const sent = await tx.signAndSend({
      signTransaction: signer.signTransaction,
    });
    return txResultFromSent(sent);
  }

  async updateIssuerStatus(
    issuer: string,
    status: "Active" | "Suspended",
  ): Promise<TxResult> {
    const signer = this.requireSigner();
    const client = await this.client();
    const tx = await (client as any).update_issuer_status(
      {
        caller: signer.publicKey,
        issuer,
        status: { tag: status, values: undefined },
      },
      { publicKey: signer.publicKey },
    );
    const sent = await tx.signAndSend({
      signTransaction: signer.signTransaction,
    });
    return txResultFromSent(sent);
  }

  async updateAttestors(
    issuer: string,
    requiredAttestors: string[],
    minSigners: number,
  ): Promise<TxResult> {
    const signer = this.requireSigner();
    const client = await this.client();
    const tx = await (client as any).update_attestors(
      {
        caller: signer.publicKey,
        issuer,
        required_attestors: requiredAttestors,
        min_signers: minSigners,
      },
      { publicKey: signer.publicKey },
    );
    const sent = await tx.signAndSend({
      signTransaction: signer.signTransaction,
    });
    return txResultFromSent(sent);
  }

  async getIssuer(issuer: string): Promise<IssuerEntry | null> {
    const client = await this.client();
    const tx = await (client as any).get_issuer(
      { issuer },
      { publicKey: this.readPublicKey },
    );
    const raw = tx.result;
    return raw ? mapIssuerEntry(raw) : null;
  }

  async submitAttestation(
    issuer: string,
    attestation: AttestationInput,
  ): Promise<{ attestationId: string; txResult: TxResult }> {
    const signer = this.requireSigner();
    const client = await this.client();
    const tx = await (client as any).submit_attestation(
      {
        caller: signer.publicKey,
        issuer,
        reserve_balance: attestation.reserveBalance,
        outstanding_supply: attestation.outstandingSupply,
        supporting_doc_hash: hexToBuffer(attestation.supportingDocHash),
      },
      { publicKey: signer.publicKey },
    );
    const sent = await tx.signAndSend({
      signTransaction: signer.signTransaction,
    });
    return {
      attestationId: bufferToHex(sent.result),
      txResult: txResultFromSent(sent),
    };
  }

  async coSignAttestation(attestationId: string): Promise<TxResult> {
    const signer = this.requireSigner();
    const client = await this.client();
    const tx = await (client as any).co_sign_attestation(
      { caller: signer.publicKey, attestation_id: hexToBuffer(attestationId) },
      { publicKey: signer.publicKey },
    );
    const sent = await tx.signAndSend({
      signTransaction: signer.signTransaction,
    });
    return txResultFromSent(sent);
  }

  async getAttestation(attestationId: string): Promise<Attestation | null> {
    const client = await this.client();
    const tx = await (client as any).get_attestation(
      { attestation_id: hexToBuffer(attestationId) },
      { publicKey: this.readPublicKey },
    );
    const raw = tx.result;
    return raw ? mapAttestation(raw) : null;
  }

  async getLatestAttestation(issuer: string): Promise<Attestation | null> {
    const client = await this.client();
    const tx = await (client as any).get_latest_attestation(
      { issuer },
      { publicKey: this.readPublicKey },
    );
    const raw = tx.result;
    return raw ? mapAttestation(raw) : null;
  }

  async getReserveRatio(issuer: string): Promise<number | null> {
    const client = await this.client();
    const tx = await (client as any).get_reserve_ratio(
      { issuer },
      { publicKey: this.readPublicKey },
    );
    const raw = tx.result;
    return raw != null ? Number(raw) : null;
  }

  async isStale(issuer: string): Promise<boolean> {
    const client = await this.client();
    const tx = await (client as any).is_stale(
      { issuer },
      { publicKey: this.readPublicKey },
    );
    return Boolean(tx.result);
  }

  async flagStale(issuer: string): Promise<TxResult> {
    // Permissionless: still needs *a* signer to submit the transaction, but that
    // signer does not need to be authorized by the contract in any special way.
    const signer = this.requireSigner();
    const client = await this.client();
    const tx = await (client as any).flag_stale(
      { issuer },
      { publicKey: signer.publicKey },
    );
    const sent = await tx.signAndSend({
      signTransaction: signer.signTransaction,
    });
    return txResultFromSent(sent);
  }
}

export class MockBankAdapter implements BankBalanceAdapter {
  constructor(private balance: bigint = BigInt(1_000_000_00)) {}

  async fetchBalance(
    issuerId: string,
  ): Promise<{ balance: bigint; asOf: Date }> {
    return {
      balance: this.balance,
      asOf: new Date(),
    };
  }

  setBalance(balance: bigint): void {
    this.balance = balance;
  }
}
