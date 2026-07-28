import { Resend } from "resend";
import { db } from "@/lib/database";
import { PaymentToken } from "@prisma/client";
import { chainConfig } from "@/lib/config";
import { renderEmailShell, ctaButton, amountCard, detailsCard, calloutBox, stepList, ticketNote } from "@/lib/email-template";

// Initialize the Resend client
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in .env");
}
const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = "DeDen <bookings@deden.space>";
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

  const remainingDue = (fullAmount || 0) - paymentAmount;

  const explanationText = isReservation
    ? `Since your booking is for <strong>${numberOfNights} nights</strong>, we require a <strong>$${paymentAmount} reservation payment</strong> to secure your spot. The remaining <strong>$${remainingDue}</strong> will be due on your check-in day.`
    : `Please complete your full payment to secure your booking.`;

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      We're excited to welcome you to <strong>${stayTitle}</strong>. ${explanationText}
    </p>

    ${isReservation ? calloutBox({
      tone: "warning",
      title: "Two-step payment",
      bodyHtml: `Your ${numberOfNights}-night booking is split into two payments:<br/>
        <strong>1. $${paymentAmount} reservation</strong> — due now, secures your spot<br/>
        <strong>2. $${remainingDue} remaining</strong> — due on check-in<br/>
        We'll email you a reminder before check-in.`,
    }) : ""}

    ${amountCard({
      label: isReservation ? "Reservation amount due" : "Total amount due",
      amount: `$${paymentAmount} ${paymentToken}`,
      sublabel: `Pay on ${chainName}`,
    })}

    ${ctaButton(fullPaymentUrl, isReservation ? "Pay Reservation" : "Complete Payment")}

    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:${"#6B7060"}; margin:32px 0 4px;">What happens next</div>
    ${stepList(
      isReservation
        ? [
            `Complete your $${paymentAmount} reservation payment now`,
            "Your spot is confirmed the moment payment succeeds",
            `Pay the remaining $${remainingDue} on your check-in day`,
            "We'll send a reminder before check-in",
          ]
        : [
            "Tap the button above to process your payment",
            "Your booking is confirmed once payment succeeds",
            "You'll receive check-in details closer to arrival",
          ]
    )}

    <p style="font-size:13px; color:#6B7060; margin-top:24px;">
      Your ${isReservation ? "reservation" : "booking"} will be released if payment isn't completed by <strong>${expiryString}</strong>.
    </p>
  `;

  const htmlBody = renderEmailShell({
    preheader: `Your application for ${stayTitle} was approved — complete payment to confirm your spot.`,
    eyebrow: "Application Approved",
    title: `You're in, ${recipientName}!`,
    subtitle: "Complete your payment to secure your spot.",
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

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

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      We've successfully received your <strong>$${reservationAmount} ${reservationToken}</strong> reservation payment for
      <strong>${stayTitle}</strong>. Your spot is now secured!
    </p>

    ${calloutBox({
      tone: "success",
      title: "Reservation paid",
      bodyHtml: `You're all set for your ${numberOfNights}-night stay.`,
    })}

    ${calloutBox({
      tone: "warning",
      title: "Remaining payment required",
      bodyHtml: `You'll pay the remaining <strong>$${remainingAmount}</strong> on your check-in day (${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}). We'll email you a reminder beforehand.`,
    })}

    ${detailsCard([
      { label: "Stay", value: stayTitle },
      { label: "Location", value: stayLocation },
      { label: "Dates", value: dateRange },
      { label: "Duration", value: `${numberOfNights} nights` },
      { label: "Reservation paid", value: `$${reservationAmount} ${reservationToken}` },
      { label: "Remaining due", value: `$${remainingAmount}` },
      { label: "Transaction", value: `${txHash.slice(0, 10)}...${txHash.slice(-8)}`, href: explorerUrl },
    ])}

    ${ctaButton(dashboardUrl, "View Dashboard")}
  `;

  const htmlBody = renderEmailShell({
    preheader: `Your reservation for ${stayTitle} is confirmed.`,
    eyebrow: "Reservation Confirmed",
    title: "Your spot is secured!",
    subtitle: `Hi ${recipientName}`,
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

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

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      Your check-in date for <strong>${stayTitle}</strong> is
      <strong>${checkInDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
    </p>

    ${amountCard({ label: "Remaining payment due", amount: `$${remainingAmount}` })}

    ${ctaButton(fullPaymentUrl, "Pay Remaining Amount")}

    <p style="font-size:13px; color:#6B7060; margin-top:24px; text-align:center;">
      Your reservation is already secured — this payment completes your booking.
    </p>
  `;

  const htmlBody = renderEmailShell({
    preheader: `Your remaining payment for ${stayTitle} is due.`,
    eyebrow: "Payment Due",
    title: "Time to complete your payment",
    subtitle: `Hi ${recipientName}`,
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

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
interface ConfirmationEmailTicket {
  ticketCode: string;
  guestName: string;
  pdfBase64: string;
}

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
  tickets?: ConfirmationEmailTicket[];
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
    tickets,
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

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      We've successfully received your payment for <strong>${stayTitle}</strong>. Your stay is now fully confirmed.
    </p>

    ${calloutBox({
      tone: "success",
      title: "Booking confirmed",
      bodyHtml: "You're all set for your upcoming stay.",
    })}

    ${detailsCard([
      { label: "Stay", value: stayTitle },
      { label: "Location", value: stayLocation },
      { label: "Dates", value: dateRange },
      { label: "Amount paid", value: `$${paidAmount} ${paidToken}` },
      { label: "Transaction", value: `${txHash.slice(0, 10)}...${txHash.slice(-8)}`, href: explorerUrl },
    ])}

    ${tickets && tickets.length > 0 ? ticketNote(tickets) : ""}

    ${ctaButton(dashboardUrl, "View Dashboard")}
  `;

  const htmlBody = renderEmailShell({
    preheader: `Your payment for ${stayTitle} is confirmed.`,
    eyebrow: "Payment Confirmed",
    title: "You're all set!",
    subtitle: `Hi ${recipientName}`,
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
      attachments: (tickets || []).map((t) => ({
        filename: `${t.ticketCode}.pdf`,
        content: t.pdfBase64,
      })),
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

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      Your payment attempt for <strong>${stayTitle}</strong> was not completed. Please review the details below.
    </p>

    ${calloutBox({ tone: "error", title: "Reason", bodyHtml: reason })}

    <p style="margin-top:24px;">
      If the issue persists, contact our support team with your booking ID above.
    </p>
  `;

  const htmlBody = renderEmailShell({
    preheader: `There was an issue with your payment for ${stayTitle}.`,
    eyebrow: "Payment Issue",
    title: "Payment unsuccessful",
    subtitle: `Hi ${recipientName}`,
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

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


// File: lib/email.ts
// ✅ NEW: Add payment expiry email function

export async function sendPaymentExpiryEmail(props: {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  wasReservation: boolean;
}) {
  const { recipientEmail, recipientName, bookingId, stayTitle, wasReservation } = props;

  const subject = `⌛ Payment Expired - ${stayTitle}`;
  const reapplyUrl = `${baseUrl}/stay/${bookingId.split('-')[0]}/apply`;

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      Your ${wasReservation ? "reservation" : "payment"} window for <strong>${stayTitle}</strong> has expired.
    </p>

    ${calloutBox({
      tone: "warning",
      title: "Your spot was released",
      bodyHtml: "Since payment wasn't received in time, your booking was canceled and the spot released for other guests.",
    })}

    <p style="margin-top:24px;">
      <strong>Want to try again?</strong><br/>
      If you're still interested, you can submit a new application below.
    </p>

    ${ctaButton(reapplyUrl, "Reapply for This Stay")}

    <p style="font-size:13px; color:#6B7060; margin-top:24px; text-align:center;">
      Tip: complete payment within the time window after approval to secure your spot.
    </p>
  `;

  const htmlBody = renderEmailShell({
    preheader: `Your payment window for ${stayTitle} has expired.`,
    eyebrow: "Payment Expired",
    title: "Payment window expired",
    subtitle: `Hi ${recipientName}`,
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    console.log("[EmailLib] Payment expiry email sent:", response);

    await logEmailToDb(
      recipientEmail,
      subject,
      response.data ? "payment_expired" : "payment_expired_failed",
      {
        bookingId,
        wasReservation,
        apiResponse: response,
        resendId: response.data?.id,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return true;
  } catch (error: any) {
    console.error("[EmailLib] Failed to send payment expiry email:", error);
    await logEmailToDb(recipientEmail, subject, "payment_expired_failed", {
      bookingId,
      error: error?.message || error,
    });
    throw error;
  }
}

// --- Email Template: Refund Processed ---
export async function sendRefundConfirmedEmail(props: {
  recipientEmail: string;
  recipientName: string;
  bookingId: string;
  stayTitle: string;
  amount: number;
  token: string;
  reason?: string;
}) {
  const { recipientEmail, recipientName, bookingId, stayTitle, amount, token, reason } = props;

  const subject = `Refund Processed - ${stayTitle}`;

  const bodyHtml = `
    <p style="margin:0 0 18px;">
      Your booking for <strong>${stayTitle}</strong> has been refunded.
    </p>

    ${amountCard({ label: "Refund amount", amount: `$${amount} ${token}` })}

    ${reason ? calloutBox({ tone: "info", title: "Reason", bodyHtml: reason }) : ""}

    <p style="margin-top:24px;">
      Refunds are sent manually by our team — if you don't see the funds within a few business days, contact support with your booking ID above.
    </p>
  `;

  const htmlBody = renderEmailShell({
    preheader: `Your refund for ${stayTitle} has been processed.`,
    eyebrow: "Refund Processed",
    title: "Refund confirmed",
    subtitle: `Hi ${recipientName}`,
    bodyHtml,
    bookingId,
    supportEmail,
    year: new Date().getFullYear(),
  });

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    await logEmailToDb(recipientEmail, subject, response.data ? "refund_confirmed" : "refund_confirmed_failed", {
      bookingId,
      amount,
      token,
      resendId: response.data?.id,
    });

    if (response.error) throw response.error;
    return true;
  } catch (error: any) {
    console.error("[EmailLib] Failed to send refund confirmed email:", error);
    await logEmailToDb(recipientEmail, subject, "refund_confirmed_failed", {
      bookingId,
      error: error?.message || error,
    });
    return false;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Email: Contact form submission -> internal notification to the team ---
export async function sendContactNotification(props: {
  name: string;
  email: string;
  message: string;
}) {
  const { name, email, message } = props;
  const subject = `New contact form message from ${name}`;

  const bodyHtml = `
    <p style="margin:0 0 18px;">Someone submitted the contact form on deden.space.</p>
    ${detailsCard([
      { label: "Name", value: escapeHtml(name) },
      { label: "Email", value: escapeHtml(email) },
    ])}
    ${calloutBox({ tone: "info", title: "Message", bodyHtml: escapeHtml(message).replace(/\n/g, "<br/>") })}
  `;

  const htmlBody = renderEmailShell({
    preheader: `New contact form message from ${name}`,
    eyebrow: "Contact Form",
    title: "New message",
    subtitle: undefined,
    bodyHtml,
    supportEmail,
    year: new Date().getFullYear(),
  });

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: supportEmail,
      replyTo: email,
      subject,
      html: htmlBody,
    });

    await logEmailToDb(supportEmail, subject, response.data ? "contact_submission" : "contact_submission_failed", {
      name,
      email,
      resendId: response.data?.id,
    });

    if (response.error) throw response.error;
    return true;
  } catch (error: any) {
    console.error("[EmailLib] Failed to send contact notification:", error);
    await logEmailToDb(supportEmail, subject, "contact_submission_failed", {
      name,
      email,
      error: error?.message || error,
    });
    return false;
  }
}