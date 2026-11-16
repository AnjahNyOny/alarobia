import { CartUIProvider } from "@/components/store/cart-context";
import { Footer } from "@/components/store/footer";
import { Header, loadShell } from "@/components/store/header";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShell();
  return (
    <CartUIProvider>
      <div className="flex min-h-dvh flex-col">
        <Header {...shell} />
        {/* tabIndex -1 : le lien d'évitement y amène vraiment le focus (la tabulation suivante part du contenu). */}
        <main id="contenu" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <Footer settings={shell.settings} categories={shell.categories} />
      </div>
    </CartUIProvider>
  );
}
