import nextConfig from "eslint-config-next";

// eslint-config-next ships ready-to-use flat config objects (no legacy
// FlatCompat shim needed as of Next.js 15.5+ / eslint-config-next 16.x).
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/generated/**",
      "prisma/generated/**",
    ],
  },
  ...nextConfig,
  {
    rules: {
      // Project-specific overrides go here as the codebase grows.
    },
  },
];

export default eslintConfig;
