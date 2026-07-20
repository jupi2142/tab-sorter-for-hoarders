import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelSource = path.join(root, 'assets/models');
const modelTarget = path.join(root, 'dist/models');
const wasmSource = path.join(
  root,
  'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'
);
const wasmTarget = path.join(root, 'dist/wasm');
const wasmAssets = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs'
];
const requiredModel = path.join(
  modelSource,
  'Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx'
);

if (!existsSync(requiredModel)) {
  throw new Error(`Missing vendored local model: ${requiredModel}`);
}

for (const wasmAsset of wasmAssets) {
  if (!existsSync(path.join(wasmSource, wasmAsset))) {
    throw new Error(`Missing required ONNX Runtime asset: ${wasmAsset}`);
  }
}

await cp(modelSource, modelTarget, { recursive: true });
await mkdir(wasmTarget, { recursive: true });
for (const wasmAsset of wasmAssets) {
  await cp(path.join(wasmSource, wasmAsset), path.join(wasmTarget, wasmAsset));
}
