#!/usr/bin/env node

/**
 * ReserveProof Staleness Watchdog
 *
 * This script continuously monitors registered issuers for stale attestations
 * and calls flag_stale() permissionlessly when the attestation window exceeds.
 *
 * Key properties:
 * - Permissionless: Anyone can run this watchdog (no special auth required)
 * - Public good: Keeps issuers honest by continuously checking staleness
 * - Event-driven: Emits EVENT_ISSUER_FLAGGED_STALE when triggered
 * - Runnable as cron: Set to run every N seconds/minutes
 *
 * Usage:
 *   node examples/watchdog.ts                        # Run once
 *   node examples/watchdog.ts --interval 300        # Run every 5 minutes
 *   crontab: `*\/5 * * * *` node examples/watchdog.ts # Run every 5 minutes via cron
 */

import { ReserveProofClient } from "../src/index";
import { Keypair, Networks } from "@stellar/stellar-sdk";

interface WatchdogConfig {
  contractId: string;
  rpcUrl: string;
  issuers: string[]; // List of issuer addresses to monitor
  interval?: number; // Poll interval in seconds (0 = run once)
  signerSecret?: string; // Optional signer for flag_stale transactions
}

async function checkStaleness(
  client: ReserveProofClient,
  issuer: string,
): Promise<boolean> {
  const stale = await client.isStale(issuer);
  return stale;
}

async function flagIfStale(
  client: ReserveProofClient,
  issuer: string,
): Promise<void> {
  const stale = await checkStaleness(client, issuer);
  if (stale) {
    console.log(
      `⚠️  [${new Date().toISOString()}] Issuer ${issuer} is stale - flagging...`,
    );
    try {
      const result = await client.flagStale(issuer);
      console.log(`✅ Flagged issuer ${issuer}`);
      console.log(`   Tx Hash: ${result.transactionHash}`);
      console.log(`   Emitted: EVENT_ISSUER_FLAGGED_STALE\n`);
    } catch (error) {
      console.error(
        `❌ Error flagging issuer ${issuer}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  } else {
    console.log(`✓  [${new Date().toISOString()}] Issuer ${issuer} is current`);
  }
}

async function runWatchdog(config: WatchdogConfig): Promise<void> {
  console.log("🔍 ReserveProof Staleness Watchdog");
  console.log("==================================\n");

  console.log(`📋 Configuration:`);
  console.log(`   Contract ID: ${config.contractId}`);
  console.log(`   RPC URL: ${config.rpcUrl}`);
  console.log(`   Monitoring ${config.issuers.length} issuer(s)`);
  console.log(
    `   Interval: ${config.interval ? `${config.interval}s` : "run once"}\n`,
  );

  // Create client with optional signer (needed only if we call flag_stale)
  // For permissionless flag_stale, any signer works; using a dummy one if not provided
  const defaultSigner = Keypair.random();
  const signerKeypair = config.signerSecret
    ? Keypair.fromSecret(config.signerSecret)
    : defaultSigner;

  const client = new ReserveProofClient({
    contractId: config.contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: Networks.TESTNET,
    signer: signerKeypair,
  });

  // Poll loop
  let iterationCount = 0;
  while (true) {
    iterationCount++;
    console.log(`\n📢 Poll #${iterationCount} - ${new Date().toISOString()}`);
    console.log("─".repeat(50));

    for (const issuer of config.issuers) {
      try {
        await flagIfStale(client, issuer);
      } catch (error) {
        console.error(
          `❌ Error checking issuer ${issuer}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const interval = config.interval;
    if (!interval) {
      console.log("\n✨ Watchdog run complete (one-shot mode)");
      break;
    }

    console.log(`⏳ Next poll in ${interval}s...`);
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }
}

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  let interval = 0; // Default: run once
  const issuers: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--interval" && args[i + 1]) {
      interval = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--issuer" && args[i + 1]) {
      issuers.push(args[i + 1]);
      i++;
    }
  }

  // Load configuration from environment
  const contractId =
    process.env.RESERVEPROOF_CONTRACT_ID ||
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7";
  const rpcUrl =
    process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";

  // If no issuers specified via CLI, load from environment (comma-separated)
  const issuersEnv = process.env.RESERVEPROOF_ISSUERS_TO_WATCH || "";
  const finalIssuers =
    issuers.length > 0
      ? issuers
      : issuersEnv.split(",").filter((s) => s.trim());

  if (finalIssuers.length === 0) {
    console.error("❌ Error: No issuers to watch");
    console.error("   Provide via: --issuer ADDR1 --issuer ADDR2");
    console.error(
      '   Or environment: RESERVEPROOF_ISSUERS_TO_WATCH="ADDR1,ADDR2"',
    );
    process.exit(1);
  }

  const config: WatchdogConfig = {
    contractId,
    rpcUrl,
    issuers: finalIssuers,
    interval,
    signerSecret: process.env.WATCHDOG_SIGNER_SECRET,
  };

  await runWatchdog(config);
}

main().catch((error) => {
  console.error(
    "❌ Watchdog error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
