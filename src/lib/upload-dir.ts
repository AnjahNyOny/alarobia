import path from "node:path";

/** Dossier des fichiers envoyés. Les tests utilisent le leur via UPLOAD_DIR. */
export const uploadDir = () => path.join(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || "uploads");

/** Chemin d'un fichier du dossier des envois. `name` est toujours un nom généré ou vérifié par le serveur, jamais un chemin. */
export const uploadPath = (name: string) => path.join(/* turbopackIgnore: true */ uploadDir(), path.basename(name));
