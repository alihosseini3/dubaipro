/* eslint-disable */
import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/** POST /api/supplier/products — Create a new product */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Verify user is a supplier
  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!supplier) {
    return NextResponse.json({ error: 'not a supplier' }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    // Generate slug if not provided
    const slug = body.slug || body.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check for duplicate slug
    const existing = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
    }

    // Build product data with new B2B fields
    const attributes = body.attributes || {};
    const tierPricing = body.tierPricing || [];
    const productData: any = {
      supplierId: supplier.id,
      categoryId: body.categoryId || '',
      title: body.title,
      slug,
      description: body.description || '',
      price: body.price || 0,
      compareAtPrice: body.compareAtPrice || null,
      currency: body.currency || 'USD',
      stock: body.stock ? parseInt(body.stock) : 0,
      moq: body.moq ? parseInt(body.moq) : 1,
      moqUnit: body.moqUnit || 'pieces',
      samplePrice: body.samplePrice || null,
      sampleMOQ: body.sampleMOQ ? parseInt(body.sampleMOQ) : 1,
      tradeTerms: body.tradeTerms || 'FOB',
      originCountry: body.originCountry || null,
      leadTimeDays: body.leadTimeDays ? parseInt(body.leadTimeDays) : null,
      warrantyYears: body.warrantyYears ? parseInt(body.warrantyYears) : null,
      weight: body.weight ? parseFloat(body.weight) : null,
      length: body.length ? parseFloat(body.length) : null,
      width: body.width ? parseFloat(body.width) : null,
      height: body.height ? parseFloat(body.height) : null,
      isB2B: true,
      isPublished: body.publish === 'true' || false,
      attributes,
      tierPricing,
    };

    const createData: any = { data: productData };
    const product = await prisma.product.create(createData);

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    console.error('[supplier-products]', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

/** GET /api/supplier/products — List supplier's products */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!supplier) {
    return NextResponse.json({ error: 'not a supplier' }, { status: 403 });
  }

  const countSelect: any = { b2bInquiries: true };
  const include: any = {
    category: { select: { name: true } },
    _count: { select: countSelect },
  };
  const query: any = {
    where: { supplierId: supplier.id },
    orderBy: { createdAt: 'desc' },
    include,
  };

  const products = await prisma.product.findMany(query);

  return NextResponse.json({ data: products });
}
