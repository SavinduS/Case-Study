import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { colors, font, spacing } from '../theme';
import type { AuthSession } from '../auth/types';

interface Props {
  /** Resolves the signed-in user, or rejects with an Error carrying the reason. */
  onSubmit: (identifier: string, password: string) => Promise<AuthSession>;
}

// Deliberately permissive, and the same shape the backend accepts: the point
// is to catch a half-typed address, not to argue with RFC 5322.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

// The card is sized from the screen it is on instead of at a fixed height, so
// it fits every phone from a 4.7" SE up to a large Pro Max. REFERENCE_HEIGHT is
// a common tall phone (iPhone 14/15, 844pt); shorter screens scale the padding
// and type down, taller ones hold at full size. Touch targets never scale below
// MIN_TOUCH, so the fields stay comfortable to tap.
const REFERENCE_HEIGHT = 844;
const MIN_SCALE = 0.78;
const MAX_SCALE = 1;
const MIN_TOUCH = 48;

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

/** Spacing that shrinks with the screen but never past a usable size. */
function useCardMetrics() {
  const { height } = useWindowDimensions();
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, height / REFERENCE_HEIGHT));
  return {
    scale,
    brandPad: Math.round(24 * scale),
    logo: Math.max(48, Math.round(56 * scale)),
    wordmark: Math.round(17 * scale),
    bodyPad: Math.round(20 * scale),
    welcome: Math.round(28 * scale),
    fieldGap: Math.round(12 * scale),
    field: Math.max(MIN_TOUCH, Math.round(52 * scale)),
    buttonGap: Math.round(20 * scale)
  };
}

export default function LoginScreen({ onSubmit }: Props) {
  const m = useCardMetrics();
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
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* The two panels share the screen height, so the layout fills any
            phone instead of leaving empty space around a floating card. */}
        <View style={styles.card}>
          {/* Brand block: the green half of the card */}
          <View style={[styles.brand, { paddingVertical: m.brandPad }]}>
            <View style={styles.blobTopRight} />
            <View style={styles.blobBottomLeft} />

            <View
              style={[
                styles.logo,
                { width: m.logo, height: m.logo, borderRadius: m.logo / 2 }
              ]}
            >
              <Text style={[styles.logoMark, { fontSize: m.logo * 0.36 }]}>W</Text>
            </View>
            <Text style={[styles.wordmark, { fontSize: m.wordmark }]}>WILDLIFE</Text>
            <Text style={styles.wordmarkSub}>Conservation portal</Text>
          </View>

          {/* Form block */}
          <View style={[styles.body, { paddingVertical: m.bodyPad }]}>
            <Text style={[styles.welcome, { fontSize: m.welcome }]}>welcome</Text>
            <Text style={styles.tagline}>Sign in to open the screens for your role</Text>

            {failure ? (
              <View style={styles.bannerWrap}>
                <StatusBanner tone="error" title="Could not sign in" message={failure} />
              </View>
            ) : null}

            <TextInput
              style={[
                styles.input,
                {
                  marginTop: m.fieldGap,
                  minHeight: m.field,
                  borderRadius: m.field / 2
                },
                errors.identifier ? styles.inputError : null
              ]}
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                setErrors((prev) => ({ ...prev, identifier: '' }));
              }}
              placeholder="Email or phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="Email or phone number"
              editable={!submitting}
            />
            {errors.identifier ? (
              <Text style={styles.error}>{errors.identifier}</Text>
            ) : null}

            <View style={styles.passwordBlock}>
              <TextInput
                style={[
                  styles.input,
                  {
                    marginTop: m.fieldGap,
                    minHeight: m.field,
                    borderRadius: m.field / 2
                  },
                  styles.passwordInput,
                  errors.password ? styles.inputError : null
                ]}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Password"
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
                style={({ pressed }) => [
                  styles.reveal,
                  { top: m.fieldGap, minHeight: m.field },
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.revealText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

            <View style={{ marginTop: m.buttonGap }}>
              <PrimaryButton
                label="Log in"
                onPress={() => void handleSignIn()}
                loading={submitting}
                disabled={submitting}
                style={[styles.pill, { borderRadius: m.field / 2 }]}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  page: {
    flexGrow: 1,
    backgroundColor: colors.surface
  },
  // The screen IS the card: the green block on top, the form filling the rest
  // to the bottom edge. No floating card, nothing floating in empty space.
  card: {
    flexGrow: 1,
    backgroundColor: colors.surface
  },
  brand: {
    // Shares the screen with the form (the same split as the web sign-in):
    // both panels grow, so neither leaves a large empty area.
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Keeps the decorative circles inside the green block
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary
  },
// Decorative circles that run off the edges of the green block. Kept faint so
// the wordmark stays the clearest thing on the panel.
blobTopRight: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.primaryDark,
    opacity: 0.45
  },
blobBottomLeft: {
    position: 'absolute',
    bottom: -120,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.primaryDark,
    opacity: 0.3
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  logoMark: {
    color: colors.primaryDark,
    fontWeight: '800'
  },
  wordmark: {
    marginTop: spacing.md,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 3
  },
  wordmarkSub: {
    marginTop: 2,
    color: colors.primarySoft,
    fontSize: font.tiny,
    letterSpacing: 2
  },
  /* Slightly more of the screen than the brand block, since the form has more
     to hold; both centre their content in the space they get. */
  body: {
    flexGrow: 1.15,
    flexShrink: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  welcome: {
    color: colors.primary,
    fontWeight: '800',
    textAlign: 'center'
  },
  tagline: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: font.small,
    textAlign: 'center'
  },
  bannerWrap: {
    marginTop: spacing.md
  },
  input: {
    paddingHorizontal: spacing.lg,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  passwordBlock: {
    justifyContent: 'center'
  },
  // Leaves room for the Show/Hide control inside the field
  passwordInput: {
    paddingRight: 72
  },
  reveal: {
    position: 'absolute',
    right: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
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
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: font.tiny
  },
  pill: {}
});