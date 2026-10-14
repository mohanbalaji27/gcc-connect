import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, AlertCircle, CheckCircle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { scanQrCode, createDeskBooking, createRoomBooking, redeemOneTimeToken } from '../api';

interface ScanQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: any;
}

export const ScanQrModal: React.FC<ScanQrModalProps> = ({ isOpen, onClose, onSuccess, currentUser }) => {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolvedResult, setResolvedResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setResolvedResult(null);
      setErrorMessage(null);
      return;
    }

    // Try camera access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          setHasCameraPermission(false);
        });
    } else {
      setHasCameraPermission(false);
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResolveCode = async (rawCode: string) => {
    if (!rawCode.trim()) return;
    setIsResolving(true);
    setErrorMessage(null);

    try {
      const result = await scanQrCode(rawCode);
      setResolvedResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or unrecognized QR code.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!resolvedResult) return;
    setIsConfirming(true);
    setErrorMessage(null);

    try {
      const today = new Date().toISOString().split('T')[0];

      if (resolvedResult.type === 'PHYSICAL_RESOURCE') {
        if (resolvedResult.category === 'DESK') {
          await createDeskBooking(resolvedResult.resource.id, today, true);
        } else if (resolvedResult.category === 'MEETING_ROOM') {
          await createRoomBooking({
            resourceId: resolvedResult.resource.id,
            date: today,
            startTime: '14:00',
            endTime: '15:00',
            title: 'QR Scan Instant Collab',
            attendeesCount: 2,
            isQrOriginated: true,
          });
        }
      } else if (resolvedResult.type === 'ONE_TIME_TOKEN') {
        await redeemOneTimeToken(manualCode);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Booking confirmation failed.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0F275A',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Camera size={20} color="#60A5FA" />
            <span style={{ fontWeight: 700, fontSize: 16 }}>Scan Physical QR Code</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {/* Viewfinder Area */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!resolvedResult ? (
            <>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 240,
                  backgroundColor: '#0F172A',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {hasCameraPermission ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ color: '#94A3B8', textAlign: 'center', padding: 20 }}>
                    <QrCode size={48} color="#64748B" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>
                      Camera access not enabled or inactive in this browser frame.
                    </p>
                    <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                      Use one of the direct simulator shortcuts below or type the desk code.
                    </p>
                  </div>
                )}

                {/* Framing Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    width: 160,
                    height: 160,
                    border: '2px solid #3B82F6',
                    borderRadius: 12,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Quick Simulator Buttons for Local Testing */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Quick Scan Simulator (Simulate Camera Scans)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={() => handleResolveCode('res_dk_z001')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Scan Desk Z001
                  </button>
                  <button
                    onClick={() => handleResolveCode('res_dk_z042')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Scan Desk Z042 (Sustaining)
                  </button>
                  <button
                    onClick={() => handleResolveCode('res_rm_mr8_a')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Scan Meeting Room 1
                  </button>
                  <button
                    onClick={() => handleResolveCode('res_rm_pb_1')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Scan Phone Booth 1
                  </button>
                </div>
              </div>

              {/* Manual Input (Accessible Alternative) */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Enter QR payload or opaque code..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResolveCode(manualCode)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  disabled={isResolving || !manualCode.trim()}
                  onClick={() => handleResolveCode(manualCode)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#1A56DB',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isResolving ? 'Resolving...' : 'Lookup'}
                </button>
              </div>
            </>
          ) : (
            /* Resolved Resource Details & Confirmation */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: '#F0F5FA',
                  borderRadius: 10,
                  padding: 16,
                  border: '1px solid #BFDBFE',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: '#0F275A' }}>
                    {resolvedResult.category === 'DESK'
                      ? `Workstation ${resolvedResult.resource.code}`
                      : resolvedResult.resource.name}
                  </h4>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: resolvedResult.resource?.isAvailable ? '#DCFCE7' : '#FEE2E2',
                      color: resolvedResult.resource?.isAvailable ? '#166534' : '#991B1B',
                    }}
                  >
                    {resolvedResult.resource?.isAvailable ? 'Available Now' : 'Reserved'}
                  </span>
                </div>

                {resolvedResult.category === 'DESK' ? (
                  <div style={{ fontSize: 13, color: '#334155', marginTop: 8, lineHeight: 1.6 }}>
                    <p>Department: <strong>{resolvedResult.resource.zoneName}</strong></p>
                    <p>Features: {resolvedResult.resource.hasStandingDesk ? 'Standing Desk, ' : ''}
                      {resolvedResult.resource.hasDualMonitors ? 'Dual Monitors, ' : ''}
                      USB-C Power Dock
                    </p>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#334155', marginTop: 8, lineHeight: 1.6 }}>
                    <p>Capacity: <strong>{resolvedResult.resource.capacity} PAX</strong></p>
                    <p>Equipment: Video Conference Suite, Digital Whiteboard</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setResolvedResult(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Rescan
                </button>
                <button
                  disabled={isConfirming || !resolvedResult.resource?.isAvailable}
                  onClick={handleConfirmAction}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: resolvedResult.resource?.isAvailable ? '#1A56DB' : '#94A3B8',
                    color: '#FFFFFF',
                    cursor: resolvedResult.resource?.isAvailable ? 'pointer' : 'not-allowed',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {isConfirming ? 'Confirming...' : 'Confirm Reservation'}
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
