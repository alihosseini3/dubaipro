import type { Metadata } from 'next';
import Link from 'next/link';

import { MediaAnalyticsDashboard } from '@/components/admin/media/MediaAnalyticsDashboard';

export const metadata: Metadata = { title: 'Media Analytics' };

export default function MediaAnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="../gallery" className="hover:text-slate-600">Media Library</Link>
        <span>/</span>
        <span className="font-medium text-slate-600">Analytics</span>
      </nav>
      <MediaAnalyticsDashboard />
    </div>
  );
}
