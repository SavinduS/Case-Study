// Client-side rules for the villager sign-up form. Mirrors the backend
// register/villager checks so obvious mistakes are caught before the request.
// Kept free of react-native imports so it can be unit-tested in node.

// Deliberately permissive, and the same shape the backend accepts: the point
// is to catch a half-typed address, not to argue with RFC 5322.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

export interface RegisterFormValues {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
}

export function validateRegisterForm(input: RegisterFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) {
    errors.name = 'Enter your full name.';
  }
  if (!input.phone.trim()) {
    errors.phone = 'Enter your phone number.';
  } else if (!PHONE_PATTERN.test(input.phone.trim())) {
    errors.phone = 'Enter a valid phone number (digits, + at most).';
  }
  if (input.email.trim() && !EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Enter a valid email address, or leave it empty.';
  }
  if (!input.password) {
    errors.password = 'Choose a password.';
  } else if (input.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  if (input.confirm !== input.password) {
    errors.confirm = 'The two passwords do not match.';
  }
  return errors;
}
