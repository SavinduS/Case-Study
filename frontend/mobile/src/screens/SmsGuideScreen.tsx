import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SMS_AREA_CODES, SMS_HOTLINE, SMS_TYPE_CODES } from "../constants/sms";
import { colors, font, radius, spacing } from "../theme";

export default function SmsGuideScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>SMS Reporting Guide</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Report a wildlife hazard by SMS to the hotline below.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>SMS the wildlife hotline</Text>
          <Text style={styles.hotline}>{SMS_HOTLINE}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Message format</Text>
          <Text style={styles.format}>TYPE-CODE AREA-CODE</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.example}>Example: 1 NORTHBOUNDARY</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Type codes</Text>
        <View style={styles.card}>
          {SMS_TYPE_CODES.map((row, i) => (
            <View
              key={row.code}
              style={[styles.codeRow, i > 0 && styles.codeRowBorder]}
            >
              <View style={styles.codeBadge}>
                <Text style={styles.codeBadgeText}>{row.code}</Text>
              </View>
              <Text style={styles.codeLabel}>{row.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Area codes</Text>
        <View style={styles.card}>
          {SMS_AREA_CODES.map((code, i) => (
            <View
              key={code}
              style={[styles.codeRow, i > 0 && styles.codeRowBorder]}
            >
              <Text style={styles.areaCode}>{code}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>
          You will receive an SMS with your report ID. If the message is not
          understood, reply with the menu number and your area — replies stay
          valid for 24 hours.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSpacer: {
    width: 70,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: font.section,
    fontWeight: "700",
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  intro: {
    color: colors.textMuted,
    fontSize: font.body,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: font.tiny,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hotline: {
    color: colors.primaryDark,
    fontSize: font.title,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  format: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  exampleRow: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  example: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  codeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  codeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBadgeText: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: "800",
  },
  codeLabel: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
  },
  areaCode: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: "700",
  },
  hint: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
