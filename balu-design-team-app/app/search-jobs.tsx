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
  Linking,
  Alert
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import CONFIG from '../config';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import {
  Search, Phone, MessageCircle, Trash2,
  Filter, XCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react-native';

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

export default function SearchJobsScreen() {
  const params = useLocalSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false); // Collapsed by default

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter States
  const [filters, setFilters] = useState({
    mandal: '',
    service_type: '',
    followup_type: '',
    handle_by: '',
    verification_status: '',
    closed_type: '',
    search_query: '',
    from_date: '',
    to_date: ''
  });

  // Data Lists for Dropdowns / Selects
  const [mandalList, setMandalList] = useState<any[]>([]);
  const [serviceList, setServiceList] = useState<any[]>([]);
  const [followupList, setFollowupList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [closedTypeList, setClosedTypeList] = useState<any[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('Employee');

  useEffect(() => {
    async function loadUser() {
      const name = await storage.get('user_name');
      if (name) setUserName(name);
    }
    loadUser();
    loadDropdownDependencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useLocalSearchParams() returns a NEW object reference on every render,
  // even when the actual values are unchanged. The previous version depended
  // on [params] (the whole object), which made this effect re-fire on every
  // render -> setFilters -> re-render -> new params object -> effect fires
  // again -> infinite loop. That loop is exactly what produced
  // "Maximum update depth exceeded". Depending on individual primitive
  // values pulled out of params fixes this, since a string/undefined only
  // changes when the actual param value changes.
  const filterFromDateParam = params.filterFromDate ? String(params.filterFromDate) : undefined;
  const filterToDateParam = params.filterToDate ? String(params.filterToDate) : undefined;
  const filterClosedTypeParam = params.filterClosedType !== undefined ? String(params.filterClosedType) : undefined;
  const filterAssignedToIdParam = params.filterAssignedToId ? String(params.filterAssignedToId) : undefined;

  useEffect(() => {
    // Only run when at least one actual filter param is present. On a plain
    // mount with no params, fetchJobs(1, filters) already runs via the
    // mount effect below — no need to duplicate that call here.
    if (
      filterFromDateParam === undefined &&
      filterToDateParam === undefined &&
      filterClosedTypeParam === undefined &&
      filterAssignedToIdParam === undefined
    ) {
      return;
    }

    setFilters(prev => {
      const activeFilters = { ...prev };
      if (filterFromDateParam) activeFilters.from_date = filterFromDateParam;
      if (filterToDateParam) activeFilters.to_date = filterToDateParam;
      if (filterClosedTypeParam !== undefined) activeFilters.closed_type = filterClosedTypeParam;
      if (filterAssignedToIdParam) activeFilters.handle_by = filterAssignedToIdParam;
      fetchJobs(1, activeFilters);
      return activeFilters;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFromDateParam, filterToDateParam, filterClosedTypeParam, filterAssignedToIdParam]);

  // Plain mount fetch (no incoming filter params) — runs once.
  useEffect(() => {
    fetchJobs(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDropdownDependencies = async () => {
    try {
      const [mRes, sRes, fRes, lRes, cRes] = await Promise.all([
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_mandals&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} })),
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_main_services&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} })),
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_followup_types&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} })),
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_logins&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} })),
        axios.get(`${CONFIG.API_BASE_URL}/api.php?transac=get_closed_types&api_key=${CONFIG.API_KEY}`).catch(() => ({ data: {} }))
      ]);

      if (mRes.data?.mandals) setMandalList(mRes.data.mandals.map((m: any) => ({ value: m.name, label: m.name })));
      if (sRes.data?.services) setServiceList(sRes.data.services.map((s: any) => ({ value: s.name, label: s.name })));
      if (fRes.data?.followup_types) setFollowupList(fRes.data.followup_types.map((f: any) => ({ value: f.name, label: f.name })));
      if (lRes.data?.logins) setStaffList(lRes.data.logins.map((u: any) => ({ value: String(u.id), label: u.name })));

      if (cRes.data?.data) {
        const dynamicOptions = cRes.data.data.map((c: any) => ({ value: String(c.id), label: c.name }));
        setClosedTypeList([{ value: '0', label: 'ALL STATUSES OVERVIEW' }, ...dynamicOptions]);
      }
    } catch (err) {
      console.error("Critical directory mapping list load dropped:", err);
    }
  };

  const fetchJobs = async (page = 1, currentFilters = filters) => {
    setLoading(true);
    try {
      const sanitizedFilters: any = { ...currentFilters };
      if (sanitizedFilters.closed_type === '0') {
        sanitizedFilters.closed_type = '';
      }

      const paramsObj = new URLSearchParams({ ...sanitizedFilters, page: page.toString(), limit: '20' }).toString();
      const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=search_jobs_by_mobile&${paramsObj}`;
      console.log('fetchJobs URL:', url.replace(CONFIG.API_KEY, '***'));

      const res = await axios.get(url, { timeout: 30000 });

      setJobs(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalRecords(res.data.total_records || 0);
      setCurrentPage(page);
    } catch (err: any) {
      console.log('fetchJobs error:', err.message, err.response?.data);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    const cleared = {
      mandal: '',
      service_type: '',
      followup_type: '',
      handle_by: '',
      verification_status: '',
      closed_type: '',
      search_query: '',
      from_date: '',
      to_date: ''
    };
    setFilters(cleared);
    fetchJobs(1, cleared);
  };

  const handleDelete = (jobNo: string) => {
    Alert.alert(
      'Delete Project?',
      'This will move the record to the Recycle Bin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=delete_job&job_number=${jobNo}`;
              const res = await axios.get(url);
              if (res.data.status === 'success') {
                Alert.alert('Deleted!', 'Record archived successfully.');
                fetchJobs(currentPage);
              }
            } catch (err) {
              Alert.alert('Error', 'Action failed.');
            }
          }
        }
      ]
    );
  };

  const handleSendSMS = async (job: any) => {
    try {
      const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=send_sms_proxy&customer_mobile=${job.mobile}&customer_name=${job.owner}&job_number=${job.job_number}`;
      await axios.get(url);
      Alert.alert('Sent!', 'SMS notification has been sent.');
    } catch (err) {
      Alert.alert('Error', 'Failed to send SMS.');
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
        {/* Page Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Search Files</Text>
            <Text style={styles.pageSubtitle}>Master Project Registry | Balu Design Hub (Total: {totalRecords})</Text>
          </View>
        </View>

        {/* Quick Search Bar */}
        <View style={styles.quickSearchCard}>
          <View style={styles.searchBoxInputContainer}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={filters.search_query}
              onChangeText={(val) => handleFilterChange('search_query', val)}
              placeholder="Search File / BA No / Owner / Mobile..."
              placeholderTextColor="#94a3b8"
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={() => fetchJobs(1)}>
            <Filter size={14} color="#fff" />
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Collapsible Advanced Filters Card (Default Closed) */}
        <View style={styles.filterCard}>
          <TouchableOpacity
            style={styles.filterCardHeader}
            onPress={() => setFiltersExpanded(!filtersExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.filterHeaderLeft}>
              <Filter size={15} color="#38bdf8" />
              <Text style={styles.filterHeaderTitle}>Advanced Query Filters</Text>
            </View>
            {filtersExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
          </TouchableOpacity>

          {filtersExpanded && (
            <View style={styles.filterExpandedContent}>
              <View style={styles.filterGrid}>
                <View style={styles.filterGroup}>
                  <Text style={styles.label}>From Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, border: '1px solid #334155', width: '100%', colorScheme: 'dark', fontWeight: 'bold' } as any}
                      value={filters.from_date}
                      onChange={(e) => handleFilterChange('from_date', e.target.value)}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.from_date}
                      onChangeText={(val) => handleFilterChange('from_date', val)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>To Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, border: '1px solid #334155', width: '100%', colorScheme: 'dark', fontWeight: 'bold' } as any}
                      value={filters.to_date}
                      onChange={(e) => handleFilterChange('to_date', e.target.value)}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.to_date}
                      onChangeText={(val) => handleFilterChange('to_date', val)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Service Type</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.service_type}
                      onChange={(e) => handleFilterChange('service_type', e.target.value)}
                    >
                      <option value="">All Services</option>
                      {serviceList.map((s, i) => (
                        <option key={i} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.service_type}
                      onChangeText={(val) => handleFilterChange('service_type', val)}
                      placeholder="Service Type..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Zone / Mandal</Text>
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
                      onChangeText={(val) => handleFilterChange('mandal', val)}
                      placeholder="Mandal..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Followup Phase</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.followup_type}
                      onChange={(e) => handleFilterChange('followup_type', e.target.value)}
                    >
                      <option value="">All Followups</option>
                      {followupList.map((f, i) => (
                        <option key={i} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.followup_type}
                      onChangeText={(val) => handleFilterChange('followup_type', val)}
                      placeholder="Followup..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Work Status</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.closed_type}
                      onChange={(e) => handleFilterChange('closed_type', e.target.value)}
                    >
                      {closedTypeList.map((c, i) => (
                        <option key={i} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.closed_type}
                      onChangeText={(val) => handleFilterChange('closed_type', val)}
                      placeholder="Work Status ID..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Handle By</Text>
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
                      onChangeText={(val) => handleFilterChange('handle_by', val)}
                      placeholder="Staff ID..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.label}>Verification</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      style={styles.webSelect}
                      value={filters.verification_status}
                      onChange={(e) => handleFilterChange('verification_status', e.target.value)}
                    >
                      <option value="">All Verification</option>
                      <option value="1">Verified</option>
                      <option value="0">Not-Verified</option>
                    </select>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={filters.verification_status}
                      onChangeText={(val) => handleFilterChange('verification_status', val)}
                      placeholder="1 or 0..."
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.applyFilterBtn} onPress={() => fetchJobs(1)}>
                  <Filter size={14} color="#fff" />
                  <Text style={styles.searchBtnText}>Apply Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                  <XCircle size={18} color="#f43f5e" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Job Records List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Searching Records...</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            <Text style={styles.countIndicator}>Showing Records ({jobs.length}) of [{totalRecords}] Total</Text>

            {jobs.length > 0 ? (
              jobs.map((job, index) => (
                <View key={job.id || index} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileNoText}>{job.file_no}</Text>
                      <Text style={styles.baText}>B.A: {job.b_a_number || '---'}</Text>
                    </View>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateText}>{job.updated_date || '---'}</Text>
                    </View>
                  </View>

                  <Text style={styles.ownerText}>Owner: {job.owner}</Text>

                  {job.mobile ? (
                    <View style={styles.mobileRow}>
                      <Text style={styles.mobileText}>📱 {job.mobile}</Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(job.mobile)}>
                          <Phone size={12} color="#fff" />
                          <Text style={styles.actionText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(job.mobile)}>
                          <MessageCircle size={12} color="#fff" />
                          <Text style={styles.actionText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  <Text style={styles.serviceText}>
                    Service: {job.service_type} | Mandal: {job.mandal}
                  </Text>

                  <View style={styles.rowMiddle}>
                    <Text style={styles.followupBadge}>{job.followup_type || 'Active'}</Text>
                    <Text style={[styles.statusBadge, Number(job.closed_type) === 0 ? styles.statusAmber : styles.statusSlate]}>
                      {job.closed_status_display || 'In Process'}
                    </Text>
                  </View>

                  <View style={styles.rowBottom}>
                    <Text style={styles.handlerText}>Handler: {job.assaigned_to_name || '---'}</Text>
                    <Text style={[styles.daysBadge, Number(job.days_count) > 15 ? styles.textRed : styles.textGreen]}>
                      {job.days_count || 0} Days
                    </Text>
                  </View>

                  {/* Actions Bar */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleSendSMS(job)}>
                      <MessageCircle size={14} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(job.job_number)}>
                      <Trash2 size={14} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No matching records found.</Text>
            )}

            {/* Pagination Bar */}
            <View style={styles.paginationRow}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => fetchJobs(currentPage - 1)}
                style={[styles.pageNavBtn, currentPage === 1 && { opacity: 0.3 }]}
              >
                <ChevronLeft size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.pageInfoText}>Page {currentPage} of {totalPages}</Text>
              <TouchableOpacity
                disabled={currentPage === totalPages}
                onPress={() => fetchJobs(currentPage + 1)}
                style={[styles.pageNavBtn, currentPage === totalPages && { opacity: 0.3 }]}
              >
                <ChevronRight size={16} color="#fff" />
              </TouchableOpacity>
            </View>
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
  headerRow: { marginBottom: 12 },
  pageTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  pageSubtitle: { color: '#94a3b8', fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  quickSearchCard: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  searchBoxInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155', gap: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, paddingVertical: 10 },
  searchBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  searchBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  filterCard: { backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  filterCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1e293b' },
  filterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterHeaderTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterExpandedContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12 },
  filterGrid: { gap: 10 },
  filterGroup: { gap: 4 },
  label: { color: '#94a3b8', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  webSelect: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, border: '1px solid #334155', width: '100%', fontWeight: 'bold' } as any,
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  applyFilterBtn: { flex: 1, backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12, borderRadius: 10 },
  resetBtn: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  centerContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  tableContainer: { gap: 12 },
  countIndicator: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  rowCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155', gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fileNoText: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },
  baText: { color: '#64748b', fontSize: 10 },
  dateBadge: { backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dateText: { color: '#94a3b8', fontSize: 10 },
  ownerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  mobileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  mobileText: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  callBtn: { backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  waBtn: { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  serviceText: { color: '#94a3b8', fontSize: 11 },
  rowMiddle: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  followupBadge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  statusBadge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  statusAmber: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
  statusSlate: { backgroundColor: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 },
  handlerText: { color: '#cbd5e1', fontSize: 10, fontWeight: 'bold' },
  daysBadge: { fontSize: 10, fontWeight: '900' },
  textRed: { color: '#f43f5e' },
  textGreen: { color: '#10b981' },
  cardActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  iconBtn: { backgroundColor: '#0f172a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  noDataText: { textAlign: 'center', color: '#64748b', fontSize: 12, paddingVertical: 20 },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginTop: 10 },
  pageNavBtn: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 8 },
  pageInfoText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});