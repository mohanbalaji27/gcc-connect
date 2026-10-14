import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  mobileDevLogin,
  mobileGetDesks,
  mobileBookDesk,
  mobileScanQr,
  mobileGetMyBookings,
  mobileCheckInBooking,
  mobileCancelBooking,
  mobileGetEvents,
  mobileGetAnnouncements,
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'desks' | 'scan' | 'bookings' | 'profile'>('home');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [desks, setDesks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Scanner state
  const [manualQrInput, setManualQrInput] = useState<string>('');
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Desk selection state
  const [selectedDesk, setSelectedDesk] = useState<any | null>(null);
  const [isBookingDesk, setIsBookingDesk] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        const res = await mobileDevLogin('EMP-1001'); // Aarav Sharma
        setCurrentUser(res.user);
      } catch {
        // fallback
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const loadData = async () => {
    try {
      const [deskRes, bookRes, evRes, annRes] = await Promise.all([
        mobileGetDesks('flr_zb_01', selectedDate),
        mobileGetMyBookings(),
        mobileGetEvents(),
        mobileGetAnnouncements(),
      ]);
      setDesks(deskRes.desks);
      setBookings(bookRes.bookings);
      setEvents(evRes.events);
      setAnnouncements(annRes.announcements);
    } catch {
      // offline or mock
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, selectedDate]);

  const handleSwitchPersona = async (code: string) => {
    setIsLoading(true);
    try {
      const res = await mobileDevLogin(code);
      setCurrentUser(res.user);
      Alert.alert('Persona Switched', `Logged in as ${res.user.name} (${res.user.role})`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveQr = async (code: string) => {
    if (!code.trim()) return;
    setIsScanning(true);
    try {
      const res = await mobileScanQr(code);
      setScanResult(res);
    } catch (err: any) {
      Alert.alert('Scan Failed', err.message || 'Unrecognized QR code');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmQrBooking = async () => {
    if (!scanResult) return;
    try {
      if (scanResult.category === 'DESK') {
        await mobileBookDesk(scanResult.resource.id, selectedDate, true);
        Alert.alert('Confirmed!', `Workstation ${scanResult.resource.code} confirmed.`);
      }
      setScanResult(null);
      setActiveTab('bookings');
      loadData();
    } catch (err: any) {
      Alert.alert('Booking Error', err.message);
    }
  };

  const handleConfirmDeskModalBooking = async () => {
    if (!selectedDesk) return;
    setIsBookingDesk(true);
    try {
      await mobileBookDesk(selectedDesk.id, selectedDate, false);
      Alert.alert('Success', `Workstation ${selectedDesk.code} reserved for ${selectedDate}.`);
      setSelectedDesk(null);
      loadData();
      setActiveTab('bookings');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Booking conflict');
    } finally {
      setIsBookingDesk(false);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      await mobileCheckInBooking(bookingId);
      Alert.alert('Checked In', 'You are checked in to your reserved workplace space.');
      loadData();
    } catch (err: any) {
      Alert.alert('Check-in Failed', err.message);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    Alert.alert('Cancel Reservation', 'Are you sure you want to release this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await mobileCancelBooking(bookingId);
            loadData();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1A56DB" />
        <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Connecting to GCC Platform...</Text>
      </View>
    );
  }

  const upcomingBookings = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F275A" />

      {/* Top Mobile Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GCC Connect</Text>
          <Text style={styles.headerSubtitle}>Zimmer Biomet Bangalore Hub (184 Workstations)</Text>
        </View>
        <TouchableOpacity style={styles.scanHeaderBtn} onPress={() => setActiveTab('scan')}>
          <Text style={styles.scanHeaderBtnText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {/* 1. HOME TAB */}
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Greeting Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroTag}>ZIMMER BIOMET GCC</Text>
              <Text style={styles.heroTitle}>Hello, {currentUser?.name?.split(' ')[0]} 👋</Text>
              <Text style={styles.heroSubtitle}>
                {currentUser?.department} • {currentUser?.team}
              </Text>

              <View style={styles.heroActions}>
                <TouchableOpacity style={styles.heroPrimaryBtn} onPress={() => setActiveTab('desks')}>
                  <Text style={styles.heroPrimaryBtnText}>Book a Desk</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroSecondaryBtn} onPress={() => setActiveTab('scan')}>
                  <Text style={styles.heroSecondaryBtnText}>Scan QR</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Today's Active Reservation Card */}
            {upcomingBookings.length > 0 ? (
              <View style={styles.activeBookingCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>Today's Reservation</Text>
                  <Text style={styles.badgeSuccess}>CONFIRMED</Text>
                </View>
                <Text style={styles.activeBookingName}>{upcomingBookings[0].resourceName}</Text>
                <Text style={styles.activeBookingTime}>
                  📅 {upcomingBookings[0].date} • {upcomingBookings[0].startTime} - {upcomingBookings[0].endTime}
                </Text>

                <TouchableOpacity
                  style={styles.checkInBtn}
                  onPress={() => handleCheckIn(upcomingBookings[0].id)}
                >
                  <Text style={styles.checkInBtnText}>Check In Now</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Announcements */}
            <Text style={styles.sectionHeading}>Workplace Announcements</Text>
            {announcements.map((ann) => (
              <View key={ann.id} style={styles.announcementCard}>
                <Text style={styles.announcementTitle}>{ann.title}</Text>
                <Text style={styles.announcementContent}>{ann.content}</Text>
                <Text style={styles.announcementAuthor}>Posted by {ann.author_name}</Text>
              </View>
            ))}

            {/* Office Events */}
            <Text style={styles.sectionHeading}>Upcoming Office Events</Text>
            {events.map((ev) => (
              <View key={ev.id} style={styles.eventCard}>
                <Text style={styles.eventCategory}>{ev.category}</Text>
                <Text style={styles.eventTitle}>{ev.title}</Text>
                <Text style={styles.eventDetails}>
                  📅 {ev.date} ({ev.start_time}) • 📍 {ev.location_name}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 2. DESKS TAB */}
        {activeTab === 'desks' && (
          <View style={{ flex: 1 }}>
            <View style={styles.filterBar}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                Floor 1 Workstations ({desks.length} Seats)
              </Text>
              <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700' }}>
                {desks.filter((d) => d.status === 'AVAILABLE').length} Available
              </Text>
            </View>

            <FlatList
              data={desks}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => {
                const isAvail = item.status === 'AVAILABLE';
                return (
                  <TouchableOpacity
                    style={[
                      styles.deskGridItem,
                      { backgroundColor: isAvail ? '#DCFCE7' : '#FEE2E2', borderColor: isAvail ? '#86EFAC' : '#FCA5A5' },
                    ]}
                    onPress={() => setSelectedDesk(item)}
                  >
                    <Text style={[styles.deskGridCode, { color: isAvail ? '#166534' : '#991B1B' }]}>
                      {item.code}
                    </Text>
                    <Text style={styles.deskGridDept} numberOfLines={1}>
                      {item.zoneName?.split(' ')[0]}
                    </Text>
                    <Text style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                      {item.hasStandingDesk ? '⚡ Standing' : 'Desk'}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* 3. SCAN QR TAB */}
        {activeTab === 'scan' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.scannerCard}>
              <View style={styles.viewfinderMock}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📷</Text>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Camera Scanner</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  Point at desk sticker or meeting room door QR code
                </Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 16 }}>
                SIMULATE CAMERA SCAN (TAP TO TEST):
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={styles.chip} onPress={() => handleResolveQr('res_dk_z001')}>
                  <Text style={styles.chipText}>Scan Desk Z001</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleResolveQr('res_dk_z042')}>
                  <Text style={styles.chipText}>Scan Desk Z042</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleResolveQr('res_rm_mr8_a')}>
                  <Text style={styles.chipText}>Scan Room 1 (8 PAX)</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 14 }}>
                OR ENTER MANUAL QR CODE:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="e.g. res_dk_z001"
                  value={manualQrInput}
                  onChangeText={setManualQrInput}
                />
                <TouchableOpacity style={styles.lookupBtn} onPress={() => handleResolveQr(manualQrInput)}>
                  <Text style={styles.lookupBtnText}>Lookup</Text>
                </TouchableOpacity>
              </View>

              {scanResult && (
                <View style={styles.scanResultBox}>
                  <Text style={styles.scanResultTitle}>
                    {scanResult.category === 'DESK' ? `Workstation ${scanResult.resource.code}` : scanResult.resource.name}
                  </Text>
                  <Text style={styles.scanResultSub}>
                    {scanResult.category === 'DESK'
                      ? `Department: ${scanResult.resource.zoneName}`
                      : `Capacity: ${scanResult.resource.capacity} PAX (VC Suite)`}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: scanResult.resource?.isAvailable ? '#166534' : '#991B1B',
                      marginTop: 4,
                    }}
                  >
                    Status: {scanResult.resource?.isAvailable ? 'Available Now' : 'Reserved'}
                  </Text>

                  {scanResult.resource?.isAvailable && (
                    <TouchableOpacity style={styles.confirmQrBtn} onPress={handleConfirmQrBooking}>
                      <Text style={styles.confirmQrBtnText}>Confirm Instant Booking</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* 4. BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionHeading}>My Reservations ({bookings.length})</Text>

            {bookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={{ color: '#64748B', textAlign: 'center' }}>No reservations yet.</Text>
              </View>
            ) : (
              bookings.map((b) => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.bookingCategory}>{b.resourceCategory}</Text>
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            b.status === 'CHECKED_IN' ? '#DCFCE7' : b.status === 'CONFIRMED' ? '#EFF6FF' : '#F1F5F9',
                          color:
                            b.status === 'CHECKED_IN' ? '#166534' : b.status === 'CONFIRMED' ? '#1E40AF' : '#64748B',
                        },
                      ]}
                    >
                      {b.status}
                    </Text>
                  </View>
                  <Text style={styles.bookingName}>{b.resourceName}</Text>
                  <Text style={styles.bookingMeta}>📅 {b.date} • 🕒 {b.startTime} - {b.endTime}</Text>
                  {b.isQrOriginated && <Text style={{ color: '#0D9488', fontSize: 11, fontWeight: '600' }}>📷 QR Scan Originated</Text>}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {b.status === 'CONFIRMED' && (
                      <TouchableOpacity style={styles.btnSmallGreen} onPress={() => handleCheckIn(b.id)}>
                        <Text style={styles.btnSmallGreenText}>Check In</Text>
                      </TouchableOpacity>
                    )}
                    {b.status !== 'CANCELLED' && (
                      <TouchableOpacity style={styles.btnSmallRed} onPress={() => handleCancelBooking(b.id)}>
                        <Text style={styles.btnSmallRedText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* 5. PROFILE TAB */}
        {activeTab === 'profile' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{currentUser?.name?.[0]}</Text>
              </View>
              <Text style={styles.profileName}>{currentUser?.name}</Text>
              <Text style={styles.profileEmail}>{currentUser?.email}</Text>
              <Text style={styles.profileRole}>{currentUser?.role}</Text>
            </View>

            <Text style={styles.sectionHeading}>Switch Persona (Demo Environment)</Text>
            <TouchableOpacity style={styles.personaBtn} onPress={() => handleSwitchPersona('EMP-1001')}>
              <Text style={styles.personaBtnText}>Aarav Sharma (Employee - Engineering)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.personaBtn} onPress={() => handleSwitchPersona('EMP-1002')}>
              <Text style={styles.personaBtnText}>Priya Nair (Team Coordinator - Robotics)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.personaBtn} onPress={() => handleSwitchPersona('EMP-1003')}>
              <Text style={styles.personaBtnText}>Vikram Patel (Facilities Admin)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.personaBtn} onPress={() => handleSwitchPersona('EMP-1004')}>
              <Text style={styles.personaBtnText}>Neha Gupta (Events Admin)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.personaBtn} onPress={() => handleSwitchPersona('EMP-1000')}>
              <Text style={styles.personaBtnText}>Rohan Deshmukh (Super Admin & CISO)</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Desk Details & Booking Modal */}
      {selectedDesk && (
        <Modal transparent animationType="slide" visible={!!selectedDesk}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.rowBetween}>
                <Text style={styles.modalTitle}>Workstation {selectedDesk.code}</Text>
                <TouchableOpacity onPress={() => setSelectedDesk(null)}>
                  <Text style={{ fontSize: 18, color: '#64748B' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Department: {selectedDesk.zoneName}</Text>
              <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
                Features: {selectedDesk.hasStandingDesk ? '⚡ Electric Standing Desk, ' : ''}
                {selectedDesk.hasDualMonitors ? 'Dual 4K Displays, ' : ''} USB-C Dock
              </Text>

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: selectedDesk.status === 'AVAILABLE' ? '#DCFCE7' : '#FEE2E2',
                    marginTop: 12,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedDesk.status === 'AVAILABLE' ? '#166534' : '#991B1B',
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {selectedDesk.status === 'AVAILABLE' ? 'Available for Booking' : 'Reserved by Colleague'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSelectedDesk(null)}>
                  <Text style={styles.modalCancelBtnText}>Close</Text>
                </TouchableOpacity>
                {selectedDesk.status === 'AVAILABLE' && (
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    disabled={isBookingDesk}
                    onPress={handleConfirmDeskModalBooking}
                  >
                    <Text style={styles.modalConfirmBtnText}>
                      {isBookingDesk ? 'Confirming...' : 'Confirm Reservation'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
          <Text style={[styles.navIcon, activeTab === 'home' && styles.navIconActive]}>🏠</Text>
          <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('desks')}>
          <Text style={[styles.navIcon, activeTab === 'desks' && styles.navIconActive]}>🪑</Text>
          <Text style={[styles.navText, activeTab === 'desks' && styles.navTextActive]}>Desks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('scan')}>
          <Text style={[styles.navIcon, activeTab === 'scan' && styles.navIconActive]}>📷</Text>
          <Text style={[styles.navText, activeTab === 'scan' && styles.navTextActive]}>Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('bookings')}>
          <Text style={[styles.navIcon, activeTab === 'bookings' && styles.navIconActive]}>📅</Text>
          <Text style={[styles.navText, activeTab === 'bookings' && styles.navTextActive]}>Bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.navIconActive]}>👤</Text>
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#0F275A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#93C5FD', fontSize: 11 },
  scanHeaderBtn: { backgroundColor: '#1A56DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  scanHeaderBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  content: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  heroCard: {
    backgroundColor: '#0F275A',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTag: { color: '#93C5FD', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 4 },
  heroSubtitle: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  heroPrimaryBtn: { backgroundColor: '#1A56DB', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  heroPrimaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  heroSecondaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  activeBookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 8 },
  badgeSuccess: { backgroundColor: '#DCFCE7', color: '#166534', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: '800' },
  activeBookingName: { fontSize: 16, fontWeight: '700', color: '#1A56DB', marginTop: 6 },
  activeBookingTime: { fontSize: 12, color: '#64748B', marginTop: 2 },
  checkInBtn: { backgroundColor: '#059669', paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginTop: 10 },
  checkInBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  announcementCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  announcementContent: { fontSize: 12, color: '#475569', marginTop: 2 },
  announcementAuthor: { fontSize: 10, color: '#94A3B8', marginTop: 6 },
  eventCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  eventCategory: { fontSize: 10, fontWeight: '800', color: '#1A56DB' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  eventDetails: { fontSize: 11, color: '#64748B', marginTop: 4 },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deskGridItem: {
    flex: 1 / 3,
    margin: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  deskGridCode: { fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  deskGridDept: { fontSize: 10, color: '#475569', marginTop: 2 },
  scannerCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  viewfinderMock: {
    backgroundColor: '#0B1A3D',
    height: 180,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  manualInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, fontSize: 13 },
  lookupBtn: { backgroundColor: '#1A56DB', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  lookupBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  scanResultBox: { backgroundColor: '#F0F5FA', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', marginTop: 14 },
  scanResultTitle: { fontSize: 16, fontWeight: '700', color: '#0F275A' },
  scanResultSub: { fontSize: 12, color: '#475569', marginTop: 2 },
  confirmQrBtn: { backgroundColor: '#1A56DB', paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginTop: 10 },
  confirmQrBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 10, alignItems: 'center' },
  bookingCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  bookingCategory: { fontSize: 10, fontWeight: '800', color: '#1A56DB' },
  bookingName: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  bookingMeta: { fontSize: 12, color: '#64748B', marginTop: 4 },
  badge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  btnSmallGreen: { backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  btnSmallGreenText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  btnSmallRed: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  btnSmallRedText: { color: '#991B1B', fontWeight: '700', fontSize: 11 },
  profileCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  profileName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  profileEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  profileRole: { fontSize: 11, fontWeight: '700', color: '#1A56DB', marginTop: 4 },
  personaBtn: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 },
  personaBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  statusPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start' },
  modalCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  modalCancelBtnText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  modalConfirmBtn: { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1A56DB', alignItems: 'center' },
  modalConfirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 18, color: '#94A3B8' },
  navIconActive: { color: '#1A56DB' },
  navText: { fontSize: 10, color: '#64748B', marginTop: 2, fontWeight: '500' },
  navTextActive: { color: '#1A56DB', fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
