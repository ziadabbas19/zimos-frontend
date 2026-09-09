/**
 * Client-side password policy — must stay identical to the rule the backend
 * enforces in `authValidation.js` (see `PASSWORD_PATTERN`) so a password this
 * form accepts is never bounced by the server, and vice-versa. Rule: at least
 * 8 characters, one lowercase letter, one uppercase letter, one special
 * character. Used by RegisterPage and ResetPasswordPage's new-password field.
 *
 * NOTE: the task brief specifies "special character"; the current backend
 * pattern is the slightly looser "digit OR special character" (`[^A-Za-z]`),
 * with a comment inviting the frontend to be stricter. This layers the
 * stricter symbol requirement — the safe direction (the form can only reject
 * more, never accept something the server would refuse).
 */
export interface PasswordRule {
  id: string;
  /** Egyptian-Arabic helper text, shown while the requirement is unmet. */
  label: string;
  test: (value: string) => boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "٨ حروف على الأقل", test: (v) => v.length >= MIN_PASSWORD_LENGTH },
  { id: "lower", label: "حرف صغير واحد على الأقل (a–z)", test: (v) => /[a-z]/.test(v) },
  { id: "upper", label: "حرف كبير واحد على الأقل (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "special", label: "رمز خاص واحد على الأقل (‏!@#$%…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** The rules `value` does not yet satisfy. Empty array ⇒ password is strong enough. */
export function unmetPasswordRules(value: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value));
}

export function isPasswordStrong(value: string): boolean {
  return unmetPasswordRules(value).length === 0;
}
