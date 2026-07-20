import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmTarget = path.join(root, 'dist/wasm');

describe('prepare-local-model', () => {
  it('copies the fixed WASM runtime and its module companion', () => {
    execFileSync(process.execPath, ['scripts/prepare-local-model.mjs'], {
      cwd: root
    });

    expect(existsSync(path.join(wasmTarget, 'ort-wasm-simd-threaded.wasm'))).toBe(true);
    expect(existsSync(path.join(wasmTarget, 'ort-wasm-simd-threaded.mjs'))).toBe(true);
  });
});
