import type { Metadata } from 'next';

import { MediaLibrary } from '@/components/admin/MediaLibrary';

export const metadata: Metadata = { title: 'Media Library' };

export default function AdminGalleryPage() {
  return <MediaLibrary />;
}
