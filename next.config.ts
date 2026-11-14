import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Les tests navigateur compilent dans leur propre dossier pour ne pas gêner le serveur de dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
