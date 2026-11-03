import AdminShell from '@/components/admin/AdminShell';
import PickupSettingsForm from '@/components/admin/settings/PickupSettingsForm';
import FormatsForm from '@/components/admin/settings/FormatsForm';
import ShippingMethodsForm from '@/components/admin/settings/ShippingMethodsForm';
import SmtpSettingsForm from '@/components/admin/settings/SmtpSettingsForm';
import PaymentSettingsForm from '@/components/admin/settings/PaymentSettingsForm';

export default function AdminSettingsPage() {
  return (
    <AdminShell>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl text-stone-900">Configurações</h1>
          <p className="mt-1 text-sm text-stone-500">Dados da loja, entregas e e-mails.</p>
        </div>
        <PickupSettingsForm />
        <ShippingMethodsForm />
        <FormatsForm />
        <PaymentSettingsForm />
        <SmtpSettingsForm />
      </main>
    </AdminShell>
  );
}
