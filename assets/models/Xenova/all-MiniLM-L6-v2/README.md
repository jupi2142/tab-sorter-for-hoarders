Source: Xenova/all-MiniLM-L6-v2
Model revision: 751bff37182d3f1213fa05d7196b954e230abad9
License: Apache-2.0
Conversion source: Xenova Transformers.js ONNX conversion of sentence-transformers/all-MiniLM-L6-v2
ONNX Runtime Web version: 1.22.0-dev.20250409-89f8206ba4 (transitive dependency of @huggingface/transformers 3.8.1)
WASM asset manifest:
- ort-wasm-simd-threaded.wasm
- ort-wasm-simd-threaded.mjs
Runtime configuration requirement for the future LocalEmbeddingService:
- Set env.backends.onnx.wasm.numThreads = 1 before creating the extractor.
Files required by the extension:
- config.json
- tokenizer.json
- tokenizer_config.json
- special_tokens_map.json
- onnx/model_quantized.onnx
