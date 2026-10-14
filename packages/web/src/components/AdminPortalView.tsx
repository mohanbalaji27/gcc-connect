import React, { useState, useEffect } from 'react';
import {
  Users,
  QrCode,
  FileSpreadsheet,
  ShieldAlert,
  Sliders,
  Printer,
  PlusCircle,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  getAdminEmployees,
  assignUserRole,
  suspendUser,
  importEmployees,
  getQrInventory,
  createOneTimeToken,
  getPolicies,
  updatePolicies,
  getAuditLogs,
  getSecurityEvents,
} from '../api';
import { UserRole, BookingPolicy } from '@gcc-connect/shared';

export const AdminPortalView: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'import' | 'qrs' | 'tokens' | 'policies' | 'audit'>('roster');
  const [employees, setEmployees] = useState<any[]>([]);
  const [qrInventory, setQrInventory] = useState<any[]>([]);
  const [policies, setPolicies] = useState<BookingPolicy | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // One-time token form state
  const [tokenPurpose, setTokenPurpose] = useState<string>('Auditor One-Time Desk Access');
  const [tokenScopeCategory, setTokenScopeCategory] = useState<string>('DESK');
  const [tokenValidHours, setTokenValidHours] = useState<number>(24);
  const [generatedTokenResult, setGeneratedTokenResult] = useState<any | null>(null);

  // Import state
  const [importFileBase64, setImportFileBase64] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  useEffect(() => {
    loadTabContent();
  }, [activeTab]);

  const loadTabContent = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      if (activeTab === 'roster') {
        const res = await getAdminEmployees();
        setEmployees(res.employees);
      } else if (activeTab === 'qrs') {
        const res = await getQrInventory();
        // Generate QR data URLs for first 20 for preview
        const enriched = await Promise.all(
          res.inventory.slice(0, 30).map(async (item: any) => ({
            ...item,
            qrDataUrl: await QRCode.toDataURL(item.payload, { margin: 1, width: 90 }),
          }))
        );
        setQrInventory(enriched);
      } else if (activeTab === 'policies') {
        const res = await getPolicies();
        setPolicies(res.policy);
      } else if (activeTab === 'audit') {
        const [logsRes, secRes] = await Promise.all([getAuditLogs(), getSecurityEvents()]);
        setAuditLogs(logsRes.logs);
        setSecurityEvents(secRes.events);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load administrative data.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await assignUserRole(userId, newRole);
      setMessage({ type: 'success', text: `Role updated to ${newRole}` });
      loadTabContent();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Role modification failed.' });
    }
  };

  const handleSuspendToggle = async (userId: string, currentActive: boolean) => {
    const reason = prompt(
      currentActive ? 'Reason for suspension:' : 'Reason for reactivation:',
      'Administrative policy review'
    );
    if (!reason) return;

    try {
      await suspendUser(userId, currentActive, reason);
      setMessage({ type: 'success', text: currentActive ? 'Employee suspended' : 'Employee reactivated' });
      loadTabContent();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleGenerateToken = async () => {
    try {
      const res = await createOneTimeToken({
        purpose: tokenPurpose,
        scopeCategory: tokenScopeCategory,
        validHours: tokenValidHours,
        maxRedemptions: 1,
      });
      setGeneratedTokenResult(res);
      setMessage({ type: 'success', text: 'One-Time Token generated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImportFileBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRunImport = async (dryRun: boolean) => {
    if (!importFileBase64) return;
    try {
      const res = await importEmployees(importFileBase64, dryRun);
      setImportResult(res);
      if (!dryRun) {
        setMessage({ type: 'success', text: `Committed ${res.committedRows} employees to roster.` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Admin Tab Navigation */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          background: '#FFFFFF',
          padding: 8,
          borderRadius: 10,
          border: '1px solid #E2E8F0',
        }}
      >
        <button
          onClick={() => setActiveTab('roster')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'roster' ? '#1A56DB' : 'transparent',
            color: activeTab === 'roster' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Users size={16} /> Employee Roster
        </button>

        <button
          onClick={() => setActiveTab('import')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'import' ? '#1A56DB' : 'transparent',
            color: activeTab === 'import' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <FileSpreadsheet size={16} /> Excel Import
        </button>

        <button
          onClick={() => setActiveTab('qrs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'qrs' ? '#1A56DB' : 'transparent',
            color: activeTab === 'qrs' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <QrCode size={16} /> QR Sticker Print
        </button>

        <button
          onClick={() => setActiveTab('tokens')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'tokens' ? '#1A56DB' : 'transparent',
            color: activeTab === 'tokens' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <PlusCircle size={16} /> One-Time Tokens
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'policies' ? '#1A56DB' : 'transparent',
            color: activeTab === 'policies' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Sliders size={16} /> Booking Policies
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'audit' ? '#1A56DB' : 'transparent',
            color: activeTab === 'audit' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <ShieldAlert size={16} /> Security & Audit
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: message.type === 'success' ? '#065F46' : '#991B1B',
            border: message.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA',
          }}
        >
          {message.text}
        </div>
      )}

      {/* TAB 1: ROSTER */}
      {activeTab === 'roster' && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: 16 }}>
            Corporate Employee Roster ({employees.length} Employees)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px' }}>Code</th>
                <th style={{ padding: '10px 16px' }}>Name & Email</th>
                <th style={{ padding: '10px 16px' }}>Department</th>
                <th style={{ padding: '10px 16px' }}>Role</th>
                <th style={{ padding: '10px 16px' }}>Status</th>
                <th style={{ padding: '10px 16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                    {emp.employee_code}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{emp.name}</strong>
                    <div style={{ color: '#64748B', fontSize: 12 }}>{emp.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    {emp.department} — {emp.team}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={emp.role}
                      disabled={emp.id === currentUser?.id}
                      onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="TEAM_COORDINATOR">TEAM_COORDINATOR</option>
                      <option value="FACILITIES_ADMIN">FACILITIES_ADMIN</option>
                      <option value="EVENTS_ADMIN">EVENTS_ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      <option value="RECEPTION_ADMIN">RECEPTION_ADMIN</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: emp.is_active === 1 ? '#DCFCE7' : '#FEE2E2',
                        color: emp.is_active === 1 ? '#166534' : '#991B1B',
                      }}
                    >
                      {emp.is_active === 1 ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {emp.id !== currentUser?.id && (
                      <button
                        onClick={() => handleSuspendToggle(emp.id, emp.is_active === 1)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: emp.is_active === 1 ? '#991B1B' : '#166534',
                        }}
                      >
                        {emp.is_active === 1 ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: EXCEL IMPORT */}
      {activeTab === 'import' && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            Bulk Roster Import with Validation & Dry Run
          </h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Upload an Excel (.xlsx) or CSV spreadsheet containing columns: <code>Employee Code</code>, <code>Email</code>, <code>Name</code>, <code>Department</code>, <code>Team</code>, <code>Role</code>.
          </p>

          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ marginBottom: 16 }} />

          {importFileBase64 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => handleRunImport(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #1A56DB',
                  background: '#EFF6FF',
                  color: '#1A56DB',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Run Validation (Dry Run)
              </button>
              <button
                onClick={() => handleRunImport(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1A56DB',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Commit Import to Database
              </button>
            </div>
          )}

          {importResult && (
            <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <div>Total Rows: <strong>{importResult.totalRows}</strong></div>
                <div style={{ color: '#166534' }}>Valid: <strong>{importResult.validRows}</strong></div>
                <div style={{ color: '#991B1B' }}>Invalid: <strong>{importResult.invalidRows}</strong></div>
                {importResult.committedRows !== undefined && (
                  <div style={{ color: '#1A56DB' }}>Committed: <strong>{importResult.committedRows}</strong></div>
                )}
              </div>

              {importResult.errors?.length > 0 && (
                <div style={{ background: '#FEF2F2', padding: 10, borderRadius: 6, color: '#991B1B', fontSize: 12, marginBottom: 12 }}>
                  <strong>Errors detected:</strong>
                  <ul>
                    {importResult.errors.map((e: any, idx: number) => (
                      <li key={idx}>Row {e.row}: {e.errors.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QR STICKER INVENTORY & PRINT SHEET */}
      {activeTab === 'qrs' && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Physical QR Code Sticker Sheets (Zimmer Biomet Layout Plan)
              </h3>
              <p style={{ fontSize: 13, color: '#64748B' }}>
                184 Desk QR codes + 13 Meeting Room / Space QR codes ready for sticker label printing.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#0F275A',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Printer size={16} /> Print Sticker Sheets
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {qrInventory.map((item) => (
              <div
                key={item.qrId}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  padding: 12,
                  textAlign: 'center',
                  background: '#FFFFFF',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, color: '#0F275A', letterSpacing: 1 }}>
                  ZIMMER BIOMET GCC
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A56DB', margin: '4px 0' }}>
                  {item.label}
                </div>
                {item.qrDataUrl && (
                  <img
                    src={item.qrDataUrl}
                    alt={item.label}
                    style={{ width: 85, height: 85, margin: '0 auto', display: 'block' }}
                  />
                )}
                <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                  {item.subtext}
                </div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#94A3B8' }}>
                  {item.opaqueCode}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ONE-TIME TOKENS */}
      {activeTab === 'tokens' && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            Issue Cryptographic One-Time Booking Token
          </h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Generates a high-security temporary token with single-use atomic redemption, SHA-256 storage, and expiration.
          </p>

          <div style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Purpose / Guest Description
              </label>
              <input
                type="text"
                value={tokenPurpose}
                onChange={(e) => setTokenPurpose(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Validity Period
              </label>
              <select
                value={tokenValidHours}
                onChange={(e) => setTokenValidHours(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              >
                <option value={4}>4 Hours</option>
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours (Standard)</option>
                <option value={72}>72 Hours</option>
              </select>
            </div>

            <button
              onClick={handleGenerateToken}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#1A56DB',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 6,
              }}
            >
              Generate One-Time Token
            </button>
          </div>

          {generatedTokenResult && (
            <div
              style={{
                marginTop: 20,
                background: '#F0F5FA',
                padding: 18,
                borderRadius: 10,
                border: '1px solid #BFDBFE',
                maxWidth: 440,
                display: 'flex',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <img src={generatedTokenResult.qrDataUrl} alt="Token QR" style={{ width: 110, height: 110, borderRadius: 6 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF' }}>TOKEN IDENTIFIER:</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>
                  {generatedTokenResult.tokenIdentifier}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  Expires: {new Date(generatedTokenResult.expiresAt).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: 11, color: '#059669', marginTop: 6, fontWeight: 600 }}>
                  Ready to scan or share with guest
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: POLICIES */}
      {activeTab === 'policies' && policies && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
            Enterprise Booking Governance & Quotas
          </h3>

          <div style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Advance Booking Limit (Days)
              </label>
              <input
                type="number"
                value={policies.maxDeskDaysInAdvance}
                onChange={(e) => setPolicies({ ...policies, maxDeskDaysInAdvance: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Active Future Desk Bookings Quota Per Employee
              </label>
              <input
                type="number"
                value={policies.maxActiveDeskBookingsPerEmployee}
                onChange={(e) => setPolicies({ ...policies, maxActiveDeskBookingsPerEmployee: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Max Meeting Room Duration (Hours)
              </label>
              <input
                type="number"
                value={policies.maxRoomHoursPerBooking}
                onChange={(e) => setPolicies({ ...policies, maxRoomHoursPerBooking: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Auto-Release No-Show Grace Period (Minutes)
              </label>
              <input
                type="number"
                value={policies.autoReleaseGracePeriodMinutes}
                onChange={(e) => setPolicies({ ...policies, autoReleaseGracePeriodMinutes: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>

            <button
              onClick={async () => {
                try {
                  await updatePolicies(policies);
                  setMessage({ type: 'success', text: 'Policies updated successfully!' });
                } catch (err: any) {
                  setMessage({ type: 'error', text: err.message });
                }
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#1A56DB',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Save Policies
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT & SECURITY */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Security Events */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: 16 }}>
              Security Events & Abuse Detections ({securityEvents.length})
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {securityEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: '10px 18px',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        marginRight: 8,
                        background: ev.severity === 'HIGH' ? '#FEE2E2' : '#FEF3C7',
                        color: ev.severity === 'HIGH' ? '#991B1B' : '#92400E',
                      }}
                    >
                      {ev.severity}
                    </span>
                    <strong>{ev.event_type}</strong> — {ev.description}
                  </div>
                  <div style={{ color: '#94A3B8' }}>{new Date(ev.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: 16 }}>
              Administrative Audit Trail ({auditLogs.length})
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 18px',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <strong>{log.action}</strong> by {log.actor_email} ({log.target_type}:{log.target_id})
                  </div>
                  <div style={{ color: '#94A3B8' }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
