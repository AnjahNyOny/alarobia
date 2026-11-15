import { getTranslations } from "next-intl/server";
import { AddressForm, PasswordForm, ProfileForm } from "@/components/store/auth-forms";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t py-8 first:border-0 first:pt-0 md:grid-cols-[260px_1fr] md:gap-10">
      <div>
        <h2 className="display-sm text-2xl">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="max-w-xl min-w-0">{children}</div>
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const [address, t] = await Promise.all([db.address.findUnique({ where: { userId: user.id } }), getTranslations("account")]);
  return (
    <>
      <Panel title={t("infoTitle")} description={t("infoText")}>
        <ProfileForm name={user.name} phone={user.phone} email={user.email} />
      </Panel>
      <Panel title={t("addressTitle")} description={t("addressText")}>
        <AddressForm defaults={address ?? { fullName: user.name, phone: user.phone }} />
      </Panel>
      <Panel title={t("passwordTitle")} description={t("passwordText")}>
        <PasswordForm />
      </Panel>
    </>
  );
}
