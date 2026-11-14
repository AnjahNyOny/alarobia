import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les tests navigateur compilent dans leur propre dossier pour ne pas gêner le serveur de dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
