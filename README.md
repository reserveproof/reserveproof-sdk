# ReserveProof SDK

TypeScript SDK for ReserveProof integration. Simplifies submission and monitoring of on-chain proof-of-reserves attestations on Stellar.

## Overview

`@reserveproof/sdk` provides:

- **ReserveProofClient**: Typed contract interface for issuing, co-signing, and querying attestations
- **BankBalanceAdapter**: Plugin interface for integrating banking data feeds (mock included)
- **Watchdog Script**: Permissionless staleness monitoring via `flag_stale()`

## Legal Disclaimer

ReserveProof is a transparency and verification tool, not a substitute for a licensed, independent financial audit. It's designed to complement traditional audits with continuous, machine-verifiable attestations between audit cycles. This is not legal or financial advice — issuers should confirm what satisfies their jurisdiction's reserve-reporting requirements with qualified counsel.

## Installation

```bash
npm install @reserveproof/sdk
```

## Quick Start

### Initialize the client

```typescript
import { ReserveProofClient } from "@reserveproof/sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new ReserveProofClient({
  contractId: "CXXXXX...",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  signer: Keypair.fromSecret("SXXXXX..."),
});
```

### Submit an attestation

```typescript
const result = await client.submitAttestation("issuer_address", {
  reserveBalance: BigInt(1_000_000_00), // $1M in smallest units
  outstandingSupply: BigInt(1_000_000_00), // 1M tokens
  supportingDocHash: "0x...",
});
console.log("Attestation ID:", result.attestationId);
```

### Check reserve ratio

```typescript
const ratio = await client.getReserveRatio("issuer_address");
console.log("Reserve ratio (basis points):", ratio); // 10000 = 100%
```

## API Reference

### ReserveProofClient

#### Methods

- `registerIssuer(issuer: IssuerInput): Promise<TxResult>` — Register an issuer (admin only)
- `submitAttestation(issuer: string, attestation: AttestationInput): Promise<{ attestationId: string; txResult: TxResult }>` — Submit a new attestation
- `coSignAttestation(attestationId: string): Promise<TxResult>` — Co-sign an existing attestation
- `getLatestAttestation(issuer: string): Promise<Attestation | null>` — Fetch the latest finalized attestation
- `getReserveRatio(issuer: string): Promise<number | null>` — Get reserve/supply in basis points
- `isStale(issuer: string): Promise<boolean>` — Check if attestation is stale
- `flagStale(issuer: string): Promise<TxResult>` — Flag an issuer as stale (permissionless)

## Examples

See `examples/` directory:

- `submit-attestation.ts` — Single-attestor submission
- `multi-attestor-cycle.ts` — Multi-sig co-signing
- `watchdog.ts` — Permissionless staleness watcher (run as cron job)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT License — see [LICENSE](LICENSE)
