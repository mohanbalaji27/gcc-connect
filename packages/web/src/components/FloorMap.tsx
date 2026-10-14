import React, { useState } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Monitor,
  ArrowUpRight,
  Accessibility,
  Building2,
  Calendar,
  Users,
} from 'lucide-react';
import { createDeskBooking } from '../api';

interface FloorMapProps {
  desks: any[];
  date: string;
  onDateChange: (newDate: string) => void;
  onBookingSuccess: () => void;
  currentUser: any;
}

export const FloorMap: React.FC<FloorMapProps> = ({
  desks,
  date,
  onDateChange,
  onBookingSuccess,
  currentUser,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [filterStandingOnly, setFilterStandingOnly] = useState<boolean>(false);
  const [filterAccessibleOnly, setFilterAccessibleOnly] = useState<boolean>(false);
  const [selectedDesk, setSelectedDesk] = useState<any | null>(null);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Department list from the 184-seat seating plan
  const departments = [
    'ALL',
    'Manufacturing Engineering',
    'Engineering Services team',
    'Sustaining Engineering',
    'Robotics Engineering',
    'Quality & Regulatory Affairs',
    'Information Technology',
    'Facilities, Transport',
    'Procurement',
    'Clinical Affairs',
    'Human Resources',
    'Finance',
  ];

  const filteredDesks = desks.filter((d) => {
    const matchesSearch =
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.zoneName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.designatedTeam && d.designatedTeam.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = selectedDept === 'ALL' || d.zoneName.includes(selectedDept) || selectedDept.includes(d.zoneName);
    const matchesStanding = !filterStandingOnly || d.hasStandingDesk;
    const matchesAccessible = !filterAccessibleOnly || d.isAccessible;

    return matchesSearch && matchesDept && matchesStanding && matchesAccessible;
  });

  const availableCount = desks.filter((d) => d.status === 'AVAILABLE').length;
  const bookedCount = desks.filter((d) => d.status === 'BOOKED').length;

  const handleDeskClick = (desk: any) => {
    setSelectedDesk(desk);
    setBookingMessage(null);
  };

  const handleConfirmBooking = async () => {
    if (!selectedDesk) return;
    setIsBooking(true);
    setBookingMessage(null);

    try {
      await createDeskBooking(selectedDesk.id, date, false);
      setBookingMessage({
        type: 'success',
        text: `Workstation ${selectedDesk.code} successfully reserved for ${date}!`,
      });
      setTimeout(() => {
        onBookingSuccess();
        setSelectedDesk(null);
      }, 1400);
    } catch (err: any) {
      setBookingMessage({
        type: 'error',
        text: err.message || 'Failed to reserve workstation.',
      });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Controls Bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F1F5F9', padding: '6px 12px', borderRadius: 8 }}>
            <Calendar size={16} color="#475569" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Booking Date:</span>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => onDateChange(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                color: '#0F172A',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Search box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F1F5F9', padding: '6px 12px', borderRadius: 8, minWidth: 200 }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              placeholder="Search desk (e.g. Z042, Robotics)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                outline: 'none',
                width: '100%',
              }}
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              fontSize: 13,
              fontWeight: 500,
              color: '#334155',
            }}
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'ALL' ? 'All Departments (184 Workstations)' : dept}
              </option>
            ))}
          </select>
        </div>

        {/* Zoom & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setFilterStandingOnly(!filterStandingOnly)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: filterStandingOnly ? '1px solid #1A56DB' : '1px solid #CBD5E1',
              background: filterStandingOnly ? '#EFF6FF' : '#FFFFFF',
              color: filterStandingOnly ? '#1A56DB' : '#475569',
            }}
          >
            Standing Desk
          </button>
          <button
            onClick={() => setFilterAccessibleOnly(!filterAccessibleOnly)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: filterAccessibleOnly ? '1px solid #1A56DB' : '1px solid #CBD5E1',
              background: filterAccessibleOnly ? '#EFF6FF' : '#FFFFFF',
              color: filterAccessibleOnly ? '#1A56DB' : '#475569',
            }}
          >
            Accessible
          </button>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.15, 2.0))}
            title="Zoom In"
            style={{ padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer' }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.6))}
            title="Zoom Out"
            style={{ padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer' }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setScale(1)}
            title="Reset Zoom"
            style={{ padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Legend & Stats */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          background: '#FFFFFF',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 600, color: '#0F172A' }}>Zimmer Biomet Bangalore Hub (Drawing OST-ID-TD-ANSR-ZB-01):</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#22C55E' }} />
          <span>Available ({availableCount})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#EF4444' }} />
          <span>Reserved ({bookedCount})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#2563EB' }} />
          <span>Selected</span>
        </div>
        <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: 12 }}>
          Showing {filteredDesks.length} of {desks.length} workstations
        </span>
      </div>

      {/* Interactive Floor Plan Canvas */}
      <div
        style={{
          position: 'relative',
          background: '#F8FAFC',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          overflow: 'auto',
          minHeight: 650,
          maxHeight: 750,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            transition: 'transform 0.15s ease-out',
            width: 1050,
            height: 980,
            padding: 20,
          }}
        >
          <svg width="1000" height="920" viewBox="0 0 1000 920" style={{ background: '#FFFFFF', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
            {/* Background Grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F1F5F9" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1000" height="920" fill="url(#grid)" />

            {/* Architectural Outer Boundary based on ANSR-ZB layout */}
            <path
              d="M 50 180 L 220 50 L 520 50 L 680 50 L 800 180 L 720 340 L 480 580 L 420 900 L 60 900 L 60 400 Z"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="4"
              strokeDasharray="4 2"
            />

            {/* Top Center: Lift Lobby (6 x 25 PAX Lifts) */}
            <g transform="translate(480, 55)">
              <rect width="210" height="70" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" rx="4" />
              <text x="105" y="24" textAnchor="middle" fill="#0F172A" fontSize="11" fontWeight="700">
                LIFT LOBBY (6 x 25 PAX)
              </text>
              <rect x="15" y="32" width="25" height="28" fill="#E2E8F0" stroke="#64748B" rx="2" />
              <rect x="45" y="32" width="25" height="28" fill="#E2E8F0" stroke="#64748B" rx="2" />
              <rect x="75" y="32" width="25" height="28" fill="#E2E8F0" stroke="#64748B" rx="2" />
              <rect x="110" y="32" width="25" height="28" fill="#E2E8F0" stroke="#64748B" rx="2" />
              <rect x="140" y="32" width="25" height="28" fill="#E2E8F0" stroke="#64748B" rx="2" />
              <rect x="170" y="32" width="25" height="28" fill="#E2E8F0" stroke="#64748B" rx="2" />
            </g>

            {/* Reception & Coffee Station */}
            <g transform="translate(480, 135)">
              <rect width="210" height="45" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" rx="4" />
              <text x="105" y="26" textAnchor="middle" fill="#92400E" fontSize="11" fontWeight="700">
                RECEPTION & COFFEE BAR
              </text>
            </g>

            {/* Cabins & Meeting Rooms Corridor (Left/Mid) */}
            <g transform="translate(70, 220)">
              {/* Cabin 1 */}
              <rect x="0" y="0" width="80" height="45" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.5" rx="3" />
              <text x="40" y="26" textAnchor="middle" fill="#1E293B" fontSize="10" fontWeight="600">
                Cabin 1
              </text>

              {/* Cabin 2 */}
              <rect x="90" y="0" width="80" height="45" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.5" rx="3" />
              <text x="130" y="26" textAnchor="middle" fill="#1E293B" fontSize="10" fontWeight="600">
                Cabin 2
              </text>

              {/* Meeting Room 1 (8 PAX) */}
              <rect x="180" y="0" width="100" height="65" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" rx="4" />
              <text x="230" y="28" textAnchor="middle" fill="#1E40AF" fontSize="10" fontWeight="700">
                Meeting Room 1
              </text>
              <text x="230" y="44" textAnchor="middle" fill="#1E40AF" fontSize="9">
                (8 PAX - VC & WB)
              </text>

              {/* Meeting Room 2 (8 PAX) */}
              <rect x="290" y="0" width="100" height="65" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" rx="4" />
              <text x="340" y="28" textAnchor="middle" fill="#1E40AF" fontSize="10" fontWeight="700">
                Meeting Room 2
              </text>
              <text x="340" y="44" textAnchor="middle" fill="#1E40AF" fontSize="9">
                (8 PAX - VC & WB)
              </text>

              {/* Meeting Room 3 (6 PAX) */}
              <rect x="400" y="0" width="90" height="65" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" rx="4" />
              <text x="445" y="28" textAnchor="middle" fill="#1E40AF" fontSize="10" fontWeight="700">
                Meeting Room 3
              </text>
              <text x="445" y="44" textAnchor="middle" fill="#1E40AF" fontSize="9">
                (6 PAX)
              </text>

              {/* Phone Booths */}
              <rect x="500" y="0" width="30" height="30" fill="#F3E8FF" stroke="#A855F7" rx="2" />
              <text x="515" y="18" textAnchor="middle" fill="#6B21A8" fontSize="8" fontWeight="700">
                P.B 1
              </text>
              <rect x="535" y="0" width="30" height="30" fill="#F3E8FF" stroke="#A855F7" rx="2" />
              <text x="550" y="18" textAnchor="middle" fill="#6B21A8" fontSize="8" fontWeight="700">
                P.B 2
              </text>
              <rect x="570" y="0" width="30" height="30" fill="#F3E8FF" stroke="#A855F7" rx="2" />
              <text x="585" y="18" textAnchor="middle" fill="#6B21A8" fontSize="8" fontWeight="700">
                P.B 3
              </text>
              <rect x="605" y="0" width="30" height="30" fill="#F3E8FF" stroke="#A855F7" rx="2" />
              <text x="620" y="18" textAnchor="middle" fill="#6B21A8" fontSize="8" fontWeight="700">
                P.B 4
              </text>
            </g>

            {/* IT Kit-Build Room & Server Area */}
            <g transform="translate(680, 360)">
              <rect width="110" height="65" fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" rx="3" />
              <text x="55" y="28" textAnchor="middle" fill="#0F172A" fontSize="9" fontWeight="700">
                IT KIT-BUILD
              </text>
              <text x="55" y="44" textAnchor="middle" fill="#475569" fontSize="8">
                & Store Room
              </text>
            </g>

            {/* Bottom Right: Cafeteria (46 Seat) & Townhall */}
            <g transform="translate(620, 780)">
              <rect width="190" height="100" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" rx="6" />
              <text x="95" y="32" textAnchor="middle" fill="#92400E" fontSize="12" fontWeight="700">
                CAFETERIA (46 SEAT)
              </text>
              <text x="95" y="52" textAnchor="middle" fill="#B45309" fontSize="10">
                Coffee Bar & Collab Dining
              </text>
              <circle cx="45" cy="75" r="12" fill="#FDE68A" stroke="#D97706" />
              <circle cx="95" cy="75" r="12" fill="#FDE68A" stroke="#D97706" />
              <circle cx="145" cy="75" r="12" fill="#FDE68A" stroke="#D97706" />
            </g>

            {/* Passages annotations */}
            <text x="350" y="210" fill="#94A3B8" fontSize="8" letterSpacing="2">
              1800 MM WIDE PASSAGE
            </text>
            <text x="350" y="440" fill="#94A3B8" fontSize="8" letterSpacing="2">
              2100 MM MAIN CIRCULATION CORRIDOR
            </text>

            {/* Render 184 Workstations */}
            {desks.map((desk) => {
              const isSelected = selectedDesk?.id === desk.id;
              const isAvailable = desk.status === 'AVAILABLE';
              const isBooked = desk.status === 'BOOKED';

              // Accessible status colors
              let fillColor = '#DCFCE7'; // light green
              let strokeColor = '#22C55E'; // green
              let textColor = '#166534';

              if (isSelected) {
                fillColor = '#DBEAFE';
                strokeColor = '#2563EB';
                textColor = '#1E40AF';
              } else if (isBooked) {
                fillColor = '#FEE2E2';
                strokeColor = '#EF4444';
                textColor = '#991B1B';
              }

              // Highlight if matches search filter
              const isMatched = filteredDesks.some((f) => f.id === desk.id);
              const opacity = searchQuery || selectedDept !== 'ALL' || filterStandingOnly || filterAccessibleOnly ? (isMatched ? 1 : 0.25) : 1;

              return (
                <g
                  key={desk.id}
                  transform={`translate(${desk.posX}, ${desk.posY})`}
                  onClick={() => handleDeskClick(desk)}
                  style={{ cursor: 'pointer', opacity }}
                >
                  {/* Desk workstation pod rectangle */}
                  <rect
                    width="42"
                    height="32"
                    rx="4"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '2.5' : '1.5'}
                  />

                  {/* Desk Number Label */}
                  <text
                    x="21"
                    y="17"
                    textAnchor="middle"
                    fill={textColor}
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {desk.code}
                  </text>

                  {/* Feature indicators */}
                  {desk.hasStandingDesk && (
                    <circle cx="8" cy="25" r="2.5" fill="#3B82F6">
                      <title>Standing Desk</title>
                    </circle>
                  )}
                  {desk.hasDualMonitors && (
                    <circle cx="16" cy="25" r="2.5" fill="#7C3AED">
                      <title>Dual 4K Monitors</title>
                    </circle>
                  )}
                  {desk.isAccessible && (
                    <circle cx="24" cy="25" r="2.5" fill="#059669">
                      <title>Wheelchair Accessible</title>
                    </circle>
                  )}

                  {/* Status dot */}
                  <circle
                    cx="34"
                    cy="8"
                    r="3.5"
                    fill={isAvailable ? '#22C55E' : '#EF4444'}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected Desk Slide-Out Drawer / Details Card */}
      {selectedDesk && (
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #1A56DB',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Workstation {selectedDesk.code}</h3>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: selectedDesk.status === 'AVAILABLE' ? '#DCFCE7' : '#FEE2E2',
                    color: selectedDesk.status === 'AVAILABLE' ? '#166534' : '#991B1B',
                  }}
                >
                  {selectedDesk.status === 'AVAILABLE' ? 'Available for Reservation' : 'Reserved'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                Department: <strong>{selectedDesk.zoneName}</strong> ({selectedDesk.designatedTeam || 'General GCC'})
              </p>
            </div>
            <button
              onClick={() => setSelectedDesk(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 18 }}
            >
              ✕
            </button>
          </div>

          {/* Amenities & Attributes */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {selectedDesk.hasStandingDesk && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>
                <ArrowUpRight size={14} color="#1A56DB" /> Electric Height-Adjustable Standing Desk
              </div>
            )}
            {selectedDesk.hasDualMonitors && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>
                <Monitor size={14} color="#7C3AED" /> Dual 4K 27" Dell Displays + USB-C Hub
              </div>
            )}
            {selectedDesk.hasUsbCDock && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>
                ⚡ 90W Power Delivery Dock
              </div>
            )}
            {selectedDesk.isAccessible && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>
                <Accessibility size={14} color="#059669" /> DDA / Ergonomic Accessible Station
              </div>
            )}
          </div>

          {/* Booked By Information */}
          {selectedDesk.status === 'BOOKED' && (
            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#9F1239' }}>
              Reserved by: <strong>{selectedDesk.bookedBy || 'Another Employee'}</strong> on {date}.
            </div>
          )}

          {bookingMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: bookingMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: bookingMessage.type === 'success' ? '#065F46' : '#991B1B',
                border: bookingMessage.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA',
              }}
            >
              {bookingMessage.text}
            </div>
          )}

          {/* Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <button
              onClick={() => setSelectedDesk(null)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            {selectedDesk.status === 'AVAILABLE' && (
              <button
                disabled={isBooking}
                onClick={handleConfirmBooking}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: isBooking ? '#93C5FD' : '#1A56DB',
                  color: '#FFFFFF',
                  cursor: isBooking ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(26, 86, 219, 0.25)',
                }}
              >
                {isBooking ? 'Confirming...' : `Confirm Booking for ${date}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
