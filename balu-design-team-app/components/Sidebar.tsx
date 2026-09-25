import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { LayoutDashboard, FileText, Calendar, X } from 'lucide-react-native';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const { width } = Dimensions.get('window');

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  const menuItems = [
    { name: 'Dashboard', route: '/dashboard', icon: <LayoutDashboard size={18} color="#cbd5e1" /> },
    { name: 'Day Sheet', route: '/daysheet', icon: <Calendar size={18} color="#cbd5e1" /> },
    { name: 'Outstanding Report', route: '/outstanding-report', icon: <FileText size={18} color="#cbd5e1" /> },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={toggleSidebar} />
      <View style={styles.drawer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Navigation Menu</Text>
          <TouchableOpacity onPress={toggleSidebar} style={styles.closeBtn}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuList}>
          {menuItems.map((item, index) => {
            const isActive = pathname === item.route;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, isActive && styles.activeItem]}
                onPress={() => {
                  toggleSidebar();
                  router.push(item.route as any);
                }}
              >
                {item.icon}
                <Text style={[styles.menuText, isActive && styles.activeText]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.75, backgroundColor: '#0f172a', paddingTop: 50, paddingHorizontal: 16, elevation: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 12 },
  headerTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  closeBtn: { padding: 4, backgroundColor: '#1e293b', borderRadius: 6 },
  menuList: { gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  activeItem: { backgroundColor: '#3b82f6' },
  menuText: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  activeText: { color: '#fff', fontWeight: 'bold' },
});