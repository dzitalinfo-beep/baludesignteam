import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Menu, X, LogOut, User } from 'lucide-react-native';

interface HeaderProps {
  userName: string;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
}

export default function Header({ userName, sidebarOpen, toggleSidebar, onLogout }: HeaderProps) {
  return (
    <View style={styles.headerContainer}>
      {/* Left Menu Toggle Button */}
      <TouchableOpacity onPress={toggleSidebar} style={styles.menuButton}>
        {sidebarOpen ? <X size={22} color="#fff" /> : <Menu size={22} color="#fff" />}
      </TouchableOpacity>

      {/* Center Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>Balu Design Team</Text>
      </View>

      {/* Right User Badge & Logout Option */}
      <View style={styles.rightSection}>
        <View style={styles.userBadge}>
          <User size={12} color="#94a3b8" />
          <Text style={styles.userNameText} numberOfLines={1}>{userName}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <LogOut size={16} color="#f43f5e" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 45, // Safe area padding for mobile status bar
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  menuButton: {
    padding: 6,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  titleText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 110,
  },
  userNameText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    padding: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 8,
  },
});