import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Linking
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import CONFIG from '../config';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { FileText, Phone, MessageCircle, XCircle } from 'lucide-react-native';

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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedHandler, setSelectedHandler] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('Employee');

  useEffect(() => {
    async function loadUser() {
      const name = await storage.get('user_name');
      if (name) setUserName(name);
    }
    loadUser();
    fetchSummary();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchReport(1, true);
  }, [search, selectedHandler]);

  const fetchSummary = async () => {
    try {
      const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=get_handler_status_summary&search=${search}`;
      const res = await axios.get(url);
      setSummaryData(res.data.data || []);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const fetchReport = async (pageToFetch = 1, replace = false) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        api_key: CONFIG.API_KEY,
        transac: 'get_outstanding_report_to_mobile',
        search: search || '',
        handle_by: selectedHandler || '',
        page: pageToFetch.toString()
      }).toString();

      const url = `${CONFIG.API_BASE_URL}/api.php?${params}`;
      const res = await axios.get(url);
      
      if (res.data && res.data.status === 'success') {
        const newData = res.data.data || [];
        setReport(replace ? newData : [...report, ...newData]);
        setCurrentPage(res.data.current_page);
        setTotalPages(res.data.total_pages);
        setTotalRecords(res.data.total_records);
      }
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleCall = (mobile: string) => {
    if (!mobile) return;
    Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (mobile: string) => {
    if (!mobile) return;
    const formatted = mobile.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${formatted}`);
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
          <Text style={styles.pageTitle}>Outstanding Report (Mobile View)</Text>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.filterCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search File / BA No / Owner / Mobile..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Summary Horizontal Carousel - Passes Staff ID */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll}>
          <TouchableOpacity 
            style={[styles.summaryCard, selectedHandler === '' && styles.activeSummaryCard]} 
            onPress={() => setSelectedHandler('')}
          >
            <Text style={styles.summaryStaffName}>All Staff</Text>
            <Text style={styles.summaryFilesCount}>View All</Text>
          </TouchableOpacity>

          {summaryData.map((row, i) => {
            const staffId = String(row.staff_id || row.id || '');
            const isSelected = selectedHandler === staffId;
            return (
              <TouchableOpacity 
                key={i} 
                style={[styles.summaryCard, isSelected && styles.activeSummaryCard]} 
                onPress={() => setSelectedHandler(staffId)}
              >
                <Text style={styles.summaryStaffName}>{row.staff_name || "Unassigned"}</Text>
                <Text style={styles.summaryFilesCount}>{row.total_staff_files} Files</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedHandler !== '' && (
          <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setSelectedHandler('')}>
            <XCircle size={14} color="#f43f5e" />
            <Text style={styles.clearFilterText}>Clear Staff Filter</Text>
          </TouchableOpacity>
        )}

        {/* Report List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Fetching Outstanding Data...</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            <View style={styles.paginationHeader}>
              <Text style={styles.countIndicator}>Total Records: [{totalRecords}]</Text>
              <Text style={styles.pageIndicator}>Page {currentPage} of {totalPages || 1}</Text>
            </View>

            {report.length > 0 ? (
              report.map((r, i) => {
                const statusDisplay = r.closed_status_display || "In Process";
                return (
                  <View key={i} style={styles.rowCard}>
                    <View style={styles.rowTop}>
                      <Text style={styles.fileNoText}>
                        {r.file_no} {r.b_a_number ? `(${r.b_a_number})` : ''}
                      </Text>
                      <Text style={styles.dateText}>{r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '---'}</Text>
                    </View>

                    <Text style={styles.ownerText}>Owner: {r.owner}</Text>
                    
                    {r.ref_name ? (
                      <Text style={styles.refNameText}>Ref Name: {r.ref_name}</Text>
                    ) : null}

                    {r.mobile ? (
                      <View style={styles.mobileRow}>
                        <Text style={styles.mobileText}>📱 {r.mobile}</Text>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(r.mobile)}>
                            <Phone size={12} color="#fff" />
                            <Text style={styles.actionText}>Call</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(r.mobile)}>
                            <MessageCircle size={12} color="#fff" />
                            <Text style={styles.actionText}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    <Text style={styles.serviceText}>Service: {r.service_type} / {r.mandal}</Text>
                    
                    <View style={styles.rowBottom}>
                      <Text style={styles.handlerText}>Handler: {r.assaigned_to_name || '---'}</Text>
                      <Text style={[styles.statusBadge, statusDisplay === 'In Process' ? styles.statusAmber : styles.statusSlate]}>
                        {statusDisplay}
                      </Text>
                    </View>

                    {/* Financial Breakdown: Credit, Debit & Closing Balance */}
                    <View style={styles.financeBreakdownRow}>
                      <View style={styles.financeCol}>
                        <Text style={styles.financeLabel}>Total CR:</Text>
                        <Text style={styles.textGreen}>₹{parseFloat(r.total_credit || 0).toLocaleString()}</Text>
                      </View>
                      <View style={styles.financeCol}>
                        <Text style={styles.financeLabel}>Total DR:</Text>
                        <Text style={styles.textRed}>₹{parseFloat(r.total_debit || 0).toLocaleString()}</Text>
                      </View>
                      <View style={styles.financeColRight}>
                        <Text style={styles.financeLabel}>Closing Balance:</Text>
                        <Text style={[styles.balanceVal, parseFloat(r.balance || 0) > 0 ? styles.textRed : styles.textGreen]}>
                          ₹{parseFloat(r.balance || 0).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noDataText}>No outstanding records found.</Text>
            )}

            {/* Pagination Load More Controls */}
            {currentPage < totalPages && (
              <TouchableOpacity 
                style={styles.loadMoreBtn} 
                onPress={() => fetchReport(currentPage + 1, false)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More Records ({currentPage} / {totalPages})</Text>
                )}
              </TouchableOpacity>
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
  summaryScroll: { marginBottom: 12 },
  summaryCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginRight: 10, width: 140, borderWidth: 1, borderColor: '#334155' },
  activeSummaryCard: { borderColor: '#38bdf8', backgroundColor: '#334155' },
  summaryStaffName: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold' },
  summaryFilesCount: { color: '#38bdf8', fontSize: 10, fontWeight: '700', marginTop: 4 },
  clearFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  clearFilterText: { color: '#f43f5e', fontSize: 11, fontWeight: 'bold' },
  centerContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  tableContainer: { gap: 10 },
  paginationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  countIndicator: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  pageIndicator: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  rowCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155', gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  fileNoText: { color: '#38bdf8', fontSize: 14, fontWeight: 'bold' },
  dateText: { color: '#64748b', fontSize: 10 },
  ownerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  refNameText: { color: '#38bdf8', fontSize: 11, fontWeight: '600' },
  mobileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  mobileText: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  callBtn: { backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  waBtn: { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  serviceText: { color: '#94a3b8', fontSize: 11, marginBottom: 2 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 2 },
  handlerText: { color: '#cbd5e1', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  statusAmber: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
  statusSlate: { backgroundColor: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  financeBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 },
  financeCol: { flex: 1 },
  financeColRight: { flex: 1.2, alignItems: 'flex-end' },
  financeLabel: { color: '#64748b', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  balanceVal: { fontSize: 12, fontWeight: '900' },
  textRed: { color: '#f43f5e', fontSize: 11, fontWeight: 'bold' },
  textGreen: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },
  noDataText: { textAlign: 'center', color: '#64748b', fontSize: 12, paddingVertical: 20 },
  loadMoreBtn: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  loadMoreText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }
});