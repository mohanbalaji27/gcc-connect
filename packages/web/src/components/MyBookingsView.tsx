import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { getMyBookings, cancelBooking, checkInBooking } from '../api';
import { Booking } from '@gcc-connect/shared';

export const MyBookingsView: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await getMyBookings();
      setBookings(res.bookings);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await cancelBooking(id);
      setActionMessage('Reservation cancelled successfully.');
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await checkInBooking(id);
      setActionMessage('Checked in successfully!');
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Check-in failed.');
    }
  };

  const upcomingBookings = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');
  const pastBookings = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'RELEASED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {actionMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {actionMessage}
        </div>
      )}

      {/* Active & Upcoming Bookings */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>
          Upcoming Reservations ({upcomingBookings.length})
        </h3>

        {upcomingBookings.length === 0 ? (
          <div style={{ background: '#FFFFFF', padding: 32, borderRadius: 12, textAlign: 'center', color: '#64748B' }}>
            No upcoming desk or room bookings found. Use the Floor Map or Scan QR to reserve a space!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {upcomingBookings.map((b) => (
              <div
                key={b.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  padding: 18,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1A56DB', textTransform: 'uppercase' }}>
                      {b.resourceCategory}
                    </span>
                    <h4 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                      {b.resourceName}
                    </h4>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      background: b.status === 'CHECKED_IN' ? '#DCFCE7' : '#EFF6FF',
                      color: b.status === 'CHECKED_IN' ? '#166534' : '#1E40AF',
                    }}
                  >
                    {b.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={15} color="#64748B" />
                    <span>{b.date}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={15} color="#64748B" />
                    <span>{b.startTime} - {b.endTime}</span>
                  </div>
                  {b.isQrOriginated && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0D9488', fontWeight: 600 }}>
                      <QrCode size={15} />
                      <span>Booked via Physical QR Scan</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleCheckIn(b.id)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#059669',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      Check In Now
                    </button>
                  )}
                  <button
                    onClick={() => handleCancel(b.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #FECACA',
                      background: '#FFF1F2',
                      color: '#991B1B',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past History */}
      {pastBookings.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#64748B', marginBottom: 12 }}>
            Past & Cancelled Bookings
          </h3>
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {pastBookings.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <div>
                  <strong>{b.resourceName}</strong> ({b.date})
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: '#F1F5F9',
                    color: '#64748B',
                  }}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
