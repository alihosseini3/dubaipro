import { notFound } from 'next/navigation';

import { VisualPageBuilder } from '@/components/admin/builder/VisualPageBuilder';
import { getPageById } from '@/lib/pages/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export const dynamic = 'force-dynamic';

export default async function AdminPageEditor({ params }: Props) {
  const { locale, id } = await params;
  const page = await getPageById(id);
  if (!page) notFound();

  return <VisualPageBuilder initial={page} locale={locale} />;
}
