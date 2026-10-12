import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { colors, font, radius, spacing } from '../theme';
import type { AuthSession } from '../auth/types';

interface Props {
  /** Creates the account; resolves with the signed-in session or rejects. */
  onSubmit: (input: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }) => Promise<AuthSession>;
  onBackToSignIn: () => void;
}

// Same permissive shapes the backend accepts: catch typos, not RFC arguments.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

function validate(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
}): Record<string, string> {
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

export default function RegisterScreen({ onSubmit, onBackToSignIn }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleRegister() {
    const nextErrors = validate({ name, phone, email, password, confirm });
    setErrors(nextErrors);
    setFailure(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        password,
        email: email.trim() || undefined
      });
      // On success the app swaps this screen out; nothing to render here.
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Sign-up failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function clearError(field: string) {
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Villagers can report wildlife conflicts straight from this phone.
          </Text>
        </View>

        {failure ? <StatusBanner tone="error" title="Could not create the account" message={failure} /> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            value={name}
            onChangeText={(value) => {
              setName(value);
              clearError('name');
            }}
            placeholder="Soma Silva"
            placeholderTextColor={colors.textMuted}
            autoComplete="name"
            accessibilityLabel="Full name"
            editable={!submitting}
          />
          {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={[styles.input, errors.phone ? styles.inputError : null]}
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              clearError('phone');
            }}
            placeholder="+9471 234 5678"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            autoComplete="tel"
            accessibilityLabel="Phone number"
            editable={!submitting}
          />
          {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}

          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearError('email');
            }}
            placeholder="soma@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email, optional"
            editable={!submitting}
          />
          {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, errors.password ? styles.inputError : null]}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearError('password');
            }}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            accessibilityLabel="Password"
            editable={!submitting}
          />
          {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={[styles.input, errors.confirm ? styles.inputError : null]}
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              clearError('confirm');
            }}
            placeholder="Type the password again"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            accessibilityLabel="Confirm password"
            editable={!submitting}
          />
          {errors.confirm ? <Text style={styles.error}>{errors.confirm}</Text> : null}

          <View style={styles.submitBlock}>
            <PrimaryButton
              label="Create Account"
              onPress={() => void handleRegister()}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          onPress={onBackToSignIn}
          disabled={submitting}
          style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerAccent}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg,
    flexGrow: 1
  },
  brand: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800'
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: font.small,
    textAlign: 'center'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md
  },
  label: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
    marginBottom: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    fontSize: font.body,
    color: colors.text,
    marginBottom: spacing.md
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 2
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm
  },
  submitBlock: {
    marginTop: spacing.xs
  },
  footerLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md
  },
  footerText: {
    color: colors.textMuted,
    fontSize: font.body
  },
  footerAccent: {
    color: colors.primary,
    fontWeight: '700'
  },
  pressed: {
    opacity: 0.6
  }
});
