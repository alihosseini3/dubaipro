import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@dubaipro.ae';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!SMTP_HOST) {
      console.warn('SMTP not configured, email not sent:', options.to);
      return { success: false, error: 'SMTP not configured' };
    }

    await transporter.sendMail({
      from: options.from || SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendContactReplyEmail(params: {
  to: string;
  name: string;
  originalMessage: string;
  replyContent: string;
  siteName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, name, originalMessage, replyContent, siteName = 'Dubai Pro' } = params;
  
  const subject = `پاسخ به پیام شما - ${siteName} / Reply to your message`;
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Tahoma, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .original { background: #fff; padding: 15px; margin: 15px 0; border-right: 4px solid #9ca3af; border-radius: 4px; }
    .reply { background: #dbeafe; padding: 15px; margin: 15px 0; border-right: 4px solid #1e40af; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    h2 { margin-top: 0; }
    .label { font-weight: bold; color: #6b7280; font-size: 12px; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${siteName}</h1>
    </div>
    <div class="content">
      <p>سلام ${name}،</p>
      <p>به پیام شما پاسخ داده شد:</p>
      
      <div class="original">
        <div class="label">پیام اصلی شما:</div>
        <div>${originalMessage.replace(/\n/g, '<br>')}</div>
      </div>
      
      <div class="reply">
        <div class="label">پاسخ:</div>
        <div>${replyContent.replace(/\n/g, '<br>')}</div>
      </div>
      
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
      
      <p style="direction: ltr; text-align: left;">
        Hi ${name},<br>
        Your message has been replied to:
      </p>
      
      <div class="original" style="direction: ltr; text-align: left;">
        <div class="label">Your original message:</div>
        <div>${originalMessage.replace(/\n/g, '<br>')}</div>
      </div>
      
      <div class="reply" style="direction: ltr; text-align: left;">
        <div class="label">Reply:</div>
        <div>${replyContent.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
سلام ${name}،

به پیام شما پاسخ داده شد:

پیام اصلی شما:
${originalMessage}

پاسخ:
${replyContent}

---
Hi ${name},

Your message has been replied to:

Your original message:
${originalMessage}

Reply:
${replyContent}

© ${new Date().getFullYear()} ${siteName}
  `;

  return sendEmail({ to, subject, html, text });
}
