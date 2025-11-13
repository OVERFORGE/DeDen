import { Resend } from 'resend';
import { db } from '@/lib/database';
import { PaymentToken } from '@prisma/client';

// Initialize the Resend client
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in .env");
}
const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = 'bookings@deden.space';
const supportEmail = 'bookings@deden.space';

// (Helper function logEmailToDb is unchanged)
async function logEmailToDb(
  recipientEmail: string,
  subject: string,
  type: string,
  metadata: any = {}
) {
  try {
    await db.notification.create({
      data: {
        recipientEmail: recipientEmail,
        type: type,
        subject: subject,
        body: `Email of type ${type} sent to ${recipientEmail}`,
        status: 'sent',
        sentAt: new Date(),
        metadata: metadata,
      },
    });
  } catch (error) {
    console.error('[EmailLib] Failed to log email to DB:', error);
  }
}


// --- Email Template: Booking Approved (Payment Required) ---
interface ApprovalEmailProps {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  stayLocation: string;
  startDate: Date;
  endDate: Date;
  paymentAmount: number;
  paymentToken: string;
  paymentUrl: string;
  expiresAt: Date;
}

export async function sendApprovalEmail(props: ApprovalEmailProps) {
  const {
    recipientEmail,
    recipientName,
    bookingId,
    stayTitle,
    paymentAmount,
    paymentToken,
    paymentUrl,
    expiresAt,
  } = props;

  const subject = `Your booking for ${stayTitle} is approved!`;
  const expiryString = expiresAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // --- 🎨 NEW DARK MODE STYLED HTML BODY ---
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .container {
      background-color: #172A46; /* --- YOUR DARK BG --- */
      padding: 20px;
    }
    .card {
      background-color: #1F3A61; /* --- Lighter card BG --- */
      max-width: 600px;
      margin: 0 auto;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #3a5b8a;
    }
    .header {
      padding: 24px;
      background-color: #0070f3; /* Blue still looks good */
      color: white;
    }
    .header h2 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      color: #FFFFFF; /* --- WHITE FONT --- */
    }
    .content p {
      margin-bottom: 24px;
    }
    .payment-details {
      background-color: #172A46; /* Darker box */
      padding: 20px;
      border-radius: 6px;
      text-align: center;
      border: 1px solid #3a5b8a;
    }
    .payment-details strong {
      font-size: 28px;
      color: #58a6ff; /* Light blue for amount */
    }
    .footer {
      padding: 24px;
      font-size: 12px;
      color: #a0aec0; /* Lighter text for footer */
      text-align: center;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h2>Congratulations, ${recipientName}!</h2>
      </div>
      <div class="content">
        <p>Your application for <strong>${stayTitle}</strong> has been approved.</p>
        <p>To confirm your spot, you must complete your payment. Your payment link will expire on <strong>${expiryString}</strong>.</p>
        
        <div class="payment-details">
          Amount Due:<br>
          <strong>$${paymentAmount} ${paymentToken}</strong>
        </div>

        <p style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
                    <a href="${paymentUrl}" style="background-color: #0070f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            Pay Now
          </a>
        </p>
        
        <p style="font-size: 12px; color: #a0aec0; text-align: center; word-break: break-all;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          ${paymentUrl}
        </p>
      </div>
    </div>
    <div class="footer">
      <p>Booking ID: ${bookingId}</p>
      <p>If you have any questions, please contact <a href="mailto:${supportEmail}" style="color: #58a6ff;">${supportEmail}</a>.</p>
    </div>
  </div>
</body>
</html>
  `;
  // --- END OF NEW HTML ---

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });
    console.log('[EmailLib] Email send response:', response);

    // (Logging logic is unchanged)
    await logEmailToDb(
      recipientEmail,
      subject,
      response.data ? 'booking_approved' : 'booking_approved_failed',
      { 
        bookingId, 
        apiResponse: response,
        resendId: response.data?.id 
      }
    );

    if (response.error) {
      throw response.error;
    }

  } catch (error: any) {
    console.error('[EmailLib] Failed to send approval email:', error);
    if (!error.name) {
      await logEmailToDb(
        recipientEmail,
        subject,
        'booking_approved_failed',
        { bookingId, error: error?.message || error }
      );
    }
    throw error;
  }
}

// --- Email Template: Payment Confirmed ---
interface ConfirmationEmailProps {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  stayLocation: string;
  startDate: Date;
  endDate: Date;
  paidAmount: number;
  paidToken: PaymentToken;
  txHash: string;
  chainId: number;
}

export async function sendConfirmationEmail(props: ConfirmationEmailProps) {
  const {
    recipientEmail,
    recipientName,
    stayTitle,
    bookingId,
    paidAmount,
    paidToken,
    txHash,
    chainId,
  } = props;

  const subject = `Payment Confirmed! You're all set for ${stayTitle}`;
  const etherscanUrl = `https://testnet.bscscan.com/tx/${txHash}`; 

  // --- 🎨 NEW DARK MODE STYLED HTML BODY (Confirmation) ---
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .container {
      background-color: #172A46; /* --- YOUR DARK BG --- */
      padding: 20px;
    }
    .card {
      background-color: #1F3A61; /* --- Lighter card BG --- */
      max-width: 600px;
      margin: 0 auto;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #3a5b8a;
    }
    .header {
      padding: 24px;
      background-color: #10b981; /* Green for success */
      color: white;
    }
    .header h2 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      color: #FFFFFF; /* --- WHITE FONT --- */
    }
    .content p {
      margin-bottom: 24px;
    }
    .details-list {
      background-color: #172A46; /* Darker box */
      padding: 20px;
      border-radius: 6px;
      list-style-type: none;
      margin: 0;
      padding-left: 20px;
      border: 1px solid #3a5b8a;
    }
    .details-list li {
      margin-bottom: 12px;
      word-break: break-all;
    }
    .details-list li strong {
      color: #a0aec0; /* Light gray for labels */
    }
    .footer {
      padding: 24px;
      font-size: 12px;
      color: #a0aec0; /* Lighter text for footer */
      text-align: center;
    }
    .footer p {
      margin: 4px 0;
    }
  _   .tx-link {
      color: #58a6ff; /* Light blue link */
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h2>Payment Confirmed!</h2>
      </div>
      <div class="content">
        <p>Hi ${recipientName},</p>
        <p>We've successfully received your payment. Your spot for <strong>${stayTitle}</strong> is confirmed! We're excited to see you there.</p>
        
        <h3>Payment Details:</h3>
        <ul class="details-list">
          <li><strong>Amount Paid:</strong> $${paidAmount} ${paidToken}</li>
          <li><strong>Booking ID:</strong> ${bookingId}</li>
          <li><strong>Transaction:</strong> <a href="${etherscanUrl}" class="tx-link">${txHash}</a></li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact <a href="mailto:${supportEmail}" style="color: #58a6ff;">${supportEmail}</a>.</p>
    </div>
  </div>
</body>
</html>
  `;
  // --- END OF NEW HTML ---

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
    });
    console.log('[EmailLib] Email send response:', response);

    // (Logging logic is unchanged)
    await logEmailToDb(
      recipientEmail, 
      subject, 
      response.data ? 'payment_confirmed' : 'payment_confirmed_failed', 
       { 
        bookingId, 
        txHash, 
        apiResponse: response,
        resendId: response.data?.id
      }
    );

    if (response.error) {
      throw response.error;
    }

  } catch (error: any) {
    console.error('[EmailLib] Failed to send payment confirmation email:', error);
    if (!error.name) {
      await logEmailToDb(recipientEmail, subject, 'payment_confirmed_failed', {
        bookingId, txHash, error: error?.message || error, stack: error?.stack
      });
    }
    throw error;
  }
}