"use client";

import { createContext, useContext, useState } from "react";

const CartUI = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export function CartUIProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <CartUI.Provider value={{ open, setOpen }}>{children}</CartUI.Provider>;
}

export function useCartUI() {
  const ctx = useContext(CartUI);
  if (!ctx) throw new Error("useCartUI doit être utilisé dans CartUIProvider");
  return ctx;
}
