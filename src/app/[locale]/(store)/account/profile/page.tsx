import { AddressForm, PasswordForm, ProfileForm } from "@/components/store/auth-forms";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t py-8 first:border-0 first:pt-0 md:grid-cols-[240px_1fr] md:gap-10">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const address = await db.address.findUnique({ where: { userId: user.id } });
  return (
    <>
      <Panel title="Informations" description="Votre nom apparaît sur vos avis.">
        <ProfileForm name={user.name} phone={user.phone} email={user.email} />
      </Panel>
      <Panel title="Adresse de livraison" description="Elle sera proposée par défaut à la commande.">
        <AddressForm defaults={address ?? { fullName: user.name, phone: user.phone }} />
      </Panel>
      <Panel title="Mot de passe" description="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs.">
        <PasswordForm />
      </Panel>
    </>
  );
}
