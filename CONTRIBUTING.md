# Contributing to ReserveProof SDK

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

## Development Workflow

### Build

```bash
npm run build
```

Output goes to `dist/` (both ESM and CJS).

### Development Mode

```bash
npm run dev
```

Watches for changes and rebuilds automatically.

### Type Check

```bash
npm run type-check
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Code Style

- TypeScript strict mode
- ESLint configuration in `.eslintrc`
- Prettier formatting (via tsup)
- No floating point in any reserve/ratio calculations — always use bigint

## Commits

This project follows Conventional Commits:

- `feat(sdk): add ReserveProofClient class`
- `feat(sdk): add BankBalanceAdapter interface`
- `docs(sdk): add watchdog example`

Each commit should be focused and leave the code in a working, tested state. Push after every commit.

## Pull Requests

- One discrete piece of work per PR
- Reference related issues
- Include brief description of changes
- Ensure CI passes (type-check, lint, build)

## Publishing to npm

To publish a new version (maintainers only):

```bash
npm version patch|minor|major
npm publish
```

## Adapter Development

To create a custom BankBalanceAdapter:

```typescript
import { BankBalanceAdapter, Balance } from '@reserveproof/sdk';

class MyBankAdapter implements BankBalanceAdapter {
  async fetchBalance(issuerId: string): Promise<Balance> {
    // Implementation here
    return { balance: BigInt(...), asOf: new Date() };
  }
}
```

See `examples/` for reference implementations.
