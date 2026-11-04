import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Une clases de Tailwind sin que choquen (la usan los componentes de cult-ui y shadcn).
export function cn(...entradas) {
  return twMerge(clsx(entradas));
}
