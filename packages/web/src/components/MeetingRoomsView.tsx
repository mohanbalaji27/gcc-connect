import React, { useState, useEffect } from 'react';
import { Video, Users, CheckCircle, Clock, AlertTriangle, Monitor, Sparkles } from 'lucide-react';
import { searchRooms, createRoomBooking } from '../api';

export const MeetingRoomsView: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('14:00');
  const [endTime, setEndTime] = useState<string>('15:00');
  const [minCapacity, setMinCapacity] = useState<number>(2);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [meetingTitle, setMeetingTitle] = useState<string>('Robotics Architecture Review');
  const [attendeesCount, setAttendeesCount] = useState<number>(4);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const res = await searchRooms({ date, startTime, endTime, minCapacity });
      setRooms(res.rooms);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [date, startTime, endTime, minCapacity]);

  const handleBookRoom = async (room: any) => {
    setIsBooking(true);
    setBookingMessage(null);

    try {
      await createRoomBooking({
        resourceId: room.id,
        date,
        startTime,
        endTime,
        title: meetingTitle,
        attendeesCount,
      });

      setBookingMessage({
        type: 'success',
        text: `Room ${room.name} confirmed for ${date} (${startTime} - ${endTime})!`,
      });
      fetchRooms();
      setTimeout(() => {
        setSelectedRoom(null);
        setBookingMessage(null);
      }, 1500);
    } catch (err: any) {
      setBookingMessage({
        type: 'error',
        text: err.message || 'Room reservation conflict or failed.',
      });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search & Filter Header */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 600,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 600,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 600,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
              Min Capacity
            </label>
            <select
              value={minCapacity}
              onChange={(e) => setMinCapacity(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 600,
                background: '#FFFFFF',
              }}
            >
              <option value={1}>1+ PAX (Phone Booths)</option>
              <option value={4}>4+ PAX (Team Huddle)</option>
              <option value={8}>8+ PAX (Conference)</option>
              <option value={12}>12+ PAX (Boardroom)</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchRooms}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#1A56DB',
            color: '#FFFFFF',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Check Availability
        </button>
      </div>

      {bookingMessage && (
        <div
          style={{
            padding: '12px 16px',
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

      {/* Room Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {rooms.map((room) => {
          const isAvailable = room.status === 'AVAILABLE';

          return (
            <div
              key={room.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                padding: 18,
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1A56DB', textTransform: 'uppercase' }}>
                      {room.code}
                    </span>
                    <h4 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{room.name}</h4>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                      color: isAvailable ? '#166534' : '#991B1B',
                    }}
                  >
                    {isAvailable ? 'Available' : 'Conflict'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, color: '#475569', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={15} color="#64748B" />
                    <span>{room.capacity} PAX</span>
                  </div>
                  {room.hasVideoConference && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Video size={15} color="#2563EB" />
                      <span>Teams / VC</span>
                    </div>
                  )}
                  {room.hasDigitalWhiteboard && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Monitor size={15} color="#7C3AED" />
                      <span>Whiteboard</span>
                    </div>
                  )}
                </div>

                {!isAvailable && room.conflictingBooking && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      background: '#FFF1F2',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#9F1239',
                    }}
                  >
                    <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Booked ({room.conflictingBooking.start_time} - {room.conflictingBooking.end_time}):{' '}
                    <strong>{room.conflictingBooking.title}</strong>
                  </div>
                )}
              </div>

              {isAvailable ? (
                selectedRoom?.id === room.id ? (
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="Meeting Title"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => setSelectedRoom(null)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={isBooking}
                        onClick={() => handleBookRoom(room)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1A56DB', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                      >
                        {isBooking ? 'Reserving...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedRoom(room)}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#1A56DB',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Book Room
                  </button>
                )
              ) : (
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    background: '#F1F5F9',
                    color: '#94A3B8',
                    cursor: 'not-allowed',
                    fontSize: 13,
                  }}
                >
                  Unavailable for this time
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
