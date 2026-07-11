import { NextRequest, NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { sendContactReplyEmail } from '@/lib/email/service';
import { parseJsonBody, isNonEmptyString } from '@/lib/api/validation';
import { handlePrismaError } from '@/lib/api/errors';
import {
  getOrCreateSupportConversation,
  sendMessage
} from '@/lib/messaging/service';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/admin/messages/contact/[id]/reply
// Reply to a contact message: send email + create internal chat
export async function POST(request: NextRequest, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const parseResult = await parseJsonBody<{
    replyContent: string;
    createChat?: boolean;
  }>(request);

  if (!parseResult.ok) {
    return NextResponse.json({ error: parseResult.error }, { status: 400 });
  }

  const { replyContent, createChat = true } = parseResult.data;

  if (!isNonEmptyString(replyContent) || replyContent.trim().length < 1) {
    return NextResponse.json(
      { error: 'Reply content is required' },
      { status: 400 }
    );
  }

  const trimmedReply = replyContent.trim();

  try {
    // 1. Get contact message
    const contactMessage = await prisma.contactMessage.findUnique({
      where: { id }
    });

    if (!contactMessage) {
      return NextResponse.json(
        { error: 'Contact message not found' },
        { status: 404 }
      );
    }

    // 2. Send email reply
    const emailResult = await sendContactReplyEmail({
      to: contactMessage.email,
      name: contactMessage.name,
      originalMessage: contactMessage.message,
      replyContent: trimmedReply
    });

    if (!emailResult.success) {
      console.error('Failed to send email reply:', emailResult.error);
      // Continue with chat creation even if email fails
    }

    let conversationId: string | null = null;

    // 3. Create internal chat if user exists or createChat is true
    if (createChat && contactMessage.userId) {
      try {
        const conversation = await getOrCreateSupportConversation(
          admin.id,
          contactMessage.userId
        );
        conversationId = conversation.id;

        await sendMessage({
          conversationId: conversation.id,
          senderId: admin.id,
          content: `پاسخ به پیام فرم تماس / Reply to contact form:\n\n${trimmedReply}`
        });
      } catch (chatError) {
        console.error('Failed to create chat conversation:', chatError);
      }
    }

    // 4. Update contact message with reply info
    const updatedMessage = await prisma.contactMessage.update({
      where: { id },
      data: {
        replyContent: trimmedReply,
        replySentAt: new Date(),
        repliedById: admin.id,
        conversationId,
        status: 'READ'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMessage.id,
        replyContent: updatedMessage.replyContent,
        replySentAt: updatedMessage.replySentAt,
        emailSent: emailResult.success,
        conversationId,
        chatCreated: !!conversationId
      }
    });

  } catch (error) {
    return handlePrismaError(error, 'Reply to contact message');
  }
}
