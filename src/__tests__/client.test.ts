import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { ReserveProofClient, MockBankAdapter } from "../index";

describe("ReserveProofClient", () => {
  const contractId =
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7";
  const rpcUrl = "https://soroban-testnet.stellar.org";
  const networkPassphrase = "Test SDF Network ; September 2015";

  it("constructs with a Keypair signer", () => {
    const signer = Keypair.random();
    const client = new ReserveProofClient({
      contractId,
      rpcUrl,
      networkPassphrase,
      signer,
    });
    expect(client).toBeInstanceOf(ReserveProofClient);
  });

  it("constructs without a signer for read-only usage", () => {
    const client = new ReserveProofClient({
      contractId,
      rpcUrl,
      networkPassphrase,
      publicKey: Keypair.random().publicKey(),
    });
    expect(client).toBeInstanceOf(ReserveProofClient);
  });

  it("throws when a write operation is attempted without a signer", async () => {
    const client = new ReserveProofClient({
      contractId,
      rpcUrl,
      networkPassphrase,
    });

    await expect(
      client.registerIssuer({
        issuer: Keypair.random().publicKey(),
        name: "Test Issuer",
        asset: Keypair.random().publicKey(),
        attestationWindowSeconds: 86400,
        requiredAttestors: [Keypair.random().publicKey()],
        minSigners: 1,
      }),
    ).rejects.toThrow(/requires a signer/);
  });

  it("throws when submitAttestation is attempted without a signer", async () => {
    const client = new ReserveProofClient({
      contractId,
      rpcUrl,
      networkPassphrase,
    });

    await expect(
      client.submitAttestation(Keypair.random().publicKey(), {
        reserveBalance: BigInt(1_000_000),
        outstandingSupply: BigInt(1_000_000),
        supportingDocHash: "0x" + "00".repeat(32),
      }),
    ).rejects.toThrow(/requires a signer/);
  });

  it("throws when flagStale is attempted without a signer", async () => {
    const client = new ReserveProofClient({
      contractId,
      rpcUrl,
      networkPassphrase,
    });

    await expect(
      client.flagStale(Keypair.random().publicKey()),
    ).rejects.toThrow(/requires a signer/);
  });
});

describe("MockBankAdapter", () => {
  it("uses default balance when none provided", async () => {
    const adapter = new MockBankAdapter();
    const result = await adapter.fetchBalance("issuer-1");
    expect(result.balance).toBe(BigInt(1_000_000_00));
    expect(result.asOf).toBeInstanceOf(Date);
  });

  it("uses custom initial balance", async () => {
    const adapter = new MockBankAdapter(BigInt(500_000));
    const result = await adapter.fetchBalance("issuer-1");
    expect(result.balance).toBe(BigInt(500_000));
  });

  it("allows updating balance via setBalance", async () => {
    const adapter = new MockBankAdapter(BigInt(100));
    adapter.setBalance(BigInt(999));
    const result = await adapter.fetchBalance("issuer-1");
    expect(result.balance).toBe(BigInt(999));
  });
});
