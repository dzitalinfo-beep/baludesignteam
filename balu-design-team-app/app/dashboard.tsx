import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import axios from 'axios';
import CONFIG from '../config';
import {
  Layers, Clock, ArrowUpRight, FileText,
  IndianRupee, TrendingUp, CheckCircle,
  ArrowDownRight, Landmark, Briefcase, Wallet, Users, Target,
  MapPin, LogIn, LogOut
} from 'lucide-react-native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';

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

type FinanceInfo = { received: number; disbursed: number; balance: number };
type CardStats = { ba_oc: number; other_services: number; rera: number; builder_licence: number };
type StaffFlow = { id?: string; name?: string; file_count?: number };
type DynamicStat = { id?: string | number; name?: string; total?: number };
type ChartPoint = { month?: string; credit?: number; debit?: number };
type TrendPoint = { created_date?: string; count?: number };

export default function DashboardScreen() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [data, setData] = useState<any>(null);

  const [currentUserType, setCurrentUserType] = useState('0');
  const [currentLoginFileType, setCurrentLoginFileType] = useState('0');
  const [userId, setUserId] = useState('0');
  const [userName, setUserName] = useState('Employee');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Attendance / punch state
  const [attendance, setAttendance] = useState<any>(null);
  const [punchedIn, setPunchedIn] = useState(false);
  const [staffMode, setStaffMode] = useState<'Office' | 'Field'>('Office');
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [punchActionLoading, setPunchActionLoading] = useState(false);

  // ---- Load session info on mount ----
  useEffect(() => {
    (async () => {
      const [storedUserType, storedFileType, storedId, storedName] = await Promise.all([
        storage.get('user_type'),
        storage.get('login_file_type'),
        storage.get('user_id'),
        storage.get('user_name'),
      ]);
      if (storedUserType) setCurrentUserType(storedUserType);
      if (storedFileType) setCurrentLoginFileType(storedFileType);
      if (storedId) setUserId(storedId);
      if (storedName) setUserName(storedName);
    })();
  }, []);

  const handleLogout = async () => {
    await storage.remove('user_type');
    await storage.remove('login_file_type');
    await storage.remove('user_id');
    await storage.remove('user_name');
    await storage.remove('isAuthenticated');
    router.replace('/');
  };

  // ---- Dashboard stats ----
  const fetchStats = async (isFirstLoad = false) => {
    if (userId === '0') return;
    if (isFirstLoad) setIsInitialLoading(true);
    else setIsUpdating(true);

    const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=get_dashboard_stats&user_id=${userId}&user_type=${currentUserType}&month_offset=${monthOffset}`;

    try {
      const res = await axios.get(url, { timeout: 20000 });
      if (res?.data?.status === 'success') {
        setData(res.data);
      }
    } catch (err: any) {
      console.log('Dashboard fetch error:', err.message);
    } finally {
      setIsInitialLoading(false);
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (userId !== '0') {
      fetchStats(data === null);
    }
  }, [monthOffset, userId]);

  // ---- Attendance ----
  const getCoordinates = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance verification.');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const current = { lat: location.coords.latitude, lng: location.coords.longitude };
      setCoords(current);
      return current;
    } catch (err) {
      console.log('GPS error:', err);
      return null;
    }
  };

  const syncAttendanceState = async () => {
    if (userId === '0') return;
    const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=get_attendance_state&user_id=${userId}`;
    try {
      const res = await axios.get(url, { timeout: 20000 });
      if (res.data?.status === 'success') {
        setAttendance(res.data.data);
        setPunchedIn(res.data.has_punched_in);
        if (res.data.data) setStaffMode(res.data.data.staff_mode);
      }
    } catch (err: any) {
      console.log('Attendance sync error:', err.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const transmitLiveLocationBreadcrumb = async (lat: number, lng: number) => {
    if (!lat || !lng || userId === '0') return;
    try {
      await axios.post(
        `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=push_live_location`,
        { user_id: parseInt(userId), staff_name: userName, latitude: lat, longitude: lng, battery_level: 'Active' },
        { timeout: 20000 }
      );
    } catch (err: any) {
      console.log('Failed to push live breadcrumb trace:', err.message);
    }
  };

  const executePunch = async (type: 'IN' | 'OUT') => {
    setPunchActionLoading(true);
    try {
      const currentCoords = await getCoordinates();
      if (!currentCoords || currentCoords.lat === null || currentCoords.lng === null) {
        Alert.alert('GPS Error', 'Unable to fetch precise device coordinates.');
        return;
      }

      const payload = {
        user_id: parseInt(userId),
        staff_name: userName,
        punch_type: type,
        staff_mode: staffMode,
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        device_type: 'Mobile'
      };

      const res = await axios.post(
        `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=process_staff_punch`,
        payload,
        { timeout: 20000 }
      );

      if (res.data?.status === 'success') {
        Alert.alert('Success', res.data.message);
        if (type === 'IN' && staffMode === 'Field') {
          await transmitLiveLocationBreadcrumb(currentCoords.lat, currentCoords.lng);
        }
        syncAttendanceState();
      } else {
        Alert.alert('Declined', res.data?.message || 'Verification pipeline rejected action.');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Network error while processing punch action.');
    } finally {
      setPunchActionLoading(false);
    }
  };

  useEffect(() => {
    if (userId !== '0') {
      syncAttendanceState();
      getCoordinates();
    }
  }, [userId]);

  const goToSearchJobs = (params: Record<string, string>) => {
    router.push({ pathname: '/search-jobs', params });
  };

  const handleJobCardClick = (filterValue: string) => goToSearchJobs({ filterClosedType: filterValue });
  const handleStaffFlowClick = (staffId?: string) => {
    if (staffId) goToSearchJobs({ filterAssignedToId: staffId });
  };
  const handleTrendBarClick = (createdDate?: string) => {
    if (createdDate) goToSearchJobs({ filterFromDate: createdDate, filterToDate: createdDate });
  };

  if (isInitialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const totalJobs = Number(data?.total_jobs || 0);
  const inProcess = Number(data?.in_process || 0);
  const dynamicStats: DynamicStat[] = Array.isArray(data?.dynamic_stats) ? data.dynamic_stats : [];
  const loginFlows: StaffFlow[] = Array.isArray(data?.login_flows) ? data.login_flows : [];
  const finance: FinanceInfo = data?.finance || { received: 0, disbursed: 0, balance: 0 };
  const statCards: CardStats = data?.cards || { ba_oc: 0, other_services: 0, rera: 0, builder_licence: 0 };

  const maxStaffFiles = loginFlows.length > 0 ? Math.max(...loginFlows.map(s => Number(s.file_count || 0)), 1) : 1;

  const chartData: ChartPoint[] = Array.isArray(data?.chart)
    ? data.chart.map((c: any) => ({ ...c, credit: Number(c.credit || 0), debit: Number(c.debit || 0) }))
    : [];
  const dailyTrends: TrendPoint[] = Array.isArray(data?.daily_trends)
    ? data.daily_trends.map((d: any) => ({ ...d, count: Number(d.count || 0) }))
    : [];

  const currentMonthTotal = Number(data?.current_month_total || 0);
  const prevMonthTotal = Number(data?.prev_month_total || 0);
  const percentChange = prevMonthTotal > 0 ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  const jobCards = [
    { title: 'TOTAL JOBS', value: totalJobs, iconBg: '#2563eb', icon: <Layers size={14} color="#fff" />, filterId: 'all' },
    { title: 'IN PROCESS', value: inProcess, iconBg: '#f59e0b', icon: <Clock size={14} color="#fff" />, filterId: '0' },
    ...dynamicStats.map((item, idx) => ({
      title: (item?.name || 'N/A').toUpperCase(),
      value: Number(item?.total || 0),
      iconBg: idx % 2 === 0 ? '#059669' : '#9333ea',
      icon: <CheckCircle size={14} color="#fff" />,
      filterId: item?.id?.toString() || ''
    })),
  ];

  const paymentCards = [
    { title: 'TOTAL RECEIVED', value: `₹${Number(finance.received || 0).toLocaleString()}`, bg: '#ecfdf5', iconBg: '#059669', icon: <TrendingUp size={14} color="#fff" /> },
    { title: 'TOTAL PAYMENTS', value: `₹${Number(finance.disbursed || 0).toLocaleString()}`, bg: '#fff1f2', iconBg: '#f43f5e', icon: <ArrowDownRight size={14} color="#fff" /> },
    { title: 'PENDING BALANCE', value: `₹${Number(finance.balance || 0).toLocaleString()}`, bg: '#eef2ff', iconBg: '#4f46e5', icon: <IndianRupee size={14} color="#fff" /> },
  ];

  const maxTrendCount = Math.max(...dailyTrends.map(d => d.count || 0), 1);
  const maxChartVal = Math.max(...chartData.flatMap(c => [c.credit || 0, c.debit || 0]), 1);

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

        {/* ATTENDANCE PUNCH PANEL */}
        <View style={styles.card}>
          <View style={styles.attendanceTopRow}>
            <View style={[styles.dot, { backgroundColor: punchedIn ? '#10b981' : '#f43f5e' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attendanceStatus}>
                {attendanceLoading ? 'Checking attendance...' : (punchedIn ? `Active Shift (${staffMode} Mode)` : 'Shift Closed / Not Punched In')}
              </Text>
              <View style={styles.gpsRow}>
                <MapPin size={11} color="#94a3b8" />
                <Text style={styles.gpsText}>
                  {coords.lat ? `${coords.lat.toFixed(5)}, ${coords.lng!.toFixed(5)}` : 'Acquiring location...'}
                </Text>
              </View>
            </View>
          </View>

          {!punchedIn && (
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeButton, staffMode === 'Office' && styles.activeModeButton]}
                onPress={() => setStaffMode('Office')}
              >
                <Text style={[styles.modeButtonText, staffMode === 'Office' && styles.activeModeButtonText]}>In-Office</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, staffMode === 'Field' && styles.activeModeButton]}
                onPress={() => setStaffMode('Field')}
              >
                <Text style={[styles.modeButtonText, staffMode === 'Field' && styles.activeModeButtonText]}>Field Staff</Text>
              </TouchableOpacity>
            </View>
          )}

          {attendance && (
            <View style={styles.attendanceHistoryRow}>
              <Text style={styles.historyMini}>In: {attendance.punch_in_time || '---'}</Text>
              <Text style={styles.historyMini}>Out: {attendance.punch_out_time || 'Active'}</Text>
            </View>
          )}

          {!punchedIn ? (
            <TouchableOpacity
              style={[styles.punchButton, { backgroundColor: '#10b981' }]}
              onPress={() => executePunch('IN')}
              disabled={punchActionLoading || attendanceLoading}
            >
              {punchActionLoading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.punchButtonInner}>
                  <LogIn size={14} color="#fff" />
                  <Text style={styles.punchButtonText}>Punch In</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.punchButton, { backgroundColor: '#f43f5e' }]}
              onPress={() => executePunch('OUT')}
              disabled={punchActionLoading || attendanceLoading}
            >
              {punchActionLoading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.punchButtonInner}>
                  <LogOut size={14} color="#fff" />
                  <Text style={styles.punchButtonText}>Punch Out</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          {currentLoginFileType === '0' && (
            <>
              <View style={[styles.statTile, { borderColor: '#c7d2fe' }]}>
                <View>
                  <Text style={[styles.statLabel, { color: '#6366f1' }]}>BA/OC Files</Text>
                  <Text style={[styles.statValue, { color: '#4f46e5' }]}>{statCards.ba_oc || 0}</Text>
                </View>
                <View style={[styles.statIconBg, { backgroundColor: '#eef2ff' }]}>
                  <Briefcase size={14} color="#4f46e5" />
                </View>
              </View>
              <View style={[styles.statTile, { borderColor: '#a7f3d0' }]}>
                <View>
                  <Text style={[styles.statLabel, { color: '#10b981' }]}>Other Services</Text>
                  <Text style={[styles.statValue, { color: '#059669' }]}>{statCards.other_services || 0}</Text>
                </View>
                <View style={[styles.statIconBg, { backgroundColor: '#ecfdf5' }]}>
                  <Layers size={14} color="#059669" />
                </View>
              </View>
            </>
          )}

          {(currentUserType === '1' || currentLoginFileType === '1') && (
            <View style={[styles.statTile, { borderColor: '#ddd6fe' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#8b5cf6' }]}>RERA Files</Text>
                <Text style={[styles.statValue, { color: '#7c3aed' }]}>{statCards.rera || 0}</Text>
              </View>
              <View style={[styles.statIconBg, { backgroundColor: '#f5f3ff' }]}>
                <Target size={14} color="#7c3aed" />
              </View>
            </View>
          )}

          {currentLoginFileType === '0' && (
            <View style={[styles.statTile, { borderColor: '#fde68a' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#f59e0b' }]}>Builder Licence</Text>
                <Text style={[styles.statValue, { color: '#d97706' }]}>{statCards.builder_licence || 0}</Text>
              </View>
              <View style={[styles.statIconBg, { backgroundColor: '#fffbeb' }]}>
                <FileText size={14} color="#d97706" />
              </View>
            </View>
          )}
        </View>

        {/* PROJECT ENROLLMENT */}
        <View style={styles.card}>
          <View style={styles.panelHeaderRow}>
            <Briefcase size={16} color="#4f46e5" />
            <Text style={styles.panelHeaderText}>Project Enrollment Trend</Text>
          </View>
          <View style={styles.jobCardsWrap}>
            {jobCards.map((item, idx) => {
              const maxVal = Math.max(...jobCards.map(j => j.value), 1);
              const barHeight = 8 + (item.value / maxVal) * 60;
              return (
                <TouchableOpacity key={idx} style={styles.jobCardTile} onPress={() => handleJobCardClick(item.filterId)}>
                  <View style={styles.jobCardBarTrack}>
                    <View style={[styles.jobCardBar, { height: barHeight, backgroundColor: item.iconBg }]} />
                  </View>
                  <Text style={styles.jobCardValue}>{item.value}</Text>
                  <Text style={styles.jobCardTitle}>{item.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ACCOUNTS & PAYMENTS */}
        {currentUserType === '1' && (
          <View style={styles.card}>
            <View style={styles.panelHeaderRow}>
              <Wallet size={16} color="#059669" />
              <Text style={styles.panelHeaderText}>Accounts & Payments</Text>
            </View>
            {paymentCards.map((pcard, i) => (
              <View key={i} style={[styles.paymentRow, { backgroundColor: pcard.bg }]}>
                <View style={[styles.paymentIconBg, { backgroundColor: pcard.iconBg }]}>{pcard.icon}</View>
                <View>
                  <Text style={styles.paymentLabel}>{pcard.title}</Text>
                  <Text style={styles.paymentValue}>{pcard.value}</Text>
                </View>
                <ArrowUpRight size={12} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
              </View>
            ))}
          </View>
        )}

        {/* NEW APPLICATIONS */}
        <View style={[styles.card, isUpdating && { opacity: 0.6 }]}>
          <View style={styles.newAppsHeaderRow}>
            <Text style={styles.panelHeaderTextPlain}>New Applications ({data?.selected_month})</Text>
            <View style={styles.monthNavRow}>
              <TouchableOpacity onPress={() => setMonthOffset(p => p + 1)} style={styles.monthNavBtn}>
                <Text style={styles.monthNavBtnText}>{'<'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={monthOffset === 0}
                onPress={() => setMonthOffset(p => Math.max(0, p - 1))}
                style={[styles.monthNavBtn, monthOffset === 0 && { opacity: 0.3 }]}
              >
                <Text style={styles.monthNavBtnText}>{'>'}</Text>
              </TouchableOpacity>
              <View style={[styles.percentPill, { backgroundColor: percentChange >= 0 ? '#ecfdf5' : '#fff1f2' }]}>
                {percentChange >= 0 ? <ArrowUpRight size={10} color="#059669" /> : <ArrowDownRight size={10} color="#f43f5e" />}
                <Text style={[styles.percentPillText, { color: percentChange >= 0 ? '#059669' : '#f43f5e' }]}>
                  {Math.abs(percentChange).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.trendBarsRow}>
            {dailyTrends.map((d, idx) => (
              <TouchableOpacity key={idx} style={styles.trendBarCol} onPress={() => handleTrendBarClick(d.created_date)}>
                <Text style={styles.trendBarCount}>{d.count}</Text>
                <View style={styles.trendBarTrack}>
                  <View style={[styles.trendBar, { height: 6 + ((d.count || 0) / maxTrendCount) * 70 }]} />
                </View>
                <Text style={styles.trendBarLabel}>{d.created_date}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* CASHFLOW TREND */}
        {currentUserType === '1' && (
          <View style={styles.card}>
            <View style={styles.cashflowHeaderRow}>
              <Text style={styles.panelHeaderTextPlain}>Cashflow Trend</Text>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#4f46e5' }]} /><Text style={styles.legendText}>CR</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#c7d2fe' }]} /><Text style={styles.legendText}>DR</Text></View>
              </View>
            </View>
            <View style={styles.trendBarsRow}>
              {chartData.map((c, idx) => (
                <View key={idx} style={styles.cashflowCol}>
                  <View style={styles.cashflowBarsGroup}>
                    <View style={[styles.cashflowBar, { height: 4 + ((c.credit || 0) / maxChartVal) * 70, backgroundColor: '#4f46e5' }]} />
                    <View style={[styles.cashflowBar, { height: 4 + ((c.debit || 0) / maxChartVal) * 70, backgroundColor: '#c7d2fe' }]} />
                  </View>
                  <Text style={styles.trendBarLabel}>{c.month}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* STAFF FILE FLOW */}
        {currentUserType === '1' && (
          <View style={styles.staffFlowCard}>
            <View style={styles.staffFlowHeaderRow}>
              <View style={styles.panelHeaderRow}>
                <Users size={15} color="#818cf8" />
                <Text style={styles.staffFlowHeaderText}>Staff File Flow</Text>
              </View>
              <View style={styles.liveQueuePill}>
                <Text style={styles.liveQueuePillText}>Live Queue</Text>
              </View>
            </View>

            {loginFlows.length > 0 ? (
              loginFlows.map((staff, index) => {
                const fileCount = Number(staff.file_count || 0);
                const percentageWidth = Math.min((fileCount / maxStaffFiles) * 100, 100);
                return (
                  <TouchableOpacity
                    key={staff.id || index}
                    style={styles.staffRow}
                    onPress={() => handleStaffFlowClick(staff.id)}
                  >
                    <View style={styles.staffRowTop}>
                      <View style={styles.staffRowLeft}>
                        <View style={styles.staffAvatar}>
                          <Text style={styles.staffAvatarText}>{staff.name ? staff.name.substring(0, 2).toUpperCase() : 'ST'}</Text>
                        </View>
                        <Text style={styles.staffName}>{staff.name || 'Unknown Staff'}</Text>
                      </View>
                      <View style={styles.staffRowRight}>
                        <Text style={styles.staffFileCount}>{fileCount} {fileCount === 1 ? 'File' : 'Files'}</Text>
                        <ArrowUpRight size={11} color="#475569" />
                      </View>
                    </View>
                    <View style={styles.staffBarTrack}>
                      <View style={[styles.staffBar, { width: `${percentageWidth}%` }]} />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noStaffText}>No active workflow parameters found</Text>
            )}

            <View style={styles.queueFooterRow}>
              <Text style={styles.queueFooterText}>Queue Overview</Text>
              <Text style={styles.queueFooterText}>Active Staff: {loginFlows.length}</Text>
            </View>
            <Landmark size={80} color="rgba(255,255,255,0.05)" style={styles.landmarkIcon} />
          </View>
        )}

        <Footer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  contentContainer: { padding: 16, paddingTop: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  attendanceTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  attendanceStatus: { fontSize: 12, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  gpsText: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  modeToggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 12 },
  modeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeModeButton: { backgroundColor: '#4f46e5' },
  modeButtonText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  activeModeButtonText: { color: '#fff' },
  attendanceHistoryRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  historyMini: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  punchButton: { padding: 14, borderRadius: 12, alignItems: 'center' },
  punchButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punchButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: {
    width: '47%',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  statIconBg: { padding: 8, borderRadius: 8 },

  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  panelHeaderText: { fontSize: 12, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' },
  panelHeaderTextPlain: { fontSize: 12, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' },

  jobCardsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  jobCardTile: { alignItems: 'center', width: '22%' },
  jobCardBarTrack: { height: 70, justifyContent: 'flex-end' },
  jobCardBar: { width: 20, borderRadius: 4 },
  jobCardValue: { fontSize: 13, fontWeight: '900', color: '#1e293b', marginTop: 6 },
  jobCardTitle: { fontSize: 8, fontWeight: '700', color: '#94a3b8', textAlign: 'center', marginTop: 2 },

  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, marginBottom: 8 },
  paymentIconBg: { padding: 8, borderRadius: 8 },
  paymentLabel: { fontSize: 8, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', opacity: 0.8 },
  paymentValue: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginTop: 2 },

  newAppsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthNavBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  monthNavBtnText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  percentPill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 20 },
  percentPillText: { fontSize: 9, fontWeight: '800' },

  trendBarsRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  trendBarCol: { alignItems: 'center', flex: 1 },
  trendBarCount: { fontSize: 9, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  trendBarTrack: { height: 76, justifyContent: 'flex-end' },
  trendBar: { width: 18, borderRadius: 4, backgroundColor: '#10b981' },
  trendBarLabel: { fontSize: 8, fontWeight: '700', color: '#94a3b8', marginTop: 4 },

  cashflowHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  legendRow: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 8, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' },
  cashflowCol: { alignItems: 'center', flex: 1 },
  cashflowBarsGroup: { flexDirection: 'row', gap: 3, height: 76, alignItems: 'flex-end' },
  cashflowBar: { width: 10, borderRadius: 3 },

  staffFlowCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 16, overflow: 'hidden' },
  staffFlowHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  staffFlowHeaderText: { color: '#818cf8', fontWeight: '900', fontSize: 10, textTransform: 'uppercase' },
  liveQueuePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  liveQueuePillText: { fontSize: 8, fontWeight: '900', color: '#818cf8', textTransform: 'uppercase' },
  staffRow: { backgroundColor: 'rgba(30,41,59,0.3)', borderRadius: 12, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(30,41,59,0.4)' },
  staffRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  staffRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  staffAvatar: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  staffAvatarText: { color: '#fff', fontWeight: '900', fontSize: 9 },
  staffName: { color: '#e2e8f0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  staffRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  staffFileCount: { fontSize: 9, fontWeight: '900', color: '#a5b4fc', backgroundColor: '#1e1b4b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  staffBarTrack: { width: '100%', backgroundColor: '#020617', borderRadius: 10, height: 4, overflow: 'hidden' },
  staffBar: { backgroundColor: '#6366f1', height: '100%', borderRadius: 10 },
  noStaffText: { textAlign: 'center', paddingVertical: 24, color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  queueFooterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#1e293b' },
  queueFooterText: { fontSize: 8, color: '#64748b', fontWeight: '800', textTransform: 'uppercase' },
  landmarkIcon: { position: 'absolute', right: -4, bottom: -4 },
});