import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: { default: "Administration", template: "%s — Administration" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [settings, toProcess] = await Promise.all([getSettings(), db.order.count({ where: { status: { in: ["PENDING", "PAID"] } } })]);
  return (
    <div className="min-h-dvh bg-background">
      <AdminSidebar toProcess={toProcess} storeName={settings.storeName} userName={user.name} />
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
