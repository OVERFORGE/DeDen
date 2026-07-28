// File: lib/email-template.ts
// Shared transactional-email design system. Deliberately plain/corporate
// (white background, thin borders, a small status ribbon, one accent color)
// rather than the site's full cream/olive branding — booking confirmations
// read better as a clean voucher/receipt than as a marketing page.

export const brand = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  border: "#E3E6EA",
  panel: "#F8F9FA",
  accent: "#3D4331",
  accentText: "#FFFFFF",
  textDark: "#1F2328",
  textMuted: "#6A7178",
  divider: "#E3E6EA",
  warnBg: "#FFF6E5",
  warnBorder: "#E3A008",
  warnText: "#7A5300",
  errorBg: "#FDECEC",
  errorBorder: "#D33B3B",
  errorText: "#8A1F1F",
  successBg: "#EAF6EC",
  successBorder: "#2E9E44",
  successText: "#1E6B2E",
};

const fontSans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

export interface EmailShellOptions {
  preheader?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  bookingId?: string;
  supportEmail: string;
  year: number;
}

export function renderEmailShell(opts: EmailShellOptions): string {
  const { preheader, eyebrow, title, subtitle, bodyHtml, bookingId, supportEmail, year } = opts;

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 0; background: ${brand.bg}; -webkit-font-smoothing: antialiased; }
      a { color: inherit; }
      @media (max-width: 620px) {
        .email-card { border-radius: 0 !important; }
        .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:${brand.bg}; font-family:${fontSans};">
    ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px;">
            <!-- Wordmark -->
            <tr>
              <td style="padding: 4px 4px 20px;">
                <span style="font-family:${fontSans}; font-size:16px; font-weight:800; letter-spacing:0.5px; color:${brand.textDark};">DeDen</span>
              </td>
            </tr>
          </table>

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-card" style="width:100%; max-width:600px; background:${brand.card}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
            <!-- Header -->
            <tr>
              <td class="email-pad" style="padding:28px 32px 20px;">
                ${eyebrow ? `<div style="display:inline-block; font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:${brand.successText}; background:${brand.successBg}; border:1px solid ${brand.successBorder}; padding:4px 12px; border-radius:4px; margin-bottom:14px;">${eyebrow}</div>` : ""}
                <div style="font-family:${fontSans}; font-size:20px; font-weight:700; color:${brand.textDark}; line-height:1.3;">
                  ${title}
                </div>
                ${subtitle ? `<div style="margin-top:4px; font-family:${fontSans}; font-size:14px; color:${brand.textMuted};">${subtitle}</div>` : ""}
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td class="email-pad" style="padding:4px 32px 8px; font-family:${fontSans}; font-size:14px; line-height:1.6; color:${brand.textDark};">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Footer (inside card) -->
            <tr>
              <td class="email-pad" style="padding:24px 32px 28px;">
                <div style="height:1px; background:${brand.divider}; margin-bottom:20px;"></div>
                ${bookingId ? `<div style="font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:${brand.textMuted}; margin-bottom:4px;">Booking ID</div><div style="font-family:${fontSans}; font-size:13px; color:${brand.textDark}; margin-bottom:16px; font-weight:600;">${bookingId}</div>` : ""}
                <div style="font-family:${fontSans}; font-size:12px; color:${brand.textMuted};">
                  Need help? Write to
                  <a href="mailto:${supportEmail}" style="color:${brand.textDark}; font-weight:600; text-decoration:underline;">${supportEmail}</a>
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:600px; margin-top:16px; text-align:center; font-family:${fontSans}; font-size:11px; color:${brand.textMuted};">
            © ${year} DeDen. This is an automated email — please do not reply directly.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td align="center" style="border-radius:6px; background:${brand.accent};">
      <a href="${href}" style="display:inline-block; padding:12px 28px; font-family:${fontSans}; font-size:14px; font-weight:700; color:${brand.accentText}; text-decoration:none; border-radius:6px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function amountCard(opts: { label: string; amount: string; sublabel?: string }): string {
  return `
<div style="background:${brand.panel}; border:1px solid ${brand.border}; border-radius:6px; padding:20px; text-align:center; margin:20px 0;">
  <div style="font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:${brand.textMuted}; margin-bottom:6px;">${opts.label}</div>
  <div style="font-family:${fontSans}; font-size:30px; font-weight:800; color:${brand.textDark};">${opts.amount}</div>
  ${opts.sublabel ? `<div style="font-family:${fontSans}; font-size:12px; color:${brand.textMuted}; margin-top:4px;">${opts.sublabel}</div>` : ""}
</div>`;
}

export interface DetailRow {
  label: string;
  value: string;
  href?: string;
}

export function detailsCard(rows: DetailRow[]): string {
  const rowsHtml = rows
    .map(
      (row, i) => `
    <tr>
      <td style="padding: ${i === 0 ? "14px" : "14px"} 16px 0 16px; font-family:${fontSans}; border-top: ${i === 0 ? "none" : `1px solid ${brand.divider}`};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:12px; color:${brand.textMuted}; padding-bottom:14px;">${row.label}</td>
          <td align="right" style="font-size:13px; font-weight:600; color:${brand.textDark}; padding-bottom:14px;">
            ${row.href ? `<a href="${row.href}" style="color:${brand.textDark}; text-decoration:underline;">${row.value}</a>` : row.value}
          </td>
        </tr></table>
      </td>
    </tr>`
    )
    .join("");

  return `
<div style="background:${brand.panel}; border:1px solid ${brand.border}; border-radius:6px; margin:20px 0; overflow:hidden;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
</div>`;
}

type CalloutTone = "info" | "warning" | "success" | "error";

export function calloutBox(opts: { tone: CalloutTone; title: string; bodyHtml: string }): string {
  const tones: Record<CalloutTone, { bg: string; border: string; text: string }> = {
    info: { bg: brand.panel, border: brand.border, text: brand.textDark },
    warning: { bg: brand.warnBg, border: brand.warnBorder, text: brand.warnText },
    success: { bg: brand.successBg, border: brand.successBorder, text: brand.successText },
    error: { bg: brand.errorBg, border: brand.errorBorder, text: brand.errorText },
  };
  const t = tones[opts.tone];

  return `
<div style="background:${t.bg}; border-left:3px solid ${t.border}; border-radius:4px; padding:14px 18px; margin:20px 0;">
  <div style="font-family:${fontSans}; font-size:13px; font-weight:700; color:${t.text}; margin-bottom:4px;">${opts.title}</div>
  <div style="font-family:${fontSans}; font-size:13px; color:${t.text}; opacity:0.92; line-height:1.5;">${opts.bodyHtml}</div>
</div>`;
}

// Tickets are sent as PDF attachments (see lib/ticket-service.ts::renderTicketPdf),
// not embedded inline — this is just a short text note pointing at them.
export interface TicketSectionItem {
  ticketCode: string;
  guestName: string;
}

export function ticketNote(tickets: TicketSectionItem[]): string {
  const rows = tickets
    .map(
      (t) => `
    <tr>
      <td style="padding:10px 16px; font-family:${fontSans}; border-top:1px solid ${brand.divider};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px; font-weight:600; color:${brand.textDark};">${t.guestName || "Guest"}</td>
          <td align="right" style="font-size:12px; color:${brand.textMuted}; font-family:monospace;">${t.ticketCode}</td>
        </tr></table>
      </td>
    </tr>`
    )
    .join("");

  return `
<div style="margin: 20px 0;">
  <div style="font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:${brand.textMuted}; margin-bottom:8px;">
    Your Ticket${tickets.length > 1 ? "s" : ""} (attached as PDF)
  </div>
  <div style="background:${brand.panel}; border:1px solid ${brand.border}; border-radius:6px; overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:10px 16px; font-family:${fontSans}; font-size:13px; font-weight:600; color:${brand.textDark};">Guest</td></tr>
      ${rows}
    </table>
  </div>
  <div style="font-family:${fontSans}; font-size:12px; color:${brand.textMuted}; margin-top:8px;">
    Each guest has their own ticket PDF attached to this email — show its QR code at check-in.
  </div>
</div>`;
}

export function stepList(steps: string[]): string {
  const items = steps
    .map(
      (step, i) => `
    <tr>
      <td style="padding: ${i === 0 ? "0" : "10px"} 0 0; vertical-align:top; width:24px;">
        <div style="width:18px; height:18px; border-radius:999px; background:${brand.accent}; color:${brand.accentText}; font-family:${fontSans}; font-size:10px; font-weight:700; text-align:center; line-height:18px;">${i + 1}</div>
      </td>
      <td style="padding: ${i === 0 ? "0" : "10px"} 0 0 10px; font-family:${fontSans}; font-size:13px; color:${brand.textDark};">${step}</td>
    </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">${items}</table>`;
}
