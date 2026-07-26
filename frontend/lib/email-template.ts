// File: lib/email-template.ts
// Shared branded email design system. Previously every email in lib/email.ts
// had its own ~150-line copy-pasted <style> block in a generic navy
// (#1f3a61) theme that didn't match the actual site (cream/olive, serif
// headings, pill buttons — see app/stay/[stayId]/apply/page.tsx). This
// gives every transactional email one consistent, on-brand look, built
// from a handful of reusable pieces instead of six duplicated templates.

export const brand = {
  bg: "#F3EDE0",
  card: "#FFFFFF",
  panel: "#F7F1E4",
  header: "#3D4331",
  headerText: "#F3EDE0",
  accent: "#8A9670",
  textDark: "#2A2E22",
  textMuted: "#6B7060",
  divider: "rgba(61,67,49,0.14)",
  warnBg: "#FBEFD9",
  warnBorder: "#C98A2C",
  warnText: "#7A4B0F",
  errorBg: "#FBE7E4",
  errorBorder: "#C24A3D",
  errorText: "#7A2A20",
  successBg: "#EEF2E6",
  successBorder: "#8A9670",
  successText: "#3D4331",
};

const fontSerif = `Georgia, 'Times New Roman', serif`;
const fontSans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

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
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-card" style="width:100%; max-width:600px; background:${brand.card}; border-radius:20px; overflow:hidden; box-shadow: 0 8px 30px rgba(42,46,34,0.10);">
            <!-- Header -->
            <tr>
              <td class="email-pad" style="background:${brand.header}; padding:38px 40px 34px; text-align:center;">
                <div style="font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:${brand.accent}; margin-bottom:14px;">
                  Decentralized Den
                </div>
                ${eyebrow ? `<div style="display:inline-block; font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${brand.header}; background:${brand.accent}; padding:6px 16px; border-radius:999px; margin-bottom:16px;">${eyebrow}</div>` : ""}
                <div style="font-family:${fontSerif}; font-size:28px; font-weight:700; color:${brand.headerText}; line-height:1.25;">
                  ${title}
                </div>
                ${subtitle ? `<div style="margin-top:8px; font-family:${fontSans}; font-size:14px; color:${brand.headerText}; opacity:0.75;">${subtitle}</div>` : ""}
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td class="email-pad" style="padding:36px 40px 8px; font-family:${fontSans}; font-size:15px; line-height:1.7; color:${brand.textDark};">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Footer (inside card) -->
            <tr>
              <td class="email-pad" style="padding:28px 40px 36px;">
                <div style="height:1px; background:${brand.divider}; margin-bottom:24px;"></div>
                ${bookingId ? `<div style="font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:${brand.textMuted}; margin-bottom:6px;">Booking ID</div><div style="font-family:${fontSans}; font-size:13px; color:${brand.textDark}; margin-bottom:18px; font-weight:600;">${bookingId}</div>` : ""}
                <div style="font-family:${fontSans}; font-size:13px; color:${brand.textMuted}; text-align:center;">
                  Need help? Write to
                  <a href="mailto:${supportEmail}" style="color:${brand.header}; font-weight:600; text-decoration:underline;">${supportEmail}</a>
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:600px; margin-top:20px; text-align:center; font-family:${fontSans}; font-size:12px; color:${brand.textMuted};">
            © ${year} Decentralized Den
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
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto;">
  <tr>
    <td align="center" style="border-radius:999px; background:${brand.header};">
      <a href="${href}" style="display:inline-block; padding:16px 40px; font-family:${fontSans}; font-size:15px; font-weight:700; letter-spacing:0.3px; color:${brand.headerText}; text-decoration:none; border-radius:999px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function amountCard(opts: { label: string; amount: string; sublabel?: string }): string {
  return `
<div style="background:${brand.panel}; border:1px solid ${brand.divider}; border-radius:16px; padding:28px; text-align:center; margin:24px 0;">
  <div style="font-family:${fontSans}; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${brand.textMuted}; margin-bottom:10px;">${opts.label}</div>
  <div style="font-family:${fontSerif}; font-size:38px; font-weight:700; color:${brand.header};">${opts.amount}</div>
  ${opts.sublabel ? `<div style="font-family:${fontSans}; font-size:13px; color:${brand.textMuted}; margin-top:6px;">${opts.sublabel}</div>` : ""}
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
      <td style="padding: ${i === 0 ? "0" : "14px"} 0 0; font-family:${fontSans};">
        <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:${brand.textMuted}; margin-bottom:3px;">${row.label}</div>
        <div style="font-size:15px; font-weight:600; color:${brand.textDark};">
          ${row.href ? `<a href="${row.href}" style="color:${brand.header}; text-decoration:underline;">${row.value}</a>` : row.value}
        </div>
      </td>
    </tr>`
    )
    .join("");

  return `
<div style="background:${brand.panel}; border:1px solid ${brand.divider}; border-radius:16px; padding:24px 26px; margin:24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
</div>`;
}

type CalloutTone = "info" | "warning" | "success" | "error";

export function calloutBox(opts: { tone: CalloutTone; title: string; bodyHtml: string }): string {
  const tones: Record<CalloutTone, { bg: string; border: string; text: string }> = {
    info: { bg: brand.panel, border: brand.divider, text: brand.textDark },
    warning: { bg: brand.warnBg, border: brand.warnBorder, text: brand.warnText },
    success: { bg: brand.successBg, border: brand.successBorder, text: brand.successText },
    error: { bg: brand.errorBg, border: brand.errorBorder, text: brand.errorText },
  };
  const t = tones[opts.tone];

  return `
<div style="background:${t.bg}; border-left:4px solid ${t.border}; border-radius:10px; padding:18px 22px; margin:24px 0;">
  <div style="font-family:${fontSans}; font-size:14px; font-weight:700; color:${t.text}; margin-bottom:6px;">${opts.title}</div>
  <div style="font-family:${fontSans}; font-size:14px; color:${t.text}; opacity:0.92; line-height:1.6;">${opts.bodyHtml}</div>
</div>`;
}

export function stepList(steps: string[]): string {
  const items = steps
    .map(
      (step, i) => `
    <tr>
      <td style="padding: ${i === 0 ? "0" : "10px"} 0 0; vertical-align:top; width:28px;">
        <div style="width:20px; height:20px; border-radius:999px; background:${brand.accent}; color:${brand.header}; font-family:${fontSans}; font-size:11px; font-weight:700; text-align:center; line-height:20px;">${i + 1}</div>
      </td>
      <td style="padding: ${i === 0 ? "0" : "10px"} 0 0 12px; font-family:${fontSans}; font-size:14px; color:${brand.textDark};">${step}</td>
    </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">${items}</table>`;
}
