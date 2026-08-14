#!/usr/bin/env node

/**
 * Example: Single-Attestor Attestation Submission
 *
 * This example demonstrates how a single attestor (e.g., the issuer itself)
 * submits a reserve attestation that finalizes immediately.
 *
 * Flow:
 * 1. Connect to Soroban testnet via RPC
 * 2. Load issuer keypair
 * 3. Create ReserveProofClient pointing to deployed contract
 * 4. Submit attestation with reserve balance and supply
 * 5. Poll for finalization event
 */

import { ReserveProofClient, MockBankAdapter } from "../src/index";
import { Keypair, Networks } from "@stellar/stellar-sdk";

async function main() {
  console.log("🔗 ReserveProof Single-Attestor Submission Example");
  console.log("================================================\n");

  // Configuration
  const CONTRACT_ID =
    process.env.RESERVEPROOF_CONTRACT_ID ||
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7";
  const RPC_URL =
    process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
  const NETWORK_PASSPHRASE = Networks.TESTNET;

  // Load issuer keypair (from environment or .env)
  const issuerSecret = process.env.ISSUER_SECRET_KEY;
  if (!issuerSecret) {
    console.error("❌ Error: ISSUER_SECRET_KEY environment variable not set");
    process.exit(1);
  }

  const issuerKeypair = Keypair.fromSecret(issuerSecret);
  const issuerAddress = issuerKeypair.publicKey();

  console.log(`📋 Configuration:`);
  console.log(`   Contract ID: ${CONTRACT_ID}`);
  console.log(`   RPC URL: ${RPC_URL}`);
  console.log(`   Issuer Address: ${issuerAddress}\n`);

  // Initialize client
  const client = new ReserveProofClient({
    contractId: CONTRACT_ID,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    signer: issuerKeypair,
  });

  try {
    // Example attestation data
    const attestation = {
      reserveBalance: BigInt(1_000_000_00), // $1M in cents
      outstandingSupply: BigInt(1_000_000_00), // 1M USDC
      supportingDocHash: "0x" + "0".repeat(64), // Mock hash
    };

    console.log(`📝 Submitting attestation:`);
    console.log(
      `   Reserve Balance: ${attestation.reserveBalance / BigInt(100)} (cents)`,
    );
    console.log(`   Outstanding Supply: ${attestation.outstandingSupply}`);
    console.log(`   Doc Hash: ${attestation.supportingDocHash}\n`);

    // Submit attestation
    console.log("⏳ Submitting attestation to contract...");
    const result = await client.submitAttestation(issuerAddress, attestation);

    console.log(`✅ Attestation submitted!`);
    console.log(`   Attestation ID: ${result.attestationId}`);
    console.log(`   Tx Hash: ${result.txResult.transactionHash}`);
    console.log(
      `   Ledger Close Time: ${new Date(result.txResult.ledgerCloseTime * 1000).toISOString()}\n`,
    );

    // For single-attestor (min_signers=1), attestation should be immediately finalized
    console.log("📊 Checking attestation state...");
    const latestAttestation = await client.getLatestAttestation(issuerAddress);

    if (latestAttestation) {
      console.log(`✅ Attestation state:`);
      console.log(`   State: ${latestAttestation.state}`);
      console.log(`   Signers: ${latestAttestation.signers.length}`);
      console.log(
        `   Reserve Ratio: ${(latestAttestation.reserveBalance * 10000n) / latestAttestation.outstandingSupply} basis points\n`,
      );
    }

    console.log("✨ Example completed successfully!");
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
