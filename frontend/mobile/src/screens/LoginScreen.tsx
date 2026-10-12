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
  /** Resolves the signed-in user, or rejects with an Error carrying the reason. */
  onSubmit: (identifier: string, password: string) => Promise<AuthSession>;
  /** Opens the villager sign-up screen. */
  onRegister?: () => void;
}

// Deliberately permissive, and the same shape the backend accepts: the point
// is to catch a half-typed address, not to argue with RFC 5322.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

export function isEmailOrPhone(value: string): boolean {
  const trimmed = value.trim();
  return EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed);
}

function validate(identifier: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!identifier.trim()) {
    errors.identifier = 'Enter your email address or phone number.';
  } else if (!isEmailOrPhone(identifier)) {
    errors.identifier = 'Enter a valid email address or phone number.';
  }
  if (!password) {
    errors.password = 'Enter your password.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  return errors;
}

export default function LoginScreen({ onSubmit, onRegister }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleSignIn() {
    const nextErrors = validate(identifier, password);
    setErrors(nextErrors);
    setFailure(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(identifier.trim(), password);
      // On success the app swaps this screen out; nothing to render here.
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo} accessibilityElementsHidden>
            <Text style={styles.logoText}>PA</Text>
          </View>
          <Text style={styles.title}>Wildlife Alert Portal</Text>
          <Text style={styles.subtitle}>
            Sign in to continue. Your role decides where you go next.
          </Text>
        </View>

        {failure ? <StatusBanner tone="error" title="Could not sign in" message={failure} /> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Email or phone number</Text>
          <TextInput
            style={[styles.input, errors.identifier ? styles.inputError : null]}
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              setErrors((prev) => ({ ...prev, identifier: '' }));
            }}
            placeholder="nimali@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel="Email or phone number"
            editable={!submitting}
          />
          {errors.identifier ? <Text style={styles.error}>{errors.identifier}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, errors.password ? styles.inputError : null]}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="Your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={() => void handleSignIn()}
              accessibilityLabel="Password"
              editable={!submitting}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityState={{ selected: showPassword }}
              onPress={() => setShowPassword((prev) => !prev)}
              style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}
            >
              <Text style={styles.revealText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

          <View style={styles.submitBlock}>
            <PrimaryButton
              label="Sign In"
              onPress={() => void handleSignIn()}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </View>

        {onRegister ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a villager account"
            onPress={onRegister}
            disabled={submitting}
            style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
          >
            <Text style={styles.footerText}>
              New villager? <Text style={styles.footerAccent}>Create an account</Text>
            </Text>
          </Pressable>
        ) : null}
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
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    color: colors.white,
    fontSize: font.title,
    fontWeight: '800'
  },
  title: {
    marginTop: spacing.md,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  passwordInput: {
    flex: 1
  },
  reveal: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md
  },
  revealText: {
    color: colors.primary,
    fontSize: font.small,
    fontWeight: '700'
  },
  pressed: {
    opacity: 0.6
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
  }
});