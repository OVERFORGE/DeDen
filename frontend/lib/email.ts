import { Resend } from "resend";
import { db } from "@/lib/database";
import { PaymentToken } from "@prisma/client";
import { chainConfig } from "@/lib/config";

// Initialize the Resend client
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in .env");
}
const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = "bookings@deden.space";
const supportEmail = "bookings@deden.space";

// ✅ FIXED: Get base URL with proper environment handling
function getBaseUrl(): string {
  if (process.env.NODE_ENV === "production") {
    const url =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "https://deden.space";

    const cleanUrl = url.replace(/\/$/, "");
    console.log("[EmailLib] Using PRODUCTION base URL:", cleanUrl);
    return cleanUrl;
  }

  const url =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const cleanUrl = url.replace(/\/$/, "");
  console.log("[EmailLib] Using DEVELOPMENT base URL:", cleanUrl);
  return cleanUrl;
}

const baseUrl = getBaseUrl();

// Helper function to log emails to database
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
        status: "sent",
        sentAt: new Date(),
        metadata: metadata,
      },
    });
  } catch (error) {
    console.error("[EmailLib] Failed to log email to DB:", error);
  }
}

// Helper to get block explorer URL based on chain
function getExplorerUrl(chainId: number, txHash: string): string {
  const chain = chainConfig[chainId];
  if (!chain) return "#";
  return `${chain.blockExplorer}/tx/${txHash}`;
}

// Helper to get chain display name
function getChainDisplayName(chainId: number): string {
  const chain = chainConfig[chainId];
  return chain?.name || "Unknown Chain";
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
  chainId?: number;
  paymentUrl: string;
  expiresAt: Date;
  isReservation?: boolean; // ✅ NEW: Is this a reservation payment?
  numberOfNights?: number; // ✅ NEW: Number of nights
  fullAmount?: number; // ✅ NEW: Full booking amount (for reservation context)
}

export async function sendApprovalEmail(props: ApprovalEmailProps) {
  const {
    recipientEmail,
    recipientName,
    bookingId,
    stayTitle,
    paymentAmount,
    paymentToken,
    chainId,
    paymentUrl,
    expiresAt,
    isReservation,
    numberOfNights,
    fullAmount,
  } = props;

  const subject = isReservation 
    ? `🎉 Application Approved - Reservation Required - ${stayTitle}`
    : `🎉 Application Approved - ${stayTitle}`;
  
  const expiryString = expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const chainName = chainId
    ? getChainDisplayName(chainId)
    : "your preferred network";

  if (!paymentUrl) {
    throw new Error("paymentUrl is missing when sending approval email");
  }

  let fullPaymentUrl: string;
  if (paymentUrl.startsWith("http")) {
    fullPaymentUrl = paymentUrl;
  } else {
    const cleanPath = paymentUrl.startsWith("/")
      ? paymentUrl
      : `/${paymentUrl}`;
    fullPaymentUrl = `${baseUrl}${cleanPath}`;
  }

  console.log(
    "🔗 [EmailLib] Approval Email - Final Payment URL:",
    fullPaymentUrl
  );

  // ✅ NEW: Different email content for reservation vs full payment
  const paymentTypeText = isReservation
    ? `<strong style="color: #172a46;">$${paymentAmount} Reservation Payment</strong>`
    : `<strong style="color: #172a46;">Full Payment</strong>`;

  const explanationText = isReservation
    ? `Since your booking is for <strong>${numberOfNights} nights</strong>, we require a <strong>$${paymentAmount} reservation payment</strong> to secure your spot. The remaining <strong>$${(fullAmount || 0) - paymentAmount}</strong> will be due on your check-in day.`
    : `Please complete your full payment to secure your booking.`;

  const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <style>
      body {
        margin: 0;
        padding: 0;
        background: #e7e4df;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial,
          sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .container {
        padding: 32px 16px;
      }

      .card {
        max-width: 600px;
        margin: auto;
        background: #1f3a61;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #2b4a78;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }

      .header {
        padding: 40px 28px 28px;
        text-align: center;
        color: #ffffff;
      }
      .header h2 {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
      }
      .header p {
        margin: 8px 0 0;
        opacity: 0.85;
        font-size: 15px;
      }

      .content {
        padding: 32px 28px;
        color: #ffffff;
        line-height: 1.6;
      }

      .content p {
        margin-bottom: 18px;
        font-size: 15px;
        opacity: 0.92;
      }

      .payment-box {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 24px;
        border-radius: 10px;
        text-align: center;
        margin: 28px 0;
      }
      .payment-box .label {
        font-size: 13px;
        opacity: 0.7;
        margin-bottom: 6px;
      }
      .payment-box .amount {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 6px;
        color: #e7e4df;
      }
      .payment-box .network {
        font-size: 13px;
        opacity: 0.7;
      }

      ${isReservation ? `
      .info-box {
        background: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 10px;
        padding: 16px 20px;
        margin: 24px 0;
        color: #92400e;
      }
      .info-box strong {
        color: #78350f;
      }
      ` : ''}

      .cta-button {
        display: inline-block;
        background: #e7e4df;
        color: #1f3a61;
        padding: 14px 32px;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        font-size: 17px;
        margin: 24px auto 32px;
        transition: opacity 0.2s ease;
      }
      .cta-button:hover {
        opacity: 0.85;
      }

      .section-title {
        margin-top: 32px;
        margin-bottom: 12px;
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
      }

      .next-steps {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 20px 24px;
        border-radius: 10px;
      }
      .next-steps li {
        margin-bottom: 10px;
        font-size: 14px;
        color: #e7e4df;
        opacity: 0.9;
      }

      .url-box {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 14px;
        margin-top: 24px;
        border-radius: 8px;
        font-size: 12px;
        word-break: break-all;
        color: #c9ced6;
      }
      .url-box a {
        color: #e7e4df;
        text-decoration: none;
      }

      .footer {
        max-width: 600px;
        margin: 24px auto 0;
        text-align: center;
        font-size: 12px;
        color: #1f3a61;
        opacity: 0.7;
        line-height: 1.5;
      }
      .footer a {
        color: #1f3a61;
        text-decoration: underline;
      }
    </style>
  </head>

  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <h2>You're In, ${recipientName}!</h2>
          <p>Your stay application has been approved.</p>
        </div>

        <div class="content">
          <p>
            We're excited to welcome you to <strong>${stayTitle}</strong>. 
            ${explanationText}
          </p>

          ${isReservation ? `
          <div class="info-box">
            <strong>📋 Reservation System</strong><br/>
            <small>Your ${numberOfNights}-night booking requires a two-step payment:</small><br/>
            <strong>1. $${paymentAmount} Reservation (Now)</strong> - Secures your spot<br/>
            <strong>2. $${(fullAmount || 0) - paymentAmount} Remaining (Check-in)</strong> - Due on arrival<br/>
            <small style="margin-top: 8px; display: block;">We'll remind you before your check-in date!</small>
          </div>
          ` : ''}

          <div class="payment-box">
            <div class="label">${isReservation ? 'Reservation' : 'Total'} Amount Due</div>
            <div class="amount">$${paymentAmount} ${paymentToken}</div>
            <div class="network">Pay on ${chainName}</div>
          </div>

          <div style="text-align: center">
            <a href="${fullPaymentUrl}" class="cta-button">
              ${isReservation ? 'Pay Reservation' : 'Complete Payment'}
            </a>
          </div>

          <div class="section-title">What happens next?</div>
          <ul class="next-steps">
            ${isReservation ? `
            <li>Complete your $${paymentAmount} reservation payment now</li>
            <li>Your spot will be confirmed once payment succeeds</li>
            <li>Pay the remaining $${(fullAmount || 0) - paymentAmount} on your check-in day</li>
            <li>We'll send you a reminder before check-in</li>
            ` : `
            <li>Tap the button above to process your payment</li>
            <li>Your booking is confirmed once payment succeeds</li>
            <li>You'll receive your check-in details closer to arrival</li>
            `}
          </ul>

          <p style="margin-top: 28px; opacity: 0.7; font-size: 13px">
            Your ${isReservation ? 'reservation' : 'booking'} will be released if payment is not completed by
            <strong>${expiryString}</strong>.
          </p>

          <div class="url-box">
            <strong>Payment Link:</strong><br />
            <a href="${fullPaymentUrl}">${fullPaymentUrl}</a>
          </div>
        </div>
      </div>

      <div class="footer">
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p>
          Need help? Contact us at
          <a href="mailto:${supportEmail}">${supportEmail}</a>
        </p>
        <p>© ${new Date().getFullYear()} Decentralized Den</p>
      </div>
    </div>
  </body>
</html>
  `;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    console.log("[EmailLib] Approval email sent:", response);

    await logEmailToDb(
      recipientEmail,
      subject,
      response.data ? "booking_approved" : "booking_approved_failed",
      {
        bookingId,
        chainId,
        paymentUrl: fullPaymentUrl,
        isReservation,
        reservationAmount: isReservation ? paymentAmount : null,
        apiResponse: response,
        resendId: response.data?.id,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return true;
  } catch (error: any) {
    console.error("[EmailLib] Failed to send approval email:", error);
    await logEmailToDb(recipientEmail, subject, "booking_approved_failed", {
      bookingId,
      error: error?.message || error,
    });
    throw error;
  }
}

// ✅ NEW: Reservation Confirmed Email
interface ReservationConfirmedEmailProps {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  stayLocation: string;
  startDate: Date;
  endDate: Date;
  reservationAmount: number;
  reservationToken: PaymentToken;
  remainingAmount: number;
  txHash: string;
  chainId: number;
  numberOfNights: number;
}

export async function sendReservationConfirmedEmail(
  props: ReservationConfirmedEmailProps
) {
  const {
    recipientEmail,
    recipientName,
    stayTitle,
    stayLocation,
    startDate,
    endDate,
    bookingId,
    reservationAmount,
    reservationToken,
    remainingAmount,
    txHash,
    chainId,
    numberOfNights,
  } = props;

  const subject = `✅ Reservation Confirmed - ${stayTitle}`;
  const explorerUrl = getExplorerUrl(chainId, txHash);
  const chainName = getChainDisplayName(chainId);

  const dateRange = `${startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })} - ${endDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const dashboardUrl = `${baseUrl}/dashboard`;

  const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <style>
      body {
        margin: 0;
        padding: 0;
        background: #e7e4df;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial,
          sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .container {
        padding: 32px 16px;
      }

      .card {
        max-width: 600px;
        margin: auto;
        background: #1f3a61;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #2b4a78;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }

      .header {
        padding: 40px 28px 28px;
        text-align: center;
        color: #ffffff;
      }
      .header h2 {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
      }
      .header p {
        margin: 8px 0 0;
        opacity: 0.85;
        font-size: 15px;
      }

      .content {
        padding: 32px 28px;
        color: #ffffff;
        line-height: 1.6;
      }
      .content p {
        margin-bottom: 18px;
        opacity: 0.92;
        font-size: 15px;
      }

      .success-box {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 24px;
        border-radius: 10px;
        margin: 28px 0;
        text-align: center;
      }
      .success-box strong {
        display: block;
        color: #e7e4df;
        font-size: 18px;
        margin-bottom: 8px;
        font-weight: 600;
      }

      .warning-box {
        background: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 10px;
        padding: 20px;
        margin: 24px 0;
        color: #92400e;
      }
      .warning-box strong {
        color: #78350f;
        font-size: 18px;
        display: block;
        margin-bottom: 8px;
      }

      .details-box {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 20px;
        border-radius: 10px;
        margin: 24px 0;
      }
      .details-row {
        margin-bottom: 12px;
      }
      .details-row:last-child {
        margin: 0;
      }
      .label {
        font-size: 13px;
        opacity: 0.65;
        margin-bottom: 2px;
      }
      .value {
        font-size: 15px;
        font-weight: 600;
        color: #e7e4df;
      }

      .cta-button {
        display: inline-block;
        background: #e7e4df;
        color: #1f3a61;
        padding: 14px 32px;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        font-size: 17px;
        margin: 24px auto 32px;
      }

      .footer {
        max-width: 600px;
        margin: 24px auto 0;
        text-align: center;
        font-size: 12px;
        color: #1f3a61;
        opacity: 0.7;
        line-height: 1.5;
      }
      .footer a {
        color: #1f3a61;
        text-decoration: underline;
      }
    </style>
  </head>

  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <h2>🎉 Reservation Confirmed!</h2>
          <p>Your spot is secured.</p>
        </div>

        <div class="content">
          <p>Hi ${recipientName},</p>
          <p>
            We've successfully received your <strong>$${reservationAmount} ${reservationToken}</strong> reservation payment for
            <strong>${stayTitle}</strong>. Your spot is now secured!
          </p>

          <div class="success-box">
            <strong>✅ Reservation Paid</strong>
            You're all set for your ${numberOfNights}-night stay.
          </div>

          <div class="warning-box">
            <strong>💰 Remaining Payment Required</strong>
            <p style="margin: 8px 0 0; font-size: 15px;">
              You'll need to pay the remaining <strong>$${remainingAmount}</strong> on your check-in day 
              (${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}).
            </p>
            <p style="margin: 12px 0 0; font-size: 13px; opacity: 0.8;">
              📧 We'll send you a reminder email before your check-in date with a payment link.
            </p>
          </div>

          <div class="details-box">
            <div class="details-row">
              <div class="label">Stay</div>
              <div class="value">${stayTitle}</div>
            </div>
            <div class="details-row">
              <div class="label">Location</div>
              <div class="value">${stayLocation}</div>
            </div>
            <div class="details-row">
              <div class="label">Dates</div>
              <div class="value">${dateRange}</div>
            </div>
            <div class="details-row">
              <div class="label">Duration</div>
              <div class="value">${numberOfNights} nights</div>
            </div>
            <div class="details-row">
              <div class="label">Booking ID</div>
              <div class="value">${bookingId}</div>
            </div>
            <div class="details-row">
              <div class="label">Reservation Paid</div>
              <div class="value">$${reservationAmount} ${reservationToken}</div>
            </div>
            <div class="details-row">
              <div class="label">Remaining Due</div>
              <div class="value">$${remainingAmount}</div>
            </div>
            <div class="details-row">
              <div class="label">Transaction</div>
              <div class="value">
                <a href="${explorerUrl}" style="color:#e7e4df; text-decoration:none;">
                  ${txHash.slice(0, 10)}...${txHash.slice(-8)}
                </a>
              </div>
            </div>
          </div>

          <div style="text-align:center;">
            <a href="${dashboardUrl}" class="cta-button">View Dashboard</a>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
        <p>© ${new Date().getFullYear()} Decentralized Den</p>
      </div>
    </div>
  </body>
</html>
`;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
    });

    console.log("[EmailLib] Reservation confirmation email sent:", response);

    await logEmailToDb(
      recipientEmail,
      subject,
      response.data
        ? "reservation_confirmed"
        : "reservation_confirmed_failed",
      {
        bookingId,
        reservationAmount,
        remainingAmount,
        txHash,
        chainId,
        apiResponse: response,
        resendId: response.data?.id,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return true;
  } catch (error: any) {
    console.error(
      "[EmailLib] Failed to send reservation confirmation email:",
      error
    );
    await logEmailToDb(
      recipientEmail,
      subject,
      "reservation_confirmed_failed",
      {
        bookingId,
        error: error?.message || error,
      }
    );
    throw error;
  }
}

// ✅ NEW: Remaining Payment Reminder Email
interface RemainingPaymentReminderProps {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  checkInDate: Date;
  remainingAmount: number;
  paymentUrl: string;
}

export async function sendRemainingPaymentReminder(
  props: RemainingPaymentReminderProps
) {
  const {
    recipientEmail,
    recipientName,
    bookingId,
    stayTitle,
    checkInDate,
    remainingAmount,
    paymentUrl,
  } = props;

  const subject = `⏰ Remaining Payment Due - ${stayTitle}`;

  let fullPaymentUrl: string;
  if (paymentUrl.startsWith("http")) {
    fullPaymentUrl = paymentUrl;
  } else {
    const cleanPath = paymentUrl.startsWith("/")
      ? paymentUrl
      : `/${paymentUrl}`;
    fullPaymentUrl = `${baseUrl}${cleanPath}`;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <style>
      body {
        margin: 0;
        padding: 0;
        background: #e7e4df;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial,
          sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .container {
        padding: 32px 16px;
      }

      .card {
        max-width: 600px;
        margin: auto;
        background: #1f3a61;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #2b4a78;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }

      .header {
        padding: 40px 28px 28px;
        text-align: center;
        color: #ffffff;
      }
      .header h2 {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
      }

      .content {
        padding: 32px 28px;
        color: #ffffff;
        line-height: 1.6;
      }

      .payment-box {
        background: #fef3c7;
        border: 2px solid #f59e0b;
        padding: 24px;
        border-radius: 10px;
        text-align: center;
        margin: 28px 0;
        color: #78350f;
      }
      .payment-box .amount {
        font-size: 32px;
        font-weight: 700;
        margin: 12px 0;
        color: #92400e;
      }

      .cta-button {
        display: inline-block;
        background: #e7e4df;
        color: #1f3a61;
        padding: 14px 32px;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        font-size: 17px;
        margin: 24px auto 32px;
      }

      .footer {
        max-width: 600px;
        margin: 24px auto 0;
        text-align: center;
        font-size: 12px;
        color: #1f3a61;
        opacity: 0.7;
        line-height: 1.5;
      }
    </style>
  </head>

  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <h2>⏰ Time to Complete Your Payment</h2>
        </div>

        <div class="content">
          <p>Hi ${recipientName},</p>
          <p>
            Your check-in date for <strong>${stayTitle}</strong> is 
            <strong>${checkInDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}</strong>.
          </p>

          <div class="payment-box">
            <strong>💰 Remaining Payment Due</strong>
            <div class="amount">$${remainingAmount}</div>
            <p style="margin: 8px 0 0; font-size: 14px;">
              Please complete this payment to finalize your booking.
            </p>
          </div>

          <div style="text-align: center">
            <a href="${fullPaymentUrl}" class="cta-button">
              Pay Remaining Amount
            </a>
          </div>

          <p style="margin-top: 24px; opacity: 0.8; font-size: 14px;">
            🔒 Your reservation is already secured. This payment completes your booking.
          </p>
        </div>
      </div>

      <div class="footer">
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
        <p>© ${new Date().getFullYear()} Decentralized Den</p>
      </div>
    </div>
  </body>
</html>
`;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    console.log("[EmailLib] Remaining payment reminder sent:", response);

    await logEmailToDb(
      recipientEmail,
      subject,
      response.data
        ? "remaining_payment_reminder"
        : "remaining_payment_reminder_failed",
      {
        bookingId,
        remainingAmount,
        checkInDate: checkInDate.toISOString(),
        paymentUrl: fullPaymentUrl,
        apiResponse: response,
        resendId: response.data?.id,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return true;
  } catch (error: any) {
    console.error(
      "[EmailLib] Failed to send remaining payment reminder:",
      error
    );
    await logEmailToDb(
      recipientEmail,
      subject,
      "remaining_payment_reminder_failed",
      {
        bookingId,
        error: error?.message || error,
      }
    );
    throw error;
  }
}

// --- Email Template: Payment Confirmed (FULL PAYMENT - existing template) ---
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
    stayLocation,
    startDate,
    endDate,
    bookingId,
    paidAmount,
    paidToken,
    txHash,
    chainId,
  } = props;

  const subject = `✅ Payment Confirmed - ${stayTitle}`;
  const explorerUrl = getExplorerUrl(chainId, txHash);
  const chainName = getChainDisplayName(chainId);

  const dateRange = `${startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })} - ${endDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const dashboardUrl = `${baseUrl}/dashboard`;

  console.log("[EmailLib] Confirmation Email - Dashboard URL:", dashboardUrl);

  const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <style>
      body {
        margin: 0;
        padding: 0;
        background: #e7e4df;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial,
          sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .container {
        padding: 32px 16px;
      }

      .card {
        max-width: 600px;
        margin: auto;
        background: #1f3a61;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #2b4a78;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }

      .header {
        padding: 40px 28px 28px;
        text-align: center;
        color: #ffffff;
      }
      .header h2 {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
      }
      .header p {
        margin: 8px 0 0;
        opacity: 0.85;
        font-size: 15px;
      }

      .content {
        padding: 32px 28px;
        color: #ffffff;
        line-height: 1.6;
      }
      .content p {
        margin-bottom: 18px;
        opacity: 0.92;
        font-size: 15px;
      }

      .success-box {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 24px;
        border-radius: 10px;
        margin: 28px 0;
        text-align: center;
      }
      .success-box strong {
        display: block;
        color: #e7e4df;
        font-size: 18px;
        margin-bottom: 8px;
        font-weight: 600;
      }

      .details-box {
        background: #162945;
        border: 1px solid #2b4a78;
        padding: 20px;
        border-radius: 10px;
        margin: 24px 0;
      }
      .details-row {
        margin-bottom: 12px;
      }
      .details-row:last-child {
        margin: 0;
      }
      .label {
        font-size: 13px;
        opacity: 0.65;
        margin-bottom: 2px;
      }
      .value {
        font-size: 15px;
        font-weight: 600;
        color: #e7e4df;
      }

      .cta-button {
        display: inline-block;
        background: #e7e4df;
        color: #1f3a61;
        padding: 14px 32px;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        font-size: 17px;
        margin: 24px auto 32px;
      }

      .footer {
        max-width: 600px;
        margin: 24px auto 0;
        text-align: center;
        font-size: 12px;
        color: #1f3a61;
        opacity: 0.7;
        line-height: 1.5;
      }
      .footer a {
        color: #1f3a61;
        text-decoration: underline;
      }
    </style>
  </head>

  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <h2>Payment Confirmed</h2>
          <p>Your booking is now secured.</p>
        </div>

        <div class="content">
          <p>Hi ${recipientName},</p>
          <p>
            We've successfully received your payment for
            <strong>${stayTitle}</strong>. Your stay is now fully confirmed.
          </p>

          <div class="success-box">
            <strong>Booking Confirmed</strong>
            You're all set for your upcoming stay.
          </div>

          <div class="details-box">
            <div class="details-row">
              <div class="label">Stay</div>
              <div class="value">${stayTitle}</div>
            </div>
            <div class="details-row">
              <div class="label">Location</div>
              <div class="value">${stayLocation}</div>
            </div>
            <div class="details-row">
              <div class="label">Dates</div>
              <div class="value">${dateRange}</div>
            </div>
            <div class="details-row">
              <div class="label">Booking ID</div>
              <div class="value">${bookingId}</div>
            </div>
            <div class="details-row">
              <div class="label">Amount Paid</div>
              <div class="value">$${paidAmount} ${paidToken}</div>
            </div>
            <div class="details-row">
              <div class="label">Transaction</div>
              <div class="value">
                <a href="${explorerUrl}" style="color:#e7e4df; text-decoration:none;">
                  ${txHash.slice(0, 10)}...${txHash.slice(-8)}
                </a>
              </div>
            </div>
          </div>

          <div style="text-align:center;">
            <a href="${dashboardUrl}" class="cta-button">View Dashboard</a>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
        <p>© ${new Date().getFullYear()} Decentralized Den</p>
      </div>
    </div>
  </body>
</html>
`;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
    });

    console.log("[EmailLib] Confirmation email sent:", response);

    await logEmailToDb(
      recipientEmail,
      subject,
      response.data ? "payment_confirmed" : "payment_confirmed_failed",
      {
        bookingId,
        txHash,
        chainId,
        apiResponse: response,
        resendId: response.data?.id,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return true;
  } catch (error: any) {
    console.error("[EmailLib] Failed to send confirmation email:", error);
    await logEmailToDb(recipientEmail, subject, "payment_confirmed_failed", {
      bookingId,
      txHash,
      chainId,
      error: error?.message || error,
    });
    throw error;
  }
}

// --- Email Template: Payment Failed ---
interface PaymentFailedEmailProps {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  reason: string;
}

export async function sendPaymentFailedEmail(props: PaymentFailedEmailProps) {
  const { recipientEmail, recipientName, bookingId, stayTitle, reason } = props;

  const subject = `Payment Issue - ${stayTitle}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    body {
      margin: 0;
      padding: 0;
      background: #e7e4df;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial,
        sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      padding: 32px 16px;
    }

    .card {
      max-width: 600px;
      margin: auto;
      background: #1f3a61;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #2b4a78;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .header {
      padding: 40px 28px 28px;
      text-align: center;
      color: white;
    }

    .header h2 {
      margin: 0;
      font-size: 26px;
      font-weight: 600;
    }

    .header p {
      margin-top: 6px;
      font-size: 14px;
      opacity: 0.85;
    }

    .content {
      padding: 32px 28px;
      color: #ffffff;
      line-height: 1.6;
    }

    .error-box {
      background: #162945;
      border-left: 4px solid #eab308;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      color: #e7e4df;
      font-size: 14px;
    }

    .footer {
      text-align: center;
      margin-top: 24px;
      color: #1f3a61;
      opacity: 0.7;
      font-size: 12px;
    }

    .footer a {
      color: #1f3a61;
      text-decoration: underline;
    }
  </style>
</head>

<body>
  <div class="container">
    <div class="card">

      <div class="header">
        <h2>Payment Unsuccessful</h2>
        <p>There was an issue with your transaction.</p>
      </div>

      <div class="content">
        <p>Hi ${recipientName},</p>

        <p>
          Your payment attempt for <strong>${stayTitle}</strong> was not completed.
          Please review the details below.
        </p>

        <div class="error-box">
          <strong>Reason:</strong> ${reason}
        </div>

        <p>
          If the issue persists, contact our support team with your booking ID:
          <strong>${bookingId}</strong>.
        </p>

        <p>
          Email: 
          <a href="mailto:${supportEmail}" style="color:#e7e4df;">
            ${supportEmail}
          </a>
        </p>
      </div>

    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Decentralized Den</p>
    </div>
  </div>
</body>
</html>
`;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    await logEmailToDb(recipientEmail, subject, "payment_failed", {
      bookingId,
      reason,
      resendId: response.data?.id,
    });

    return true;
  } catch (error: any) {
    console.error("[EmailLib] Failed to send payment failed email:", error);
    return false;
  }
}