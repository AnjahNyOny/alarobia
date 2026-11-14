import { CartUIProvider } from "@/components/store/cart-context";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartUIProvider>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </CartUIProvider>
  );
}
