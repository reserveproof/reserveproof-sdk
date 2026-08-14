#!/usr/bin/env node

/**
 * Example: Multi-Attestor Co-Signing Cycle
 *
 * This example demonstrates the full multi-attestor flow where multiple signers
 * must co-sign an attestation before it's finalized.
 *
 * Scenario: 2-of-3 multi-sig attestation
 * - Bank/Custodian: Submits attestation (creates pending)
 * - Auditor: Co-signs attestation (reaches threshold, finalizes)
 * - Issuer: Can optionally co-sign after finalization
 *
 * Flow:
 * 1. Attestor 1 (Bank) submits attestation → Pending state
 * 2. Attestor 2 (Auditor) co-signs → Finalized (threshold met)
 * 3. Attestor 3 (Issuer) co-signs → Already finalized, co-sign succeeds but no state change
 */

import { ReserveProofClient } from "../src/index";
import { Keypair, Networks } from "@stellar/stellar-sdk";

async function main() {
  console.log("🔗 ReserveProof Multi-Attestor Co-Signing Example");
  console.log("==============================================\n");

  // Configuration
  const CONTRACT_ID =
    process.env.RESERVEPROOF_CONTRACT_ID ||
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7";
  const RPC_URL =
    process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
  const NETWORK_PASSPHRASE = Networks.TESTNET;

  // Load attestor keypairs
  const bankSecret = process.env.BANK_SECRET_KEY;
  const auditorSecret = process.env.AUDITOR_SECRET_KEY;
  const issuerSecret = process.env.ISSUER_SECRET_KEY;

  if (!bankSecret || !auditorSecret || !issuerSecret) {
    console.error(
      "❌ Error: BANK_SECRET_KEY, AUDITOR_SECRET_KEY, and ISSUER_SECRET_KEY environment variables required",
    );
    process.exit(1);
  }

  const bankKeypair = Keypair.fromSecret(bankSecret);
  const auditorKeypair = Keypair.fromSecret(auditorSecret);
  const issuerKeypair = Keypair.fromSecret(issuerSecret);

  const issuerAddress = issuerKeypair.publicKey();

  console.log(`📋 Multi-Attestor Configuration (2-of-3):`);
  console.log(`   Issuer: ${issuerAddress}`);
  console.log(`   Bank/Custodian: ${bankKeypair.publicKey()}`);
  console.log(`   Auditor: ${auditorKeypair.publicKey()}`);
  console.log(`   Contract ID: ${CONTRACT_ID}\n`);

  try {
    // Step 1: Bank submits attestation
    console.log("📝 Step 1: Bank submits attestation");
    const bankClient = new ReserveProofClient({
      contractId: CONTRACT_ID,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      signer: bankKeypair,
    });

    const attestation = {
      reserveBalance: BigInt(5_000_000_00), // $5M
      outstandingSupply: BigInt(5_000_000_00), // 5M tokens
      supportingDocHash: "0x" + "1".repeat(64),
    };

    const submitResult = await bankClient.submitAttestation(
      issuerAddress,
      attestation,
    );
    const attestationId = submitResult.attestationId;

    console.log(`✅ Attestation submitted (Pending)`);
    console.log(`   Attestation ID: ${attestationId}\n`);

    // Step 2: Auditor co-signs (reaches 2-of-3 threshold)
    console.log("📝 Step 2: Auditor co-signs attestation");
    const auditorClient = new ReserveProofClient({
      contractId: CONTRACT_ID,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      signer: auditorKeypair,
    });

    await auditorClient.coSignAttestation(attestationId);
    console.log(
      `✅ Attestation co-signed by auditor (Finalized - threshold reached)\n`,
    );

    // Step 3: Issuer co-signs (optional, attestation already finalized)
    console.log("📝 Step 3: Issuer co-signs attestation (optional)");
    const issuerClient = new ReserveProofClient({
      contractId: CONTRACT_ID,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      signer: issuerKeypair,
    });

    await issuerClient.coSignAttestation(attestationId);
    console.log(`✅ Attestation co-signed by issuer\n`);

    // Verify final state
    console.log("📊 Final attestation state:");
    const finalAttestation =
      await issuerClient.getLatestAttestation(issuerAddress);

    if (finalAttestation) {
      console.log(`   State: ${finalAttestation.state}`);
      console.log(`   Total Signers: ${finalAttestation.signers.length}`);
      console.log(
        `   Reserve Ratio: ${(finalAttestation.reserveBalance * 10000n) / finalAttestation.outstandingSupply} basis points\n`,
      );
    }

    console.log("✨ Multi-attestor flow completed successfully!");
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
