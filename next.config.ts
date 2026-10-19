import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These are server-only heavyweights. Keeping them external avoids bundling
  // binary/data assets (pdf.js, mammoth's docx internals) into the server build.
  serverExternalPackages: ["unpdf", "mammoth", "cheerio", "bcryptjs", "stripe"],
  experimental: {
    // Document uploads are posted as multipart bodies; allow larger payloads.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
