import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  // Cloudflare Pages 直接托管静态产物；核心图像处理在浏览器端完成。
  output: 'export',
  trailingSlash: true,
  // AI 抠图依赖 onnxruntime-web / wasm，避免被 webpack 错误打包成 node 版
  serverExternalPackages: ['@imgly/background-removal', 'onnxruntime-web'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

export default withPWA(nextConfig);
