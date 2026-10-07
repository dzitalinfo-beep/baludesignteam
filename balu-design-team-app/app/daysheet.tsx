import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Linking
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import * as XLSX from 'xlsx';
import DateTimePicker from '@react-native-community/datetimepicker';
import CONFIG from '../config';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { Calendar, ShieldCheck, Search, XCircle, FileSpreadsheet, Filter, ChevronDown, ChevronUp, Phone, MessageCircle } from 'lucide-react-native';

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  }
};

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WebDateInput = ({ value, onChange, style }: { value: string; onChange: (val: string) => void; style?: any }) => {
  return React.createElement('input', {
    type: 'date',
    value,
    onChange: (e: any) => onChange(e.target.value),
    style: {
      backgroundColor: '#0f172a',
      borderRadius: 10,
      padding: '12px 14px',
      color: '#fff',
      fontSize: 13,
      fontWeight: 'bold',
      border: '1px solid #334155',
      width: '100%',
      colorScheme: 'dark',
      boxSizing: 'border-box',
      ...style
    }
  });
};

export default function DaySheetScreen() {
  const todayStr = toLocalDateString(new Date());

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheetLogs, setSheetLogs] = useState<any[]>([]);
  const [userName, setUserName] = useState('Employee');

  const [mandalList, setMandalList] = useState<any[]>([]);
  const [serviceTypeList, setServiceTypeList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const [filters, setFilters] = useState({
    from_date: '2026-10-01',
    to_date: todayStr,
    file_no: '',
    mandal: '',
    service_type: '',
    handle_by: ''
  });

  const [tableQuery, setTableQuery] = useState('');

  useEffect(() => {
    async function loadUser() {
      const name = await storage.get('user_name');
      if (name) setUserName(name);
    }
    loadUser();
    loadMasterDataLists();
    fetchDaySheetLogs(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMasterDataLists = async () => {
    try {
      const [mRes, stRes, lRes] = await Promise.all([
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_mandals&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} })),
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_main_services&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} })),
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_logins&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} }))
      ]);

      if (mRes.data?.mandals) setMandalList(mRes.data.mandals.map((m: any) => ({ value: m.name, label: m.name })));
      if (stRes.data?.services) setServiceTypeList(stRes.data.services.map((s: any) => ({ value: s.name, label: s.name })));
      if (lRes.data?.logins) setStaffList(lRes.data.logins.map((u: any) => ({ value: String(u.id), label: u.name })));
    } catch (err) {
      console.error("DaySheet Masters Load Exception:", err);
    }
  };

  const fetchDaySheetLogs = async (appliedFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: appliedFilters.from_date || '',
        to_date: appliedFilters.to_date || '',
        file_no: appliedFilters.file_no || '',
        mandal: appliedFilters.mandal || '',
        service_type: appliedFilters.service_type || '',
        handle_by: appliedFilters.handle_by || ''
      }).toString();

      const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=get_daysheet_report&${params}`;
      const res = await axios.get(url, { timeout: 20000 });

      if (res.data && res.data.status === 'success') {
        setSheetLogs(res.data.data || []);
      } else {
        setSheetLogs([]);
      }
    } catch (err: any) {
      console.log('DaySheet sync critical failure:', err.message);
      setSheetLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const resetAllReportFilters = () => {
    const defaultCleared = {
      from_date: todayStr,
      to_date: todayStr,
      file_no: '',
      mandal: '',
      service_type: '',
      handle_by: ''
    };
    setFilters(defaultCleared);
    setTableQuery('');
    fetchDaySheetLogs(defaultCleared);
  };

  const onFromDateChange = (event: any, selectedDate?: Date) => {
    setShowFromPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selectedDate) return;
    handleFilterChange('from_date', toLocalDateString(selectedDate));
  };

  const onToDateChange = (event: any, selectedDate?: Date) => {
    setShowToPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selectedDate) return;
    handleFilterChange('to_date', toLocalDateString(selectedDate));
  };

  const handleCall = (mobile: string) => {
    if (!mobile) return;
    Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (mobile: string) => {
    if (!mobile) return;
    const formatted = mobile.replace(/[^0-9]/g, '');
    const url = `https://wa.me/91${formatted}`;
    Linking.openURL(url);
  };

  const filteredSheetLogs = useMemo(() => {
    if (!tableQuery.trim()) return sheetLogs;
    const q = tableQuery.toLowerCase();
    return sheetLogs.filter(log => 
      (log.file_no && log.file_no.toLowerCase().includes(q)) ||
      (log.b_a_number && log.b_a_number.toLowerCase().includes(q)) ||
      (log.owner && log.owner.toLowerCase().includes(q)) ||
      (log.ref_name && log.ref_name.toLowerCase().includes(q)) ||
      (log.mobile && log.mobile.toLowerCase().includes(q)) ||
      (log.mandal && log.mandal.toLowerCase().includes(q)) ||
      (log.service_type && log.service_type.toLowerCase().includes(q)) ||
      (log.staff_name && log.staff_name.toLowerCase().includes(q)) ||
      (log.narrative_note && log.narrative_note.toLowerCase().includes(q))
    );
  }, [sheetLogs, tableQuery]);

  const handleExportToExcel = async () => {
    if (filteredSheetLogs.length === 0) {
      Alert.alert('Empty Ledger', 'No records available to compile into Excel.');
      return;
    }
    try {
      const simplifiedRows = filteredSheetLogs.map((log, idx) => ({
        "S.No": idx + 1,
        "Date": log.created_date,
        "Time": log.created_time,
        "File Ref": log.file_no,
        "BA Number": log.b_a_number,
        "Owner": log.owner,
        "Ref Name": log.ref_name,
        "Mobile": log.mobile,
        "Mandal": log.mandal,
        "Service": log.service_type,
        "Context": log.tracking_level,
        "Phase": log.current_phase,
        "Notes": log.narrative_note,
        "Staff": log.staff_name
      }));

      const ws = XLSX.utils.json_to_sheet(simplifiedRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DaySheet_Logs");

      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.cacheDirectory + 'DaySheet_Report.xlsx';
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Success', 'Excel file generated successfully.');
      }
    } catch (err: any) {
      console.log('Excel Export Error:', err.message);
      Alert.alert('Export Failed', 'Could not compile Excel spreadsheet.');
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
        {/* Page Header Title & Export Options */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Calendar size={18} color="#38bdf8" />
            <Text style={styles.pageTitle}>Day Sheet Manager</Text>
          </View>
          <View style={styles.exportButtonsRow}>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportToExcel}>
              <FileSpreadsheet size={16} color="#10b981" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Filter Inputs Form Card (Default Closed) */}
        <View style={styles.filterCard}>
          <TouchableOpacity 
            style={styles.filterCardHeader} 
            onPress={() => setFiltersExpanded(!filtersExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.filterHeaderLeft}>
              <Filter size={15} color="#38bdf8" />
              <Text style={styles.filterHeaderTitle}>Report Query Filters</Text>
            </View>
            {filtersExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
          </TouchableOpacity>

          {filtersExpanded && (
            <View style={styles.filterExpandedContent}>
              <View style={styles.filterGrid}>
                <View style={styles.filterGroup}>
                  <Text style={styles.label}>From Date</Text>
                  {Platform.OS === 'web' ? (
                    <WebDateInput value={filters.from_date} onChange={(val) => handleFilterChange('from_date', val)} />
                  ) : (
                    <>
                      <TouchableOpacity style={styles.dateInput} onPress={() => setShowFromPicker(true)}>
                        <Text style={styles.dateInputText}>{filters.from_date || 'Select date'}</Text>
                        <Calendar size={14} color="#94a3b8" />
                      </TouchableOpacity>
                      {showFromPicker && (
                        <DateTimePicker
                          value={filters.from_date ? new Date(filters.from_date) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={onFromDateChange}
                        />
                      )}
                    </>
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>To Date</Text>
                  {Platform.OS === 'web' ? (
                    <WebDateInput value={filters.to_date} onChange={(val) => handleFilterChange('to_date', val)} />
                  ) : (
                    <>
                      <TouchableOpacity style={styles.dateInput} onPress={() => setShowToPicker(true)}>
                        <Text style={styles.dateInputText}>{filters.to_date || 'Select date'}</Text>
                        <Calendar size={14} color="#94a3b8" />
                      </TouchableOpacity>
                      {showToPicker && (
                        <DateTimePicker
                          value={filters.to_date ? new Date(filters.to_date) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={onToDateChange}
                        />
                      )}
                    </>
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>File Reference No / BA No</Text>
                  <TextInput
                    style={styles.input}
                    value={filters.file_no}
                    onChangeText={val => handleFilterChange('file_no', val)}
                    placeholder="Search File Ref / BA No..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Zone Mandal</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.mandal}
                      onChange={(e) => handleFilterChange('mandal', e.target.value)}
                    >
                      <option value="">All Mandals</option>
                      {mandalList.map((m, i) => (
                        <option key={i} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.mandal}
                      onChangeText={val => handleFilterChange('mandal', val)}
                      placeholder="Enter Mandal..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Service Category</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.service_type}
                      onChange={(e) => handleFilterChange('service_type', e.target.value)}
                    >
                      <option value="">All Services</option>
                      {serviceTypeList.map((s, i) => (
                        <option key={i} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.service_type}
                      onChangeText={val => handleFilterChange('service_type', val)}
                      placeholder="Enter Service..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={[styles.label, { color: '#38bdf8' }]}>Handle By Staff</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.handle_by}
                      onChange={(e) => handleFilterChange('handle_by', e.target.value)}
                    >
                      <option value="">All Operators</option>
                      {staffList.map((st, i) => (
                        <option key={i} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.handle_by}
                      onChangeText={val => handleFilterChange('handle_by', val)}
                      placeholder="Staff ID / Name..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.searchButton} onPress={() => fetchDaySheetLogs()}>
                  <Search size={14} color="#fff" />
                  <Text style={styles.searchButtonText}>Execute Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetButton} onPress={resetAllReportFilters}>
                  <XCircle size={18} color="#f43f5e" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Post-Execution Search Box for Results */}
        {!loading && sheetLogs.length > 0 && (
          <View style={styles.postSearchCard}>
            <Filter size={15} color="#38bdf8" />
            <TextInput
              style={styles.postSearchInput}
              value={tableQuery}
              onChangeText={setTableQuery}
              placeholder="Search loaded records (File No, BA No, Owner, Mobile, Notes)..."
              placeholderTextColor="#94a3b8"
            />
            {tableQuery.length > 0 && (
              <TouchableOpacity onPress={() => setTableQuery('')}>
                <XCircle size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Records List Container */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading Day Sheet Logs...</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            <Text style={styles.countIndicator}>
              Showing [{filteredSheetLogs.length}] of [{sheetLogs.length}] Recorded Logs
            </Text>
            {filteredSheetLogs.length > 0 ? (
              filteredSheetLogs.map((log, index) => (
                <View key={index} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.fileNoText}>
                      {log.file_no} {log.b_a_number ? `(${log.b_a_number})` : ''}
                    </Text>
                    <Text style={styles.dateText}>{log.created_date} {log.created_time}</Text>
                  </View>

                  <Text style={styles.ownerText}>Owner: {log.owner}</Text>
                  
                  {log.ref_name ? (
                    <Text style={styles.refNameText}>Ref Name: {log.ref_name}</Text>
                  ) : null}

                  {log.mobile ? (
                    <View style={styles.mobileRow}>
                      <Text style={styles.mobileText}>📱 {log.mobile}</Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(log.mobile)}>
                          <Phone size={12} color="#fff" />
                          <Text style={styles.actionText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(log.mobile)}>
                          <MessageCircle size={12} color="#fff" />
                          <Text style={styles.actionText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  <Text style={styles.serviceText}>Mandal: {log.mandal} | Service: {log.service_type}</Text>
                  <Text style={styles.noteText} numberOfLines={2}>Note: {log.narrative_note}</Text>
                  
                  <View style={styles.rowBottom}>
                    <View style={styles.handlerRow}>
                      <ShieldCheck size={12} color="#10b981" />
                      <Text style={styles.handlerText}>{log.staff_name}</Text>
                    </View>
                    <Text style={styles.phaseBadge}>{log.current_phase || 'Active'}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No operational interaction logs found matching your search criteria.</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  exportButtonsRow: { flexDirection: 'row', gap: 8 },
  exportBtn: { backgroundColor: '#1e293b', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  filterCard: { backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  filterCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1e293b' },
  filterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterHeaderTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterExpandedContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12 },
  filterGrid: { gap: 12 },
  filterGroup: { gap: 5 },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  webSelect: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, border: '1px solid #334155', width: '100%', fontWeight: 'bold' } as any,
  dateInput: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInputText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  searchButton: { flex: 1, backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 13, borderRadius: 10, gap: 6 },
  searchButtonText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  resetButton: { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  postSearchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: '#334155', gap: 10 },
  postSearchInput: { flex: 1, color: '#fff', fontSize: 13, padding: 4 },
  centerContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  tableContainer: { gap: 12 },
  countIndicator: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' },
  rowCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155', gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  fileNoText: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },
  dateText: { color: '#64748b', fontSize: 10 },
  ownerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  refNameText: { color: '#38bdf8', fontSize: 11, fontWeight: '600' },
  mobileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  mobileText: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  callBtn: { backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  waBtn: { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  serviceText: { color: '#94a3b8', fontSize: 11 },
  noteText: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic', marginVertical: 2 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 },
  handlerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  handlerText: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  phaseBadge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  noDataText: { textAlign: 'center', color: '#64748b', fontSize: 12, paddingVertical: 20 },
});