import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useErrorStore } from '@/store/useErrorStore';

const AUTO_DISMISS_MS = 4000;

export function GlobalErrorBanner() {
  const message = useErrorStore((s) => s.message);
  const code = useErrorStore((s) => s.code);
  const clearError = useErrorStore((s) => s.clearError);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      clearError();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, clearError]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearError();
  };

  return (
    <Modal
      visible={!!message}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.passthrough} pointerEvents="box-none">
        <View style={styles.banner}>
          <Text style={styles.icon}>⚠</Text>
          <View style={styles.textArea}>
            {code ? (
              <Text style={styles.code}>{code}</Text>
            ) : null}
            <Text style={styles.message}>{message}</Text>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={12} style={styles.dismiss}>
            <Text style={styles.dismissText}>×</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  passthrough: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: PALETTE.errorRed,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 20,
  },
  icon: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: '#fff',
    marginRight: 8,
  },
  textArea: {
    flex: 1,
  },
  code: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: '#fff',
    opacity: 0.75,
    marginBottom: 2,
  },
  message: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: '#fff',
  },
  dismiss: {
    paddingLeft: 12,
  },
  dismissText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: '#fff',
  },
});
