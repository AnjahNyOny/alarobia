import { CartUIProvider } from "@/components/store/cart-context";
import { Footer } from "@/components/store/footer";
import { Header, loadShell } from "@/components/store/header";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShell();
  return (
    <CartUIProvider>
      <div className="flex min-h-dvh flex-col">
        <Header {...shell} />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <Footer settings={shell.settings} categories={shell.categories} />
      </div>
    </CartUIProvider>
  );
}
