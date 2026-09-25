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
  Alert
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
// expo-file-system (SDK 53+) moved cacheDirectory/writeAsStringAsync/EncodingType
// into a "legacy" subpath; the new default export uses a different File/Directory API.
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import * as XLSX from 'xlsx';
import DateTimePicker from '@react-native-community/datetimepicker';
import CONFIG from '../config';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { Calendar, ShieldCheck, Search, XCircle, FileSpreadsheet } from 'lucide-react-native';

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

// Builds a YYYY-MM-DD string from LOCAL date parts, not UTC.
// new Date().toISOString() converts to UTC first, which can silently shift
// the calendar date depending on the device's timezone (e.g. India is
// UTC+5:30) — that mismatch is why "today" could miss today's own rows.
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// @react-native-community/datetimepicker has no web implementation, so
// tapping the button did nothing in a browser. On web, render the browser's
// own native <input type="date">, same as the calendar icon on the live site.
// Built with React.createElement to avoid TSX intrinsic-element typing issues
// in a React Native project.
const WebDateInput = ({ value, onChange, style }: { value: string; onChange: (val: string) => void; style?: any }) => {
  return React.createElement('input', {
    type: 'date',
    value,
    onChange: (e: any) => onChange(e.target.value),
    style: {
      backgroundColor: '#0f172a',
      borderRadius: 8,
      padding: 10,
      color: '#fff',
      fontSize: 13,
      border: '1px solid #334155',
      width: '100%',
      colorScheme: 'dark',
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

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [filters, setFilters] = useState({
    from_date: todayStr,
    to_date: todayStr,
    file_no: '',
    mandal: '',
    service_type: '',
    handle_by: ''
  });

  useEffect(() => {
    async function loadUser() {
      const name = await storage.get('user_name');
      if (name) setUserName(name);
    }
    loadUser();
    fetchDaySheetLogs(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      console.log('fetchDaySheetLogs URL:', url.replace(CONFIG.API_KEY, '***'));

      const res = await axios.get(url, { timeout: 20000 });
      console.log('fetchDaySheetLogs response:', res.data);

      if (res.data && res.data.status === 'success') {
        setSheetLogs(res.data.data || []);
      } else {
        setSheetLogs([]);
      }
    } catch (err: any) {
      console.log('DaySheet sync critical failure:', err.message, err.response?.data);
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
    fetchDaySheetLogs(defaultCleared);
  };

  const onFromDateChange = (event: any, selectedDate?: Date) => {
    setShowFromPicker(Platform.OS === 'ios'); // iOS picker stays open inline; Android closes itself
    if (event.type === 'dismissed' || !selectedDate) return;
    handleFilterChange('from_date', toLocalDateString(selectedDate));
  };

  const onToDateChange = (event: any, selectedDate?: Date) => {
    setShowToPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selectedDate) return;
    handleFilterChange('to_date', toLocalDateString(selectedDate));
  };

  // --- MOBILE-SAFE EXCEL EXPORT HELPER ---
  // Fixed: the previous version used XLSX's "binary" output plus a manual
  // btoa() conversion. btoa() does not exist in the React Native/Hermes JS
  // engine (it's a browser/Node global), so this threw
  // "ReferenceError: btoa is not defined" on-device or in Expo Go.
  // XLSX can emit base64 directly, so we skip the manual conversion entirely.
  const handleExportToExcel = async () => {
    if (sheetLogs.length === 0) {
      Alert.alert('Empty Ledger', 'No records available to compile into Excel.');
      return;
    }
    try {
      const simplifiedRows = sheetLogs.map((log, idx) => ({
        "S.No": idx + 1,
        "Date": log.created_date,
        "Time": log.created_time,
        "File Ref": log.file_no,
        "Owner": log.owner,
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

      // Ask XLSX for base64 directly — no btoa() needed, works on native.
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

        {/* Filter Inputs Form Card */}
        <View style={styles.filterCard}>
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
            <Text style={styles.label}>File Reference No</Text>
            <TextInput
              style={styles.input}
              value={filters.file_no}
              onChangeText={val => handleFilterChange('file_no', val)}
              placeholder="Search File Ref..."
              placeholderTextColor="#94a3b8"
            />
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

        {/* Records List Container */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading Day Sheet Logs...</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            <Text style={styles.countIndicator}>Recorded Logs: [{sheetLogs.length}]</Text>
            {sheetLogs.length > 0 ? (
              sheetLogs.map((log, index) => (
                <View key={index} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.fileNoText}>{log.file_no}</Text>
                    <Text style={styles.dateText}>{log.created_date} {log.created_time}</Text>
                  </View>
                  <Text style={styles.ownerText}>Owner: {log.owner}</Text>
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
              <Text style={styles.noDataText}>No operational interaction logs found for this date criteria.</Text>
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
  exportBtn: { backgroundColor: '#1e293b', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  filterCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155', gap: 10 },
  filterGroup: { gap: 4 },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  dateInput: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInputText: { color: '#fff', fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  searchButton: { flex: 1, backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 8, gap: 6 },
  searchButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  resetButton: { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  centerContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  tableContainer: { gap: 10 },
  countIndicator: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  rowCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155', gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  fileNoText: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },
  dateText: { color: '#64748b', fontSize: 10 },
  ownerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  serviceText: { color: '#94a3b8', fontSize: 11 },
  noteText: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic', marginVertical: 4 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 },
  handlerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  handlerText: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  phaseBadge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  noDataText: { textAlign: 'center', color: '#64748b', fontSize: 12, paddingVertical: 20 },
});