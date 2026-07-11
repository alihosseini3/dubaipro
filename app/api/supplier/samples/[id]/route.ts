import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { sampleActionSchema } from '@/lib/messaging/schemas';
import { SampleError, updateSampleStatus } from '@/lib/samples/service';

export const runtime = 'nodejs';

/** PATCH /api/supplier/samples/[id] — accept / decline / ship / close. */
export const PATCH = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.samples.manage',
    body: sampleActionSchema,
    audit: { action: 'sample.status', entityType: 'SampleRequest' }
  },
  async ({ supplier, user, params, body, audit }) => {
    try {
      const sample = await updateSampleStatus(
        supplier.id,
        user.id,
        String(params.id),
        body.action
      );
      audit.entityId = sample.id;
      audit.diff = { after: { status: sample.status } };
      return NextResponse.json({ data: sample });
    } catch (error) {
      if (error instanceof SampleError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
