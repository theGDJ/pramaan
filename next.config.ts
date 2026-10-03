import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native/heavy packages used only on the server — keep them out of
  // TurboPack/Edge bundling so they load from node_modules at runtime
  // (PGlite resolves its WASM from a real filesystem path; node-llama-cpp
  // loads native .node addons and shared libraries).
  serverExternalPackages: [
    "node-llama-cpp",
    "@node-llama-cpp/linux-x64",
    "@node-llama-cpp/linux-x64-vulkan",
    "@node-llama-cpp/linux-x64-cuda",
    "@node-llama-cpp/linux-x64-cuda-ext",
    "@electric-sql/pglite",
  ],
};

export default nextConfig;
