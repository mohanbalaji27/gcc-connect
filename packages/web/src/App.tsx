import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  Clock,
  QrCode,
  Users,
  Video,
  Bell,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Sparkles,
  Layers,
  Compass,
} from 'lucide-react';
import {
  devLogin,
  getCurrentUser,
  logout,
  getFloors,
  getFloorDesks,
  getEvents,
  getAnnouncements,
  registerForEvent,
} from './api';
import { FloorMap } from './components/FloorMap';
import { ScanQrModal } from './components/ScanQrModal';
import { MeetingRoomsView } from './components/MeetingRoomsView';
import { MyBookingsView } from './components/MyBookingsView';
import { AdminPortalView } from './components/AdminPortalView';

export function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'rooms' | 'bookings' | 'events' | 'admin'>('home');
  const [isScanOpen, setIsScanOpen] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desks, setDesks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and load default demo user if needed
  useEffect(() => {
    async function initUser() {
      try {
        const res = await getCurrentUser();
        setCurrentUser(res.user);
      } catch {
        // Auto-login to Aarav Sharma (EMP-1001) in local dev demo mode
        const res = await devLogin('EMP-1001');
        setCurrentUser(res.user);
      } finally {
        setIsLoading(false);
      }
    }
    initUser();
  }, []);

  const loadData = async () => {
    try {
      const deskRes = await getFloorDesks('flr_zb_01', selectedDate);
      setDesks(deskRes.desks);

      const [eventsRes, annRes] = await Promise.all([getEvents(), getAnnouncements()]);
      setEvents(eventsRes.events);
      setAnnouncements(annRes.announcements);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, selectedDate]);

  const handlePersonaSwitch = async (code: string) => {
    try {
      const res = await devLogin(code);
      setCurrentUser(res.user);
    } catch (err: any) {
      alert(err.message || 'Persona switch failed');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0F275A', color: '#FFFFFF' }}>
        <div style={{ textAlign: 'center' }}>
          <Building2 size={48} color="#60A5FA" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>GCC Connect</h2>
          <p style={{ fontSize: 13, color: '#93C5FD', marginTop: 4 }}>Loading Zimmer Biomet Workplace Experience...</p>
        </div>
      </div>
    );
  }

  const isAdmin = ['SUPER_ADMIN', 'FACILITIES_ADMIN', 'EVENTS_ADMIN'].includes(currentUser?.role);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Top Demo Bar */}
      <div
        style={{
          background: '#0B1A3D',
          color: '#93C5FD',
          padding: '6px 20px',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1E3A8A',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: '#1D4ED8', color: '#FFFFFF', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
            DEMO ENVIRONMENT
          </span>
          <span>Zimmer Biomet GCC Bangalore • Tender Drawing OST-ID-TD-ANSR-ZB-01</span>
        </div>

        {/* Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#CBD5E1', fontSize: 11 }}>Switch Persona:</span>
          <select
            value={currentUser?.employeeCode || (currentUser as any)?.employee_code}
            onChange={(e) => handlePersonaSwitch(e.target.value)}
            style={{
              background: '#0F275A',
              color: '#FFFFFF',
              border: '1px solid #3B82F6',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <option value="EMP-1001">Aarav Sharma (Employee - Eng)</option>
            <option value="EMP-1002">Priya Nair (Team Coordinator - Robotics)</option>
            <option value="EMP-1003">Vikram Patel (Facilities Admin)</option>
            <option value="EMP-1004">Neha Gupta (Events Admin)</option>
            <option value="EMP-1000">Rohan Deshmukh (Super Admin & CISO)</option>
            <option value="EMP-1005">Meera Sen (Reception Admin)</option>
          </select>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Logo & Office Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1A56DB, #0F275A)',
                width: 38,
                height: 38,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 4px rgba(26, 86, 219, 0.3)',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', letterSpacing: -0.5 }}>
                  GCC Connect
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1A56DB', padding: '1px 6px', borderRadius: 4 }}>
                  ZB Bangalore
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                184 Workstations • 13 Collab & Meeting Spaces
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'home' ? '#EFF6FF' : 'transparent',
                color: activeTab === 'home' ? '#1A56DB' : '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'map' ? '#EFF6FF' : 'transparent',
                color: activeTab === 'map' ? '#1A56DB' : '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Floor Map (184 Seats)
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'rooms' ? '#EFF6FF' : 'transparent',
                color: activeTab === 'rooms' ? '#1A56DB' : '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Meeting Rooms
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'bookings' ? '#EFF6FF' : 'transparent',
                color: activeTab === 'bookings' ? '#1A56DB' : '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              My Bookings
            </button>
            <button
              onClick={() => setActiveTab('events')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'events' ? '#EFF6FF' : 'transparent',
                color: activeTab === 'events' ? '#1A56DB' : '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Events
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'admin' ? '#1A56DB' : '#0F275A',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Admin Portal
              </button>
            )}
          </nav>

          {/* User Profile & Scan Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setIsScanOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #1A56DB, #1E429F)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(26, 86, 219, 0.25)',
              }}
            >
              <QrCode size={16} /> Scan QR
            </button>

            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: 12, textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{currentUser?.name}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{currentUser?.role}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: 1280, margin: '0 auto', width: '100%', padding: '24px 20px' }}>
        {/* 1. HOME VIEW */}
        {activeTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Hero Greeting */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0F275A 0%, #1A56DB 100%)',
                borderRadius: 16,
                padding: '28px 32px',
                color: '#FFFFFF',
                boxShadow: '0 10px 20px -5px rgba(15, 39, 90, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 20,
              }}
            >
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 9999 }}>
                  Zimmer Biomet GCC Experience Hub
                </span>
                <h2 style={{ fontSize: 26, fontWeight: 800, marginTop: 10, letterSpacing: -0.5 }}>
                  Welcome back, {currentUser?.name?.split(' ')[0]} 👋
                </h2>
                <p style={{ fontSize: 14, color: '#BFDBFE', marginTop: 4, maxWidth: 540 }}>
                  Floor 1 operations layout (184 workstations, 11 departmental zones, and 13 collaboration suites) is live with real-time QR booking.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setActiveTab('map')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#FFFFFF',
                    color: '#0F275A',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Book a Desk
                </button>
                <button
                  onClick={() => setActiveTab('rooms')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.4)',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Book a Room
                </button>
              </div>
            </div>

            {/* Quick Stats & Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div
                onClick={() => setActiveTab('map')}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ background: '#EFF6FF', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A56DB' }}>
                    <Compass size={22} />
                  </div>
                  <ChevronRight size={18} color="#94A3B8" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 14 }}>
                  Floor Map & Seating
                </h4>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                  Explore 184 desks across 11 departments with interactive status & amenities.
                </p>
              </div>

              <div
                onClick={() => setIsScanOpen(true)}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ background: '#F0FDF4', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                    <QrCode size={22} />
                  </div>
                  <ChevronRight size={18} color="#94A3B8" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 14 }}>
                  Scan-to-Book QR
                </h4>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                  Instant scan on desk stickers or room doors for fast, verified reservations.
                </p>
              </div>

              <div
                onClick={() => setActiveTab('rooms')}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ background: '#FAF5FF', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE' }}>
                    <Video size={22} />
                  </div>
                  <ChevronRight size={18} color="#94A3B8" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 14 }}>
                  Meeting Suites & Cabins
                </h4>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                  Reserve 6-8 PAX video rooms, privacy pods, and the 46-seat cafeteria space.
                </p>
              </div>
            </div>

            {/* Announcements & Upcoming Events */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
              {/* Announcements Feed */}
              <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Workplace Announcements</h3>
                  <Bell size={16} color="#64748B" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: ann.severity === 'WARNING' ? '#FFFBEB' : '#F8FAFC',
                        border: ann.severity === 'WARNING' ? '1px solid #FDE68A' : '1px solid #F1F5F9',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{ann.title}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                        {ann.content}
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
                        Posted by {ann.author_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Office Events Feed */}
              <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Upcoming GCC Events</h3>
                  <Calendar size={16} color="#64748B" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#1A56DB', textTransform: 'uppercase' }}>
                          {ev.category}
                        </span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                          {ev.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {ev.date} • {ev.start_time} - {ev.end_time} • {ev.location_name}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await registerForEvent(ev.id);
                            alert('Successfully registered!');
                            loadData();
                          } catch (err: any) {
                            alert(err.message || 'Already registered');
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Register ({ev.registered_count})
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. FLOOR MAP VIEW */}
        {activeTab === 'map' && (
          <FloorMap
            desks={desks}
            date={selectedDate}
            onDateChange={setSelectedDate}
            onBookingSuccess={loadData}
            currentUser={currentUser}
          />
        )}

        {/* 3. MEETING ROOMS VIEW */}
        {activeTab === 'rooms' && <MeetingRoomsView currentUser={currentUser} />}

        {/* 4. MY BOOKINGS VIEW */}
        {activeTab === 'bookings' && <MyBookingsView />}

        {/* 5. EVENTS VIEW */}
        {activeTab === 'events' && (
          <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 24, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
              Office Community & Events Calendar
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {events.map((ev) => (
                <div key={ev.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1A56DB', textTransform: 'uppercase' }}>
                    {ev.category}
                  </span>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>{ev.title}</h4>
                  <p style={{ fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>{ev.description}</p>
                  <div style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>
                    <div>📅 {ev.date} ({ev.start_time} - {ev.end_time})</div>
                    <div>📍 {ev.location_name}</div>
                    <div>👤 Organizer: {ev.organizer_name}</div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await registerForEvent(ev.id);
                        alert('Successfully registered!');
                        loadData();
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#1A56DB',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    RSVP ({ev.registered_count} Attending)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. ADMIN PORTAL VIEW */}
        {activeTab === 'admin' && <AdminPortalView currentUser={currentUser} />}
      </main>

      {/* Camera QR Scanner Modal */}
      <ScanQrModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onSuccess={() => {
          loadData();
          setActiveTab('bookings');
        }}
        currentUser={currentUser}
      />
    </div>
  );
}
