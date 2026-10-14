import React, { useState, useCallback, useRef } from 'react';
import {
  Search, ZoomIn, ZoomOut, RotateCcw, Calendar,
  ArrowUpRight, Monitor, Accessibility, Edit3, Move, Save, X, Info
} from 'lucide-react';
import { createDeskBooking } from '../api';

interface FloorMapProps {
  desks: any[];
  date: string;
  onDateChange: (newDate: string) => void;
  onBookingSuccess: () => void;
  currentUser: any;
}

// Zone definitions matching Zimmer Biomet ANSR-ZB-01 floor plan
const ZONE_DEFS = [
  { id: 'zone_mfg',   code: 'A', name: 'Manufacturing Engineering',      color: '#DBEAFE', stroke: '#3B82F6', x: 50,  y: 60,  w: 200, h: 180, cols: 4, rows: 5,  deskCount: 20, desks: [] as string[] },
  { id: 'zone_eng',   code: 'B', name: 'Engineering Services',            color: '#DCFCE7', stroke: '#22C55E', x: 270, y: 60,  w: 240, h: 200, cols: 4, rows: 6,  deskCount: 24, desks: [] as string[] },
  { id: 'zone_sus',   code: 'C', name: 'Sustaining Engineering',          color: '#FEF3C7', stroke: '#F59E0B', x: 530, y: 60,  w: 280, h: 220, cols: 4, rows: 7,  deskCount: 28, desks: [] as string[] },
  { id: 'zone_rob',   code: 'D', name: 'Robotics Engineering',            color: '#FCE7F3', stroke: '#EC4899', x: 50,  y: 280, w: 240, h: 200, cols: 4, rows: 6,  deskCount: 24, desks: [] as string[] },
  { id: 'zone_qa',    code: 'E', name: 'Quality & Regulatory Affairs',    color: '#F5F3FF', stroke: '#8B5CF6', x: 310, y: 280, w: 240, h: 200, cols: 4, rows: 6,  deskCount: 24, desks: [] as string[] },
  { id: 'zone_it',    code: 'F', name: 'Information Technology',          color: '#ECFDF5', stroke: '#10B981', x: 570, y: 280, w: 200, h: 180, cols: 4, rows: 5,  deskCount: 20, desks: [] as string[] },
  { id: 'zone_fac',   code: 'G', name: 'Facilities & Transport',          color: '#FFF7ED', stroke: '#F97316', x: 50,  y: 510, w: 140, h: 120, cols: 2, rows: 4,  deskCount: 8,  desks: [] as string[] },
  { id: 'zone_pro',   code: 'H', name: 'Procurement',                     color: '#FDF4FF', stroke: '#A855F7', x: 210, y: 510, w: 170, h: 140, cols: 2, rows: 5,  deskCount: 10, desks: [] as string[] },
  { id: 'zone_cli',   code: 'I', name: 'Clinical Affairs',                color: '#FFF1F2', stroke: '#F43F5E', x: 400, y: 510, w: 170, h: 140, cols: 2, rows: 5,  deskCount: 10, desks: [] as string[] },
  { id: 'zone_hr',    code: 'J', name: 'Human Resources',                 color: '#F0FDF4', stroke: '#16A34A', x: 590, y: 510, w: 140, h: 120, cols: 2, rows: 4,  deskCount: 8,  desks: [] as string[] },
  { id: 'zone_fin',   code: 'K', name: 'Finance',                         color: '#FFFBEB', stroke: '#D97706', x: 750, y: 510, w: 140, h: 120, cols: 2, rows: 4,  deskCount: 8,  desks: [] as string[] },
];

// Build static desk-to-zone mapping (Z001-Z184)
const DESK_ZONE_MAP: Record<string, typeof ZONE_DEFS[0]> = {};
let deskNum = 1;
for (const zone of ZONE_DEFS) {
  for (let i = 0; i < zone.deskCount; i++) {
    const code = `Z${String(deskNum).padStart(3, '0')}`;
    zone.desks.push(code);
    DESK_ZONE_MAP[code] = zone;
    deskNum++;
  }
}

// Compute SVG position for a desk inside its zone
function getDeskPos(code: string): { x: number; y: number } {
  const zone = DESK_ZONE_MAP[code];
  if (!zone) return { x: 0, y: 0 };
  const idx = zone.desks.indexOf(code);
  const col = idx % zone.cols;
  const row = Math.floor(idx / zone.cols);
  const DESK_W = 36, DESK_H = 28, GAP_X = 8, GAP_Y = 8, PAD = 32;
  return {
    x: zone.x + PAD + col * (DESK_W + GAP_X),
    y: zone.y + 36 + row * (DESK_H + GAP_Y), // 36 = space for zone label
  };
}

export const FloorMap: React.FC<FloorMapProps> = ({
  desks, date, onDateChange, onBookingSuccess, currentUser,
}) => {
  const [scale, setScale] = useState(0.85);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [filterStanding, setFilterStanding] = useState(false);
  const [filterAccessible, setFilterAccessible] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<any | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingMsg, setBookingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isAdmin = ['SUPER_ADMIN', 'FACILITIES_ADMIN'].includes(currentUser?.role);

  // Build lookup map from API desks
  const deskMap = new Map(desks.map((d: any) => [d.code, d]));

  // Filter desks
  const filteredCodes = ZONE_DEFS.flatMap(z => z.desks).filter(code => {
    const d = deskMap.get(code);
    if (!d) return searchQuery ? false : true;
    const matchSearch = !searchQuery ||
      code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.zoneName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = selectedDept === 'ALL' || (d.zoneName || '').includes(selectedDept);
    const matchStanding = !filterStanding || d.hasStandingDesk;
    const matchAccess = !filterAccessible || d.isAccessible;
    return matchSearch && matchDept && matchStanding && matchAccess;
  });

  const availableCount = desks.filter(d => d.status === 'AVAILABLE').length;
  const bookedCount = desks.filter(d => d.status === 'BOOKED').length;

  // Pan handling
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanX(p => p + e.clientX - lastMouse.x);
    setPanY(p => p + e.clientY - lastMouse.y);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  const onMouseUp = () => setIsPanning(false);
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(0.4, Math.min(2.5, s - e.deltaY * 0.001)));
  };

  const handleDeskClick = (code: string) => {
    if (isEditMode) return;
    const d = deskMap.get(code);
    if (d) { setSelectedDesk(d); setBookingMsg(null); }
  };

  const handleConfirmBooking = async () => {
    if (!selectedDesk) return;
    setIsBooking(true);
    setBookingMsg(null);
    try {
      await createDeskBooking(selectedDesk.id, date, false);
      setBookingMsg({ type: 'success', text: `Workstation ${selectedDesk.code} reserved for ${date}!` });
      setTimeout(() => { onBookingSuccess(); setSelectedDesk(null); }, 1600);
    } catch (err: any) {
      setBookingMsg({ type: 'error', text: err.message || 'Booking failed. Try again.' });
    } finally {
      setIsBooking(false);
    }
  };

  const departments = ['ALL', ...ZONE_DEFS.map(z => z.name)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Controls Bar ── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', padding: '6px 10px', borderRadius: 8 }}>
            <Calendar size={14} color="#475569" />
            <input type="date" value={date} min={new Date().toISOString().split('T')[0]}
              onChange={e => onDateChange(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, color: '#0F172A', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', padding: '6px 10px', borderRadius: 8, minWidth: 180 }}>
            <Search size={14} color="#64748B" />
            <input type="text" placeholder="Search desk or dept..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, outline: 'none', width: '100%' }} />
          </div>
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 12, color: '#334155', maxWidth: 200 }}>
            {departments.map(d => <option key={d} value={d}>{d === 'ALL' ? 'All Departments' : d}</option>)}
          </select>
          {['Standing Desk', 'Accessible'].map((label, i) => (
            <button key={label} onClick={() => i === 0 ? setFilterStanding(!filterStanding) : setFilterAccessible(!filterAccessible)}
              style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: (i === 0 ? filterStanding : filterAccessible) ? '1px solid #1A56DB' : '1px solid #CBD5E1',
                background: (i === 0 ? filterStanding : filterAccessible) ? '#EFF6FF' : '#fff',
                color: (i === 0 ? filterStanding : filterAccessible) ? '#1A56DB' : '#475569' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isAdmin && (
            <button onClick={() => setIsEditMode(!isEditMode)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: 'none', background: isEditMode ? '#1A56DB' : '#0F275A', color: '#fff' }}>
              {isEditMode ? <><Save size={13} /> Exit Edit</> : <><Edit3 size={13} /> Edit Map</>}
            </button>
          )}
          {[{ icon: <ZoomIn size={14}/>, fn: () => setScale(s => Math.min(s+0.15, 2.5)) },
            { icon: <ZoomOut size={14}/>, fn: () => setScale(s => Math.max(s-0.15, 0.4)) },
            { icon: <RotateCcw size={14}/>, fn: () => { setScale(0.85); setPanX(0); setPanY(0); } }]
            .map((btn, i) => (
              <button key={i} onClick={btn.fn} style={{ padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer' }}>
                {btn.icon}
              </button>
            ))}
        </div>
      </div>

      {/* ── Legend & Zone Key ── */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '8px 14px', border: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 13 }}>ZB Bangalore Hub:</span>
        {[{ label: `Available (${availableCount})`, color: '#22C55E' },
          { label: `Booked (${bookedCount})`, color: '#EF4444' },
          { label: 'Selected', color: '#2563EB' },
          { label: 'Filtered out', color: '#CBD5E1' }]
          .map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: l.color }} />
              <span style={{ color: '#475569' }}>{l.label}</span>
            </div>
          ))}
        <span style={{ marginLeft: 'auto', color: '#64748B' }}>Showing {filteredCodes.length} of 184 desks</span>
        {isEditMode && <span style={{ color: '#1A56DB', fontWeight: 700 }}>✏️ EDIT MODE — Admin Zone Management Active</span>}
      </div>

      {/* ── Floor Plan SVG ── */}
      <div style={{ position: 'relative', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0',
          overflow: 'hidden', height: 580, cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onWheel={onWheel}>
        <div style={{ transform: `translate(${panX}px, ${panY}px) scale(${scale})`, transformOrigin: 'top left', transition: isPanning ? 'none' : 'transform 0.1s' }}>
          <svg ref={svgRef} width="1050" height="680" viewBox="0 0 1050 680"
            style={{ background: '#FAFAFA', borderRadius: 8, display: 'block' }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F5F9" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="1050" height="680" fill="url(#grid)" />

            {/* ── Zone Backgrounds ── */}
            {ZONE_DEFS.map(zone => (
              <g key={zone.id}>
                <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={8}
                  fill={zone.color} stroke={zone.stroke} strokeWidth={hoveredZone === zone.id ? 2.5 : 1.5}
                  opacity={0.85}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)} />
                <text x={zone.x + zone.w/2} y={zone.y + 20} textAnchor="middle"
                  fill={zone.stroke} fontSize="10" fontWeight="800" letterSpacing="0.5">
                  {zone.code}: {zone.name}
                </text>
                <text x={zone.x + zone.w/2} y={zone.y + 32} textAnchor="middle"
                  fill={zone.stroke} fontSize="8" opacity={0.7}>
                  ({zone.deskCount} seats)
                </text>
              </g>
            ))}

            {/* ── Special Areas (Right Side) ── */}
            {/* Meeting Rooms */}
            <rect x={830} y={60} width={200} height={280} rx={6} fill="#EFF6FF" stroke="#3B82F6" strokeWidth={2} />
            <text x={930} y={85} textAnchor="middle" fill="#1E40AF" fontSize="11" fontWeight="800">MEETING ROOMS</text>
            {[{n:'MR-01 (8 PAX + VC)', y:100},{n:'MR-02 (8 PAX + VC)', y:160},{n:'MR-03 (6 PAX)', y:220},{n:'MR-04 (6 PAX)', y:280}].map((r,i) => (
              <g key={i}>
                <rect x={843} y={r.y} width={174} height={46} rx={4} fill="#DBEAFE" stroke="#93C3FE" strokeWidth={1}/>
                <text x={930} y={r.y+20} textAnchor="middle" fill="#1E40AF" fontSize="9" fontWeight="700">{r.n}</text>
                <text x={930} y={r.y+34} textAnchor="middle" fill="#3B82F6" fontSize="8">📅 Bookable</text>
              </g>
            ))}

            {/* Phone Booths */}
            <rect x={830} y={350} width={200} height={80} rx={6} fill="#F3E8FF" stroke="#A855F7" strokeWidth={1.5} />
            <text x={930} y={370} textAnchor="middle" fill="#7E22CE" fontSize="10" fontWeight="700">PHONE BOOTHS</text>
            {['PB-1','PB-2','PB-3','PB-4'].map((p,i) => (
              <rect key={p} x={843+i*47} y={378} width={40} height={38} rx={3} fill="#E9D5FF" stroke="#A855F7" strokeWidth={1}/>
            ))}

            {/* Cabins */}
            <rect x={830} y={440} width={200} height={100} rx={6} fill="#F1F5F9" stroke="#64748B" strokeWidth={1.5} />
            <text x={930} y={458} textAnchor="middle" fill="#1E293B" fontSize="10" fontWeight="700">MANAGEMENT CABINS</text>
            {['Cabin 1','Cabin 2','Cabin 3'].map((c,i) => (
              <rect key={c} x={843+i*63} y={466} width={56} height={60} rx={3} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={1}/>
            ))}

            {/* Cafeteria */}
            <rect x={830} y={550} width={200} height={110} rx={6} fill="#FEF3C7" stroke="#D97706" strokeWidth={2} />
            <text x={930} y={573} textAnchor="middle" fill="#92400E" fontSize="11" fontWeight="800">CAFETERIA (46 SEAT)</text>
            <text x={930} y={589} textAnchor="middle" fill="#B45309" fontSize="9">Coffee Bar &amp; Collab Dining</text>
            {[60,100,140,180].map(cx => <circle key={cx} cx={830+cx/2+20} cy={620} r={10} fill="#FDE68A" stroke="#D97706" strokeWidth={1}/>)}

            {/* Reception */}
            <rect x={50} y={650} width={770} height={24} rx={4} fill="#FEF3C7" stroke="#F59E0B" strokeWidth={1}/>
            <text x={435} y={665} textAnchor="middle" fill="#92400E" fontSize="9" fontWeight="700">RECEPTION, COFFEE BAR &amp; MAIN CIRCULATION CORRIDOR (2100 MM)</text>

            {/* ── 184 Workstations ── */}
            {ZONE_DEFS.flatMap(zone =>
              zone.desks.map(code => {
                const pos = getDeskPos(code);
                const d = deskMap.get(code);
                const isSelected = selectedDesk?.code === code;
                const isBooked = d?.status === 'BOOKED';
                const isAvailable = !isBooked;
                const isMatched = filteredCodes.includes(code);
                const hasFilter = searchQuery || selectedDept !== 'ALL' || filterStanding || filterAccessible;
                const opacity = hasFilter ? (isMatched ? 1 : 0.18) : 1;

                let fill = '#DCFCE7', stroke = '#22C55E', textFill = '#166534';
                if (isSelected) { fill = '#DBEAFE'; stroke = '#2563EB'; textFill = '#1E40AF'; }
                else if (isBooked) { fill = '#FEE2E2'; stroke = '#EF4444'; textFill = '#991B1B'; }

                return (
                  <g key={code} transform={`translate(${pos.x},${pos.y})`}
                    onClick={() => handleDeskClick(code)}
                    style={{ cursor: isEditMode ? 'move' : 'pointer', opacity }}>
                    <rect width={36} height={28} rx={4} fill={fill} stroke={stroke}
                      strokeWidth={isSelected ? 2.5 : 1.5} />
                    {/* Edit mode drag indicator */}
                    {isEditMode && <rect width={36} height={28} rx={4} fill="transparent" stroke="#1A56DB" strokeWidth={1} strokeDasharray="3 2" opacity={0.6}/>}
                    <text x={18} y={15} textAnchor="middle" fill={textFill} fontSize="7.5" fontWeight="800" fontFamily="monospace">
                      {code.replace('Z', '')}
                    </text>
                    {/* Status dot */}
                    <circle cx={30} cy={6} r={3} fill={isAvailable ? '#22C55E' : '#EF4444'} />
                    {/* Amenity dots */}
                    {d?.hasStandingDesk && <circle cx={7} cy={22} r={2.5} fill="#3B82F6"><title>Standing Desk</title></circle>}
                    {d?.hasDualMonitors && <circle cx={14} cy={22} r={2.5} fill="#7C3AED"><title>Dual Monitors</title></circle>}
                    {d?.isAccessible && <circle cx={21} cy={22} r={2.5} fill="#059669"><title>Accessible</title></circle>}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Zoom level indicator */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(15,23,42,0.7)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
          {Math.round(scale * 100)}% — Scroll to zoom, drag to pan
        </div>
      </div>

      {/* ── Desk Detail Card ── */}
      {selectedDesk && (
        <div style={{ background: '#fff', border: '2px solid #1A56DB', borderRadius: 12, padding: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Workstation {selectedDesk.code}</h3>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 9999,
                  background: selectedDesk.status === 'AVAILABLE' ? '#DCFCE7' : '#FEE2E2',
                  color: selectedDesk.status === 'AVAILABLE' ? '#166534' : '#991B1B' }}>
                  {selectedDesk.status === 'AVAILABLE' ? '✅ Available' : '🔴 Reserved'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                Zone: <strong>{selectedDesk.zoneName}</strong> · {selectedDesk.designatedTeam || 'Open Seating'}
              </p>
            </div>
            <button onClick={() => setSelectedDesk(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {selectedDesk.hasStandingDesk && <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '4px 10px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><ArrowUpRight size={13}/>Standing Desk</span>}
            {selectedDesk.hasDualMonitors && <span style={{ background: '#F5F3FF', color: '#5B21B6', padding: '4px 10px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Monitor size={13}/>Dual 4K Monitors</span>}
            {selectedDesk.hasUsbCDock && <span style={{ background: '#ECFDF5', color: '#065F46', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>⚡ USB-C Dock</span>}
            {selectedDesk.isAccessible && <span style={{ background: '#F0FDF4', color: '#15803D', padding: '4px 10px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Accessibility size={13}/>Accessible</span>}
          </div>

          {selectedDesk.status === 'BOOKED' && (
            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#9F1239' }}>
              Reserved by: <strong>{selectedDesk.bookedBy || 'Another Employee'}</strong> on {date}
            </div>
          )}

          {bookingMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: bookingMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: bookingMsg.type === 'success' ? '#065F46' : '#991B1B',
              border: bookingMsg.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA' }}>
              {bookingMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={() => setSelectedDesk(null)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Cancel
            </button>
            {selectedDesk.status === 'AVAILABLE' && (
              <button disabled={isBooking} onClick={handleConfirmBooking}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: isBooking ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1E429F)',
                  color: '#fff', cursor: isBooking ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 2px 4px rgba(26,86,219,0.3)' }}>
                {isBooking ? '⏳ Confirming...' : `Confirm Booking — ${date}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
