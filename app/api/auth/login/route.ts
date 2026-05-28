import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

const GENERIC_ERROR = 'Invalid email or password';

export async function POST(request: Request) {
  const parsed = await parseJsonBody<LoginBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!isNonEmptyString(body.email) || !isNonEmptyString(body.password)) {
    // Intentionally generic — never reveal which field was wrong.
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const email = body.email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, password: true }
    });

    // Always run verifyPassword even when the user is missing so that
    // login time does not leak whether the email exists (timing attack).
    const storedHash =
      user?.password ??
      // Dummy hash with the same format. verifyPassword returns false.
      'scrypt$1$00$00';
    const ok = await verifyPassword(body.password, storedHash);

    if (!user || !ok) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const { password: _unused, ...publicUser } = user;
    await createSession(publicUser);

    return NextResponse.json({ data: publicUser });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/auth/login');
  }
}
