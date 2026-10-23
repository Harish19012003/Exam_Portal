import React, { useState, useEffect, useRef } from 'react';
import { DynamicTable, VENDOR_COLUMN_CONFIG, VENDOR_ROWS } from '../components/DynamicTable';
import {
  Building2,
  Plus,
  UploadCloud,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  FileText,
} from 'lucide-react';
import { apiClient } from '../api/client';
import './UsersPage.css';

export const VendorsPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           localStorage.getItem('theme') === 'dark';
  });

  const [rows, setRows] = useState(VENDOR_ROWS);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add Vendor Form state
  const [vendorForm, setVendorForm] = useState({
    vendor_code: '',
    vendor_name: '',
    phone_number: '',
    email: '',
    status: 'Active',
  });

  // Bulk Upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchVendorsFromBackend = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/vendors');
      const list = res.data?.data || res.data;
      if (Array.isArray(list) && list.length > 0) {
        const mapped = list.map((v) => ({
          rowId: v.vendor_code,
          version: v.version || 1,
          values: {
            vendor_code: v.vendor_code,
            vendor_name: v.vendor_name,
            phone_number: v.phone_number,
            email: v.email,
            status: v.status || 'Active',
          },
        }));
        setRows(mapped);
      }
    } catch {
      // Seamlessly retain default vendor master records if backend table is not yet populated
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('dynamic_table_prefs_vendor_master_data');
      localStorage.removeItem('dynamic_table_prefs_vendor_master_data_v2');
      localStorage.removeItem('dynamic_table_prefs_vendor_master_data_v7');
    } catch {
      // ignore
    }
    fetchVendorsFromBackend();
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const openCreateModal = () => {
    setVendorForm({
      vendor_code: '', // Manually added by user (no auto-generation)
      vendor_name: '',
      phone_number: '',
      email: '',
      status: 'Active',
    });
    setErrorMsg('');
    setIsCreateModalOpen(true);
  };

  // ── Persistent Row Update to MySQL Database ─────────────────────────────────
  const handleRowUpdate = async (rowId, updatedValues, updatedRow) => {
    try {
      const vendorCode = rowId || updatedValues?.vendor_code || updatedRow?.values?.vendor_code;
      if (!vendorCode) return;

      const payload = { ...updatedValues };
      delete payload.vendor_code; // Primary key cannot be updated

      // Clean empty strings to null for database
      for (const [key, val] of Object.entries(payload)) {
        if (val === '') payload[key] = null;
      }

      const res = await apiClient.patch(`/vendors/${encodeURIComponent(vendorCode)}`, payload);
      const updatedVendor = res.data?.data || res.data;

      setRows((prev) =>
        prev.map((r) => {
          if (r.rowId === vendorCode) {
            return {
              ...r,
              version: updatedVendor?.version || (r.version || 1) + 1,
              values: { ...r.values, ...payload, ...(updatedVendor || {}) },
            };
          }
          return r;
        })
      );

      setSuccessMsg(`Vendor "${vendorCode}" updated successfully.`);
      setErrorMsg('');
    } catch (err) {
      console.error('Failed to update vendor:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to update vendor in database.';
      setErrorMsg(errMsg);
      fetchVendorsFromBackend();
    }
  };

  // ── Persistent Row Delete to MySQL Database ─────────────────────────────────
  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    if (ids.length === 0) return;

    try {
      await Promise.all(
        ids.map((id) => apiClient.delete(`/vendors/${encodeURIComponent(id)}`))
      );

      const idSet = new Set(ids);
      setRows((prev) => prev.filter((r) => !idSet.has(r.rowId)));

      setSuccessMsg(
        ids.length === 1
          ? `Vendor "${ids[0]}" deleted successfully.`
          : `${ids.length} vendors deleted successfully.`
      );
      setErrorMsg('');
    } catch (err) {
      console.error('Failed to delete vendor(s):', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete vendor from database.';
      setErrorMsg(errMsg);
      fetchVendorsFromBackend();
    }
  };

  const handleCreateVendorSubmit = async (e) => {
    e.preventDefault();
    const vCode = vendorForm.vendor_code.trim();
    if (!vCode) {
      setErrorMsg('Vendor Code is required.');
      return;
    }
    if (!vendorForm.vendor_name.trim()) {
      setErrorMsg('Vendor Name is required.');
      return;
    }

    // 1. Client-side duplicate check
    const isDuplicate = rows.some((r) => {
      const code = (r.values?.vendor_code || r.rowId || '').toString().trim().toLowerCase();
      return code === vCode.toLowerCase();
    });
    if (isDuplicate) {
      setErrorMsg('Vendor code is already in the data');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        vendor_code: vCode,
        vendor_name: vendorForm.vendor_name.trim(),
        phone_number: vendorForm.phone_number.trim() || null,
        email: vendorForm.email.trim() || null,
        status: vendorForm.status || 'Active',
      };

      // 2. Save to Backend MySQL API
      try {
        await apiClient.post('/vendors', payload);
      } catch (err) {
        const backendMsg = err.response?.data?.message || err.message || '';
        if (
          err.response?.status === 409 ||
          backendMsg.toLowerCase().includes('already exists') ||
          backendMsg.toLowerCase().includes('duplicate')
        ) {
          setErrorMsg('Vendor code is already in the data');
        } else {
          setErrorMsg(backendMsg || 'Failed to create vendor. Please check input values.');
        }
        return; // Halt immediately! Do not add to local state if duplicate or error!
      }

      // 3. Prepend to local table rows state immediately
      const newRow = {
        rowId: payload.vendor_code,
        version: 1,
        values: payload,
      };
      setRows((prev) => [newRow, ...prev.filter((r) => r.rowId !== payload.vendor_code)]);

      setSuccessMsg(`Vendor "${payload.vendor_name}" (${payload.vendor_code}) created successfully.`);
      setIsCreateModalOpen(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create vendor. Please check input values.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── CSV Parsing & Bulk Upload ────────────────────────────────────────────────

  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one data row.');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    const expectedHeaders = ['vendor_code', 'vendor_name'];
    const missing = expectedHeaders.filter((req) => !headers.includes(req));
    if (missing.length > 0) {
      throw new Error(`Missing required CSV header columns: ${missing.join(', ')}`);
    }

    const parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      // Basic CSV split respecting quotes
      const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      if (values.length < 2) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] !== undefined ? values[idx] : '';
      });

      if (obj.vendor_code && obj.vendor_name) {
        parsedRows.push({
          vendor_code: obj.vendor_code,
          vendor_name: obj.vendor_name,
          phone_number: obj.phone_number || obj.phone || null,
          email: obj.email || null,
          status: obj.status || 'Active',
        });
      }
    }

    if (parsedRows.length === 0) {
      throw new Error('No valid vendor rows found in the CSV file.');
    }

    return parsedRows;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Please upload a valid .csv file.');
      return;
    }
    setCsvFile(file);
    setCsvError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const parsed = parseCSV(text);
        setCsvData(parsed);
      } catch (err) {
        setCsvError(err.message);
        setCsvData([]);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'vendor_code,vendor_name,phone_number,email,status\n' +
      'VND-9001,Acme Examination Logistics,+1 555-0199,billing@acme-exam.com,Active\n' +
      'VND-9002,Global AI Proctoring Lab,+44 20 7946 0199,procure@aiproctor.co.uk,Active';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Vendor_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkUploadSubmit = async () => {
    if (csvData.length === 0) {
      setCsvError('Please select a CSV file with valid vendor records first.');
      return;
    }

    try {
      setBulkUploading(true);
      setCsvError('');

      // Send to backend seed endpoint
      try {
        await apiClient.post('/vendors/seed', { vendors: csvData });
      } catch (err) {
        console.warn('API bulk seed notice:', err.response?.data?.message || err.message);
      }

      // Add to local state rows
      const newRows = csvData.map((v) => ({
        rowId: v.vendor_code,
        version: 1,
        values: v,
      }));

      const incomingCodes = new Set(newRows.map((r) => r.rowId));
      setRows((prev) => [...newRows, ...prev.filter((r) => !incomingCodes.has(r.rowId))]);

      setSuccessMsg(`Successfully imported ${csvData.length} vendors.`);
      setIsBulkUploadModalOpen(false);
      setCsvFile(null);
      setCsvData([]);
    } catch (err) {
      setCsvError(err.response?.data?.message || 'Failed to complete bulk upload.');
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: '800',
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Vendor Data
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginTop: '6px',
              margin: 0,
              maxWidth: '780px',
              lineHeight: 1.5,
            }}
          >
            Manage and update vendor details and supplier records.
          </p>
        </div>

        {/* Action Buttons on the Right Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="bulk-upload-trigger-btn"
            onClick={() => {
              setCsvError('');
              setCsvFile(null);
              setCsvData([]);
              setIsBulkUploadModalOpen(true);
            }}
            title="Bulk import vendors via CSV"
            style={{
              minHeight: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              fontWeight: '600',
              fontSize: '13px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <UploadCloud size={16} />
            <span>Bulk Upload</span>
          </button>

          <button
            type="button"
            className="add-user-btn"
            onClick={openCreateModal}
            title="Add new vendor"
            style={{
              minHeight: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontWeight: '600',
              fontSize: '13px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
            color: isDarkMode ? '#34d399' : '#065f46',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '4px',
            }}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Vendor Data Table */}
      <div style={{ flex: 1, minHeight: '650px', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <DynamicTable
          tableId="vendor_master_data_v3"
          shareState={false}
          initialColumns={VENDOR_COLUMN_CONFIG}
          initialRows={rows}
          onRowUpdate={handleRowUpdate}
          onRowDelete={handleRowDelete}
          onRefresh={fetchVendorsFromBackend}
          showAddRow={false}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* ── ADD VENDOR SLIDE-IN MODAL / DRAWER ───────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="modal-content drawer-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Add New Vendor"
            style={{ maxWidth: '640px', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={20} className="modal-title-icon" />
                  <span>Add New Vendor</span>
                </h2>
                <p className="modal-subtitle">
                  Register a new supplier profile in the MySQL vendor registry.
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVendorSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {errorMsg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={15} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Vendor Code & Name */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="vendor_code">
                      Vendor Code <span className="required-star">*</span>
                    </label>
                    <div className="input-with-icon">
                      <FileText size={16} className="input-icon" />
                      <input
                        id="vendor_code"
                        type="text"
                        className="form-input"
                        placeholder="e.g. VND-1050"
                        value={vendorForm.vendor_code}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVendorForm({ ...vendorForm, vendor_code: val });
                          if (val.trim()) {
                            const isDup = rows.some((r) => {
                              const code = (r.values?.vendor_code || r.rowId || '').toString().trim().toLowerCase();
                              return code === val.trim().toLowerCase();
                            });
                            if (isDup) {
                              setErrorMsg('Vendor code is already in the data');
                            } else if (errorMsg === 'Vendor code is already in the data') {
                              setErrorMsg('');
                            }
                          }
                        }}
                        required
                      />
                    </div>
                    {vendorForm.vendor_code.trim() &&
                      rows.some(
                        (r) =>
                          (r.values?.vendor_code || r.rowId || '').toString().trim().toLowerCase() ===
                          vendorForm.vendor_code.trim().toLowerCase()
                      ) && (
                        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>
                          Vendor code is already in the data
                        </span>
                      )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="vendor_name">
                      Vendor Name <span className="required-star">*</span>
                    </label>
                    <div className="input-with-icon">
                      <Building2 size={16} className="input-icon" />
                      <input
                        id="vendor_name"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Amazon Web Services"
                        value={vendorForm.vendor_name}
                        onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Phone & Email */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="vendor_phone">
                      Vendor Phone Number
                    </label>
                    <div className="input-with-icon">
                      <Phone size={16} className="input-icon" />
                      <input
                        id="vendor_phone"
                        type="text"
                        className="form-input"
                        placeholder="+1 555-0199"
                        value={vendorForm.phone_number}
                        onChange={(e) => setVendorForm({ ...vendorForm, phone_number: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="vendor_email">
                      Vendor Email
                    </label>
                    <div className="input-with-icon">
                      <Mail size={16} className="input-icon" />
                      <input
                        id="vendor_email"
                        type="email"
                        className="form-input"
                        placeholder="procurement@vendor.com"
                        value={vendorForm.email}
                        onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="form-group">
                  <label className="form-label" htmlFor="vendor_status">
                    Status
                  </label>
                  <select
                    id="vendor_status"
                    className="form-select"
                    value={vendorForm.status}
                    onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    submitting ||
                    Boolean(
                      vendorForm.vendor_code.trim() &&
                        rows.some(
                          (r) =>
                            (r.values?.vendor_code || r.rowId || '').toString().trim().toLowerCase() ===
                            vendorForm.vendor_code.trim().toLowerCase()
                        )
                    )
                  }
                >
                  {submitting ? 'Saving...' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BULK UPLOAD CSV MODAL / DRAWER ─────────────────────────────────── */}
      {isBulkUploadModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBulkUploadModalOpen(false)}>
          <div
            className="modal-content modal-bulk-upload drawer-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Bulk Upload Vendors from CSV"
            style={{ maxWidth: '640px', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UploadCloud size={20} className="modal-title-icon" />
                  <span>Bulk Upload Vendors (CSV)</span>
                </h2>
                <p className="modal-subtitle">
                  Import multiple vendor profiles at once using a formatted CSV spreadsheet.
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsBulkUploadModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body bulk-upload-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Requirements & Template Info Card */}
              <div className="csv-requirements-card">
                <div className="csv-req-header">
                  <FileSpreadsheet size={18} className="req-header-icon" />
                  <strong>CSV Column Requirements</strong>
                </div>
                <div className="csv-req-content">
                  <p className="csv-req-desc">
                    Your CSV spreadsheet must include a header row with at least these column keys:
                  </p>
                  <ul className="csv-req-list">
                    <li>
                      <span className="req-pill required">Required</span>
                      <code>vendor_code</code> — Unique code (e.g. <code>VND-1051</code>)
                    </li>
                    <li>
                      <span className="req-pill required">Required</span>
                      <code>vendor_name</code> — Legal company / entity name
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>phone_number</code>, <code>email</code>, <code>status</code>
                    </li>
                  </ul>
                </div>

                <div className="csv-template-download-row" style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn-download-template"
                    onClick={handleDownloadTemplate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary-color)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={15} />
                    <span>Download Sample Vendor CSV Template</span>
                  </button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                className={`csv-drop-zone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '10px',
                  padding: '28px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragActive
                    ? isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff'
                    : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <UploadCloud
                  size={38}
                  style={{ color: 'var(--primary-color)', margin: '0 auto 10px auto' }}
                />
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {csvFile ? csvFile.name : 'Click to browse or drop your vendor CSV file here'}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Supports .csv files with UTF-8 encoding
                </p>
              </div>

              {/* Error Alert */}
              {csvError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {csvData.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Ready to import ({csvData.length} records parsed)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Previewing first 5 rows
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '8px 10px', fontWeight: '700' }}>Vendor Code</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700' }}>Vendor Name</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700' }}>Phone</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700' }}>Email</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 5).map((v, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: '600' }}>{v.vendor_code}</td>
                            <td style={{ padding: '8px 10px', fontWeight: '500' }}>{v.vendor_name}</td>
                            <td style={{ padding: '8px 10px' }}>{v.phone_number || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>{v.email || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>{v.status || 'Active'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsBulkUploadModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={bulkUploading || csvData.length === 0}
                onClick={handleBulkUploadSubmit}
              >
                {bulkUploading ? 'Importing Vendors...' : `Upload & Import (${csvData.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorsPage;
