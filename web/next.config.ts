import type { NextConfig } from "next";

// Runs as a Next.js server (`npm run dev`, or `npm run build && npm start`) so Ruby's /api/chat can keep the
// Gemini API key on the server. Everything else is still plain static files.
const nextConfig: NextConfig = {
  devIndicators: false,
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
