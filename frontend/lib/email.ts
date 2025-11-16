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
  // Production: Use NEXT_PUBLIC_APP_URL or Vercel URL
  if (process.env.NODE_ENV === "production") {
    const url =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "https://deden.space"; // Final production fallback

    const cleanUrl = url.replace(/\/$/, "");
    console.log("[EmailLib] Using PRODUCTION base URL:", cleanUrl);
    return cleanUrl;
  }

  // Development: Use localhost or NEXTAUTH_URL
  const url =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"; // Development fallback

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
  } = props;

  const subject = `🎉 Application Approved - ${stayTitle}`;
  const expiryString = expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const chainName = chainId
    ? getChainDisplayName(chainId)
    : "your preferred network";

  // ✅ FIXED: Proper URL construction with validation
  if (!paymentUrl) {
    throw new Error("paymentUrl is missing when sending approval email");
  }

  // If already absolute → do NOT prefix baseURL
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

      /* HEADER */
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

      /* CONTENT */
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

      /* PAYMENT BOX */
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

      /* CTA BUTTON */
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

      /* NEXT STEPS */
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

      /* LINK BOX */
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

      /* FOOTER */
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
        <!-- HEADER -->
        <div class="header">
          <h2>You're In, ${recipientName}!</h2>
          <p>Your stay application has been approved.</p>
        </div>

        <!-- CONTENT -->
        <div class="content">
          <p>
            We're excited to welcome you to <strong>${stayTitle}</strong>. To
            secure your spot, please complete your payment before
            <strong>${expiryString}</strong>.
          </p>

          <!-- PAYMENT -->
          <div class="payment-box">
            <div class="label">Amount Due</div>
            <div class="amount">${paymentAmount} ${paymentToken}</div>
            <div class="network">Pay on ${chainName}</div>
          </div>

          <!-- CTA -->
          <div style="text-align: center">
            <a href="${fullPaymentUrl}" class="cta-button">
              Complete Payment
            </a>
          </div>

          <!-- NEXT STEPS -->
          <div class="section-title">What happens next?</div>
          <ul class="next-steps">
            <li>Tap the button above to process your payment</li>
            <li>Your booking is confirmed once payment succeeds</li>
            <li>You'll receive your check-in details closer to arrival</li>
          </ul>

          <!-- SAFETY NOTE -->
          <p style="margin-top: 28px; opacity: 0.7; font-size: 13px">
            Your reservation will be released if payment is not completed by
            <strong>${expiryString}</strong>.
          </p>

          <!-- LINK BOX -->
          <div class="url-box">
            <strong>Payment Link:</strong><br />
            <a href="${fullPaymentUrl}">${fullPaymentUrl}</a>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
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

  // ✅ FIXED: Use baseUrl for dashboard link
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

      /* HEADER */
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

      /* CONTENT */
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

      /* CONFIRMATION BOX */
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

      /* DETAILS */
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

      /* CTA */
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

      /* FOOTER */
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
        <!-- HEADER -->
        <div class="header">
          <h2>Payment Confirmed</h2>
          <p>Your booking is now secured.</p>
        </div>

        <!-- CONTENT -->
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
