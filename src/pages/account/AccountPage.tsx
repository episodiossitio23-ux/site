import AccountShell from '@/components/account/AccountShell';
import AddressesSection from '@/components/account/AddressesSection';
import ProfileSection from '@/components/account/ProfileSection';

export default function AccountPage() {
  return (
    <AccountShell>
      {(session) => (
        <div className="space-y-6">
          <ProfileSection session={session} />
          <AddressesSection />
        </div>
      )}
    </AccountShell>
  );
}
