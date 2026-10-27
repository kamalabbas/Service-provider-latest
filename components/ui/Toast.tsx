import { useThemeColor } from '@/hooks/useThemeColor';
import { useToastStore } from '@/stores/toastStore';
import React, { useEffect } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  visible: boolean;
  persist?: boolean; // keep toast visible until closed
  linkText?: string;
  linkURL?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'error', visible, persist = false, linkText , linkURL }) => {
  const errorBg = useThemeColor({}, 'error');
  const successBg = useThemeColor({}, 'success');
  const hideToast = useToastStore((s) => s.hideToast);
  const toastId = useToastStore((s) => s.id);

  // Each new toast gets its own full display time.
  useEffect(() => {
    if (visible && !persist) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, persist, toastId, hideToast]);

  
  if (!visible) return null;

  const bgColor = type === 'error' ? errorBg : successBg;

  const handleLinkPress = async () => {
    if (linkURL) {
      const supported = await Linking.canOpenURL(linkURL);
      if (supported) Linking.openURL(linkURL);
    }
  };

  return (
    <View style={[styles.toast, { backgroundColor: bgColor }]}>
      <View style={styles.contentContainer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>{message}</Text>
          {linkURL && (
            <TouchableOpacity onPress={handleLinkPress}>
              <Text style={styles.linkText}>{linkText || 'Learn more'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={hideToast}
          style={styles.closeBtn}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 40,
    left: '10%',
    right: '10%',
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start', // align link with text
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4, // spacing before link
  },
  linkText: {
    color: '#FFD700',
    textDecorationLine: 'underline',
    fontWeight: '600',
    fontSize: 13,
  },
  closeBtn: {
    marginLeft: 12,
    padding: 4,
    borderRadius: 12,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
});
