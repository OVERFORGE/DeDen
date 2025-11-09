// File: app/lib/email.ts

import { Resend } from 'resend';
import { db } from '@/lib/database';
import { PaymentToken } from '@prisma/client';

// 1. Initialize the Resend client
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in .env");
}
const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const supportEmail = process.env.EMAIL_SUPPORT || 'support@example.com';

// --- Helper function to log emails to the database ---
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
        body: `Email of type ${type} sent to ${recipientEmail}`, // Body is optional, just logging
        status: 'sent', // We assume it's sent, Resend will throw an error if it fails
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
  priceUSDC: number;
  priceUSDT: number;
  paymentUrl: string;
  expiresAt: Date;
}

export async function sendApprovalEmail(props: ApprovalEmailProps) {
  const {
    recipientEmail,
    recipientName,
    bookingId,
    stayTitle,
    paymentUrl,
    expiresAt,
    priceUSDC,
  } = props;

  const subject = `Your booking for ${stayTitle} is approved!`;
  const expiryString = expiresAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Congratulations, ${recipientName}!</h2>
      <p>Your application for <strong>${stayTitle}</strong> has been approved.</p>
      <p>To confirm your spot, you must complete your payment of <strong>$${priceUSDC} USDC/USDT</strong>.</p>
      <p>Your payment link will expire on <strong>${expiryString}</strong>.</p>
      <a href="${paymentUrl}" style="background-color: #0070f3; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
        Pay Now
      </a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${paymentUrl}</p>
      <hr>
      <p style="font-size: 0.9em; color: #777;">
        Booking ID: ${bookingId}<br>
        If you have any questions, please contact ${supportEmail}.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to: recipientEmail,
    subject: subject,
    html: htmlBody,
  });

  await logEmailToDb(recipientEmail, subject, 'booking_approved', { bookingId });
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
  } = props;
  
  const subject = `Payment Confirmed! You're all set for ${stayTitle}`;
  const etherscanUrl = `https://testnet.bscscan.com/tx/${txHash}`; // Assumes BSC Testnet

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Payment Confirmed!</h2>
      <p>Hi ${recipientName}, we've successfully received your payment. Your spot for <strong>${stayTitle}</strong> is confirmed!</p>
      <h3>Payment Details:</h3>
      <ul>
        <li><strong>Amount Paid:</strong> ${paidAmount} ${paidToken}</li>
        <li><strong>Booking ID:</strong> ${bookingId}</li>
        <li><strong>Transaction:</strong> <a href="${etherscanUrl}">${txHash.substring(0, 12)}...</a></li>
      </ul>
      <p>We're excited to see you there!</p>
      <hr>
      <p style="font-size: 0.9em; color: #777;">
        If you have any questions, please contact ${supportEmail}.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to: recipientEmail,
    subject: subject,
    html: htmlBody,
  });

  await logEmailToDb(recipientEmail, subject, 'payment_confirmed', { bookingId, txHash });
}