# Security Model: ReserveProof SDK

This document outlines security best practices and guarantees for using the ReserveProof TypeScript SDK.

## Key Management

### Private Keys

**Never share private keys.** The SDK supports two signing methods:

1. **Keypair-based signing** (for backend/admin use)
   ```typescript
   const signer = Keypair.random();
   const client = new ReserveProofClient({ signer, ... });
   ```

2. **Wallet-based signing** (for browser/frontend use)
   ```typescript
   const signer = new WalletSigner(walletInstance);
   const client = new ReserveProofClient({ signer, ... });
   ```

### Environment Variables

Protect sensitive configuration:

```bash
# .env (local development only, never commit)
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SOROBAN_CONTRACT_ID=CAB3UJF...
SIGNER_SECRET_KEY=SBXXXXXXXXXX  # Never commit to git!
```

Add `.env` to `.gitignore`:
```
.env
.env.local
*.env
```

## Network Configuration

### Validation

The SDK validates:
- Contract ID format (must be valid Stellar address)
- RPC URL format (must be HTTPS)
- Network passphrase (must be non-empty string)

```typescript
// Throws if configuration is invalid
const client = new ReserveProofClient({
  contractId: "CAB3UJF...",  // Must be valid address
  rpcUrl: "https://...",      // Must be HTTPS
  networkPassphrase: "...",   // Must be provided
  signer: keypair,
});
```

### RPC Endpoint Security

- Use official Stellar RPC endpoints in production
- Don't send private keys to untrusted RPC endpoints
- Consider rate-limiting if using shared RPC
- Monitor RPC responses for anomalies

## Input Validation

The SDK validates all user inputs before sending to chain:

- **Contract ID**: Must be valid Stellar address format
- **Amounts**: Non-negative integers (validated in attestation submission)
- **Attestation data**: Hash format validation (32-byte)
- **Addresses**: Valid Stellar address format

```typescript
// Example: Input validation
try {
  await client.submitAttestation({
    issuer: invalidAddress,  // Throws if format invalid
    reserveBalance: -100,    // Throws if negative
  });
} catch (error) {
  // Handle validation error
}
```

## Error Handling

Errors may contain sensitive information. Handle carefully:

```typescript
try {
  await client.submitAttestation(...);
} catch (error) {
  // Do NOT log the full error to public logs
  console.error("Attestation submission failed"); // Safe
  // console.error(error); // Unsafe - may contain RPC details
  
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NetworkError) {
    // Handle network error
  }
}
```

## Transaction Signing

### Security Guarantees

- All transactions signed locally (never sent unsigned)
- Keypair signer never transmits private keys
- WalletSigner delegates to wallet extension (maintains key isolation)
- Transaction validation before signing

### Wallet Interactions

When using WalletSigner:
- Wallet extension controls key access
- User approval required for each transaction
- No private keys touch the SDK
- Verify wallet is authentic before connecting

## Data Privacy

### What's Transmitted

Attestation submissions include:
- Issuer address
- Reserve balance amount
- Outstanding supply amount
- Supporting documentation hash

### What's NOT Transmitted

- Private keys
- Wallet credentials
- Personal identification
- Off-chain secrets

## Dependency Security

The SDK depends on:
- `@stellar/stellar-sdk@12` — Official Stellar SDK (well-maintained, regularly audited)

Audit dependencies:
```bash
npm audit
npm install  # To install security patches
```

## Logging & Debugging

### Safe Logging

```typescript
// Safe - logs non-sensitive data
logger.info("Attestation submitted", { 
  issuer: client.issuer,
  transactionHash: result.hash,
});

// Unsafe - logs sensitive data
logger.info("Transaction", { result });  // Contains RPC response details
```

### Debug Mode

Don't enable debug mode in production. Debug logs may expose:
- Full transaction details
- RPC endpoint URLs
- Error stack traces with system info

## Supply Chain Security

### Package Integrity

Verify npm package authenticity:

```bash
npm view @reserveproof/sdk dist.integrity
npm install @reserveproof/sdk --save
```

### Source Verification

Audit published code against GitHub:
1. Check package version matches tag on GitHub
2. Review changes in that tag
3. Verify signatures if available

## Threat Model

### Protected Against

- Unauthorized attestation submission (via signer authentication)
- Malformed or invalid transactions (via validation layer)
- Man-in-the-middle attacks (via HTTPS + Stellar validation)
- Replay attacks (via Stellar network sequence numbers)

### Not Protected Against

- Compromised RPC endpoint (use trusted endpoints)
- Leaked private keys (user responsibility)
- Weak wallet security (user responsibility)
- Network connectivity issues (implement retry logic)

## Security Updates

If a vulnerability is discovered:
1. Email security@reserveproof.dev
2. Include vulnerability details
3. Do not open public GitHub issues
4. Patch will be released as soon as possible

## Compliance

- Uses standard Stellar signing mechanisms
- Compatible with standard wallet integrations
- No non-standard cryptography
- Follows TypeScript security best practices

## Testing

The SDK includes security tests:
- Input validation tests
- Signer abstraction tests
- Network configuration tests
- Error handling tests

Run tests with:
```bash
npm test
```

## Support

For security questions or concerns:
- GitHub Issues: https://github.com/reserveproof/reserveproof-sdk/issues
- Email: security@reserveproof.dev
- Documentation: https://docs.reserveproof.dev
