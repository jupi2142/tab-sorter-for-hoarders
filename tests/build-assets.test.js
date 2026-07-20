import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distPath = (...segments) => path.join(root, 'dist', ...segments);

describe('offline build artifacts', () => {
  it('ships the model and both ONNX Runtime assets without cloud or API-key configuration', () => {
    rmSync(distPath(), { recursive: true, force: true });
    execFileSync(process.execPath, ['build.js'], {
      cwd: root,
      stdio: 'pipe'
    });

    expect(existsSync(distPath(
      'models',
      'Xenova',
      'all-MiniLM-L6-v2',
      'onnx',
      'model_quantized.onnx'
    ))).toBe(true);
    expect(existsSync(distPath('wasm', 'ort-wasm-simd-threaded.mjs'))).toBe(true);
    expect(existsSync(distPath('wasm', 'ort-wasm-simd-threaded.wasm'))).toBe(true);

    const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const background = readFileSync(distPath('background.js'), 'utf8');

    expect(manifest.permissions).not.toContain('storage');
    expect(manifest.action.default_popup).toBeUndefined();
    expect(manifest.options_ui).toBeUndefined();
    expect(manifest.content_security_policy.extension_pages)
      .not.toMatch(/connect-src|generativelanguage\.googleapis\.com/iu);
    expect(background).not.toMatch(
      /generativelanguage|googleApiKey|checkApiKey|openOptionsPage/iu
    );
  });
});
