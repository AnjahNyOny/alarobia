import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** À utiliser à la place de next/link et next/navigation : ces versions ajoutent la langue courante aux adresses. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
