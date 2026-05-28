import { AddressesManager } from '@/components/account/AddressesManager';
import { requireUser } from '@/lib/auth/require-user';
import { listAddressesForUser } from '@/lib/address/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountAddressesPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/addresses');
  const addresses = await listAddressesForUser(user.id);

  return <AddressesManager initial={addresses} />;
}
