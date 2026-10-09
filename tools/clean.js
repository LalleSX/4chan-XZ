import { rm } from 'node:fs/promises';

// Fixed URL keeps cleanup within this checkout regardless of the current directory.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
