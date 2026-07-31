// File: lib/validate.ts
// Turns a Zod failure into something a human can act on.
//
// Raw Zod messages leak straight through to users today — a blank contact
// form returns "Too small: expected string to have >=1 characters", which
// names no field and reads like a stack trace. This prefixes the offending
// field and rewrites the most common messages into plain English.

import type { ZodError } from 'zod';

/** "socialTwitter" -> "Social twitter"; "guests.0.fullName" -> "Guest 1 full name" */
function humanizePath(path: (string | number | symbol)[]): string {
  if (path.length === 0) return 'Value';

  const parts = path.map((segment) =>
    typeof segment === 'number' ? `${segment + 1}` : String(segment)
  );

  // Collapse "guests, 1, fullName" into "guests 1 full name"
  const spaced = parts
    .join(' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeIssue(issue: ZodError['issues'][number]): string {
  const field = humanizePath(issue.path);
  const anyIssue = issue as any;

  // Zod v4 reports the subject as `origin` ("string" | "number" | "array"…),
  // and no longer carries a `received` field on invalid_type — the only
  // signal for "key was absent" is in the default message.
  const origin = anyIssue.origin ?? anyIssue.type;
  const isString = origin === 'string';
  const unit = isString ? ' characters' : origin === 'array' ? ' items' : '';

  switch (issue.code) {
    case 'too_small':
      return anyIssue.minimum === 1 && (isString || origin === 'array')
        ? `${field} is required`
        : `${field} must be at least ${anyIssue.minimum}${unit}`;
    case 'too_big':
      return `${field} must be ${anyIssue.maximum}${unit} or fewer`;
    case 'invalid_type':
      return /received undefined|received null/i.test(issue.message)
        ? `${field} is required`
        : `${field} is not valid`;
    case 'invalid_format':
      return anyIssue.format === 'email'
        ? `${field} must be a valid email address`
        : `${field} is not in the expected format`;
    default:
      // Zod's own message is usually decent for custom refinements —
      // just make sure the field is named.
      return issue.message.startsWith(field) ? issue.message : `${field}: ${issue.message}`;
  }
}

/**
 * First error, formatted for display. Use for the `error` field of a 400.
 */
export function firstValidationMessage(error: ZodError, fallback = 'Invalid request'): string {
  const issue = error.issues[0];
  return issue ? humanizeIssue(issue) : fallback;
}

/**
 * All errors keyed by field path — handy for forms that highlight inputs.
 */
export function validationFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = humanizeIssue(issue);
  }
  return out;
}
