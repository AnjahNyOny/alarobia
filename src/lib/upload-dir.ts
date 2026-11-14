import path from "node:path";

/** Dossier des fichiers envoyés. Les tests utilisent le leur via UPLOAD_DIR. */
export const uploadDir = () => path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
