import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import CONFIG from '../config';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { Search, FileText } from 'lucide-react-native';
import { Platform } from 'react-native';

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  }
};

export default function OutstandingReportScreen() {
  const [report, setReport] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedHandler, setSelectedHandler] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('Employee');

  useEffect(() => {
    async function loadUser() {
      const name = await storage.get('user_name');
      if (name) setUserName(name);
    }
    loadUser();
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchReport();
    fetchSummary();
  }, [search, selectedHandler]);

  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_logins&api_key=${CONFIG.API_KEY}`);
      if (res.data.logins) setStaffList(res.data.logins);
    } catch (err) {
      console.log('Error fetching staff list:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=get_handler_status_summary&search=${search}&handle_by=${selectedHandler}`;
      const res = await axios.get(url);
      setSummaryData(res.data.data || []);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=get_outstanding_report&search=${search}&handle_by=${selectedHandler}`);
      setReport(res.data.data || []);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await storage.remove('user_id');
    await storage.remove('user_name');
    await storage.remove('isAuthenticated');
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <Header 
        userName={userName} 
        sidebarOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        onLogout={handleLogout} 
      />
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Page Title Indicator */}
        <View style={styles.titleContainer}>
          <FileText size={18} color="#38bdf8" />
          <Text style={styles.pageTitle}>Outstanding Report</Text>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.filterCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search File / Owner..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Summary Horizontal Carousel */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll}>
          {summaryData.map((row, i) => (
            <View key={i} style={styles.summaryCard}>
              <Text style={styles.summaryStaffName}>{row.staff_name || "Unassigned"}</Text>
              <Text style={styles.summaryFilesCount}>{row.total_staff_files} Files</Text>
            </View>
          ))}
        </ScrollView>

        {/* Report List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Fetching Outstanding Data...</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {report.length > 0 ? (
              report.map((r, i) => {
                const statusDisplay = (!r.closed_status_name || r.closed_status_name === "0") ? "In-Process" : r.closed_status_name;
                return (
                  <View key={i} style={styles.rowCard}>
                    <View style={styles.rowTop}>
                      <Text style={styles.fileNoText}>{r.file_no}</Text>
                      <Text style={styles.dateText}>{new Date(r.last_activity).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.ownerText}>Owner: {r.owner} ({r.mobile})</Text>
                    <Text style={styles.serviceText}>Service: {r.service_type} / {r.mandal}</Text>
                    <View style={styles.rowBottom}>
                      <Text style={styles.handlerText}>Handler: {r.assaigned_to_name || '---'}</Text>
                      <Text style={[styles.statusBadge, statusDisplay === 'In-Process' ? styles.statusAmber : styles.statusSlate]}>
                        {statusDisplay}
                      </Text>
                    </View>
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>Balance:</Text>
                      <Text style={[styles.balanceVal, r.balance > 0 ? styles.textRed : styles.textGreen]}>
                        ₹{parseFloat(r.balance || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noDataText}>No outstanding records found.</Text>
            )}
          </View>
        )}

        <Footer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  contentContainer: { padding: 16, paddingBottom: 40 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  pageTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  filterCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  searchInput: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  summaryScroll: { marginBottom: 16 },
  summaryCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginRight: 10, width: 140, borderWidth: 1, borderColor: '#334155' },
  summaryStaffName: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold' },
  summaryFilesCount: { color: '#38bdf8', fontSize: 10, fontWeight: '700', marginTop: 4 },
  centerContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  tableContainer: { gap: 10 },
  rowCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fileNoText: { color: '#38bdf8', fontSize: 14, fontWeight: 'bold' },
  dateText: { color: '#64748b', fontSize: 10 },
  ownerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  serviceText: { color: '#94a3b8', fontSize: 11, marginBottom: 8 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginBottom: 6 },
  handlerText: { color: '#cbd5e1', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  statusAmber: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
  statusSlate: { backgroundColor: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  balanceVal: { fontSize: 13, fontWeight: '900' },
  textRed: { color: '#f43f5e' },
  textGreen: { color: '#10b981' },
  noDataText: { textAlign: 'center', color: '#64748b', fontSize: 12, paddingVertical: 20 },
});