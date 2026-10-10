import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CONFIG from '../config';

export default function Footer() {
  return (
    <View style={styles.footerContainer}>
      <Text style={styles.footerText}>
        © {new Date().getFullYear()} {CONFIG.DEVELOPER} • v{CONFIG.APP_VERSION}
      </Text>
      <Text style={styles.footerSubText}>Balu Design Team Management Suite</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 20,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  footerSubText: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
});