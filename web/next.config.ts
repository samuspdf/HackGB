import type { NextConfig } from "next";

// Static export: `npm run build` writes plain HTML/CSS/JS to `out/` — no server needed (spec §5).
const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
