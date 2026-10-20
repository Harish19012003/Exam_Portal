import React, { useState, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Clock,
  Search,
  List,
  LayoutGrid,
  RotateCw,
  Plus,
  MoreVertical,
  TableProperties,
  Sparkles,
} from 'lucide-react';
import { DynamicTable } from '../components/DynamicTable';
import './ExamsPage.css';

const EXAM_COLUMNS = [
  { key: 'sn', label: 'S.N', dataType: 'number', order: 1, visible: true, pinned: 'left', width: 65, editable: false },
  { key: 'code', label: 'CODE', dataType: 'code', order: 2, visible: true, pinned: 'left', width: 115, editable: true },
  { key: 'name', label: 'NAME', dataType: 'text', order: 3, visible: true, pinned: null, width: 310, editable: true },
  { key: 'status', label: 'STATUS', dataType: 'status', order: 4, visible: true, pinned: null, width: 110, editable: true, options: ['ACTIVE', 'INACTIVE', 'PENDING'] },
  { key: 'delPwd', label: 'DEL PWD', dataType: 'mono', order: 5, visible: true, pinned: null, width: 110, editable: true },
  { key: 'admPwd', label: 'ADM PWD', dataType: 'mono', order: 6, visible: true, pinned: null, width: 110, editable: true },
  { key: 'addedBy', label: 'ADDED BY', dataType: 'text', order: 7, visible: true, pinned: null, width: 120, editable: true },
  { key: 'demo', label: 'DEMO', dataType: 'dot', order: 8, visible: true, pinned: null, width: 85, editable: true },
  { key: 'nonAadh', label: 'NON-AADH', dataType: 'dot', order: 9, visible: true, pinned: null, width: 110, editable: true },
  { key: 'fr', label: 'FR', dataType: 'dot', order: 10, visible: true, pinned: null, width: 85, editable: true },
  { key: 'shifts', label: 'SHIFTS', dataType: 'number', order: 11, visible: true, pinned: null, width: 95, editable: true, aggregation: 'sum' },
  { key: 'centres', label: 'CENTRES', dataType: 'number', order: 12, visible: true, pinned: null, width: 105, editable: true, aggregation: 'sum' },
  { key: 'created', label: 'CREATED', dataType: 'text', order: 13, visible: true, pinned: null, width: 130, editable: true },
];

export const ExamsPage = () => {
  const [viewMode, setViewMode] = useState('dynamic'); // 'dynamic' (Option A Table) or 'classic'
  const [activeTab, setActiveTab] = useState('Upcoming'); // 'All' | 'Upcoming' | 'Today'
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const mockExams = [
    { sn: 1, code: 'luvas10', name: 'LUVAS_(Veterinary and Livestock Devel...', status: 'ACTIVE', delPwd: 'dsds44', admPwd: 'h9un', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 5, centres: 9, created: '08 Oct 2026' },
    { sn: 2, code: 'jkssb35', name: 'JKSSB_(FEMALE MPHW MALE MULTI P...', status: 'ACTIVE', delPwd: 'rfy6', admPwd: '77d7', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 5, centres: 38, created: '08 Oct 2026' },
    { sn: 3, code: 'uiams30', name: 'UIAMS_(TGT Sanskrit)_10 Oct\'26 Eveni...', status: 'ACTIVE', delPwd: 'hg44', admPwd: 'khgq', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 4, centres: 1, created: '08 Oct 2026' },
    { sn: 4, code: 'uiams29', name: 'UIAMS_(Steno-Typist (English))_10 Oct...', status: 'ACTIVE', delPwd: '1i54', admPwd: 'qbjk', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 4, centres: 1, created: '08 Oct 2026' },
    { sn: 5, code: 'uksssc88', name: 'UKSSSC_(Advt_Id_77/UKSSSC/2026,7...', status: 'ACTIVE', delPwd: 'ddd3', admPwd: 'z6u7', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 6, centres: 17, created: '08 Oct 2026' },
    { sn: 6, code: 'aima49', name: 'AIMA_(DELHI HIGHER JUDICIAL SERV...', status: 'ACTIVE', delPwd: 'gtr4', admPwd: 'vc5j', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 8, centres: 1, created: '07 Oct 2026' },
    { sn: 7, code: 'nitttr38', name: 'NITTTR_(CLERK)_11 Oct\'26', status: 'ACTIVE', delPwd: 'de22', admPwd: 'hmcc', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 7, centres: 185, created: '06 Oct 2026' },
    { sn: 8, code: 'mppolice9', name: 'MPPOLICE_(AST JAIL SUP, WARDER)_...', status: 'ACTIVE', delPwd: 'aaqq', admPwd: 'uods', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 14, centres: 1, created: '06 Oct 2026' },
    { sn: 9, code: 'uiams28', name: 'UIAMS_(DEPUTY MANAGER - 2026)_3...', status: 'ACTIVE', delPwd: '1op455', admPwd: '07u0', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 13, centres: 4, created: '01 Oct 2026' },
    { sn: 10, code: 'upprpb35', name: 'UPPRPB (UPPRPB_( Constable Civil Pol...', status: 'ACTIVE', delPwd: 'vu6r', admPwd: '08nm', addedBy: 'Santosh', demo: false, nonAadh: true, fr: true, shifts: 14, centres: 16, created: '28 Sept 2026' },
  ];

  const examRows = mockExams.map((e) => ({
    rowId: `exam_${e.sn}`,
    version: 1,
    values: {
      sn: e.sn,
      code: e.code,
      name: e.name,
      status: e.status,
      delPwd: e.delPwd,
      admPwd: e.admPwd,
      addedBy: e.addedBy,
      demo: e.demo,
      nonAadh: e.nonAadh,
      fr: e.fr,
      shifts: e.shifts,
      centres: e.centres,
      created: e.created,
    },
  }));

  const filteredExamRows = examRows.filter((row) => {
    const e = row.values;
    if (activeTab === 'Upcoming' && e.sn > 7) return false;
    if (activeTab === 'Today' && (e.sn < 3 || e.sn > 6)) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        String(e.code).toLowerCase().includes(q) ||
        String(e.name).toLowerCase().includes(q) ||
        String(e.delPwd).toLowerCase().includes(q) ||
        String(e.admPwd).toLowerCase().includes(q) ||
        String(e.addedBy).toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="exams-page">
      {/* Top Header Row: Title & Actions */}
      <div className="exams-header-bar">
        <div className="exams-title-group">
          <h1 className="exams-title">Exam management</h1>
          <span className="exams-badge">{filteredExamRows.length} total</span>
        </div>

        <div className="exams-top-actions">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'dynamic' ? 'active' : ''}`}
              onClick={() => setViewMode('dynamic')}
              title="Dynamic Table (Option A Default)"
            >
              <TableProperties size={13} />
              <span>Option A Grid</span>
            </button>
            <button
              className={`view-btn ${viewMode === 'classic' ? 'active' : ''}`}
              onClick={() => setViewMode('classic')}
              title="Classic List View"
            >
              <List size={13} />
              <span>Classic</span>
            </button>
          </div>

          <button className="action-btn secondary" onClick={() => window.location.reload()} title="Refresh list">
            <RotateCw size={13} />
            <span>Refresh</span>
          </button>
          <button className="action-btn primary" title="Create new exam">
            <Plus size={14} />
            <span>New exam</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="exams-toolbar">
        <div className="toolbar-left">
          <div className="filter-group">
            <button
              className={`filter-btn ${activeTab === 'All' ? 'active' : ''}`}
              onClick={() => setActiveTab('All')}
            >
              <Layers size={13} />
              <span>All</span>
            </button>
            <button
              className={`filter-btn ${activeTab === 'Upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('Upcoming')}
            >
              <Calendar size={13} />
              <span>Upcoming</span>
            </button>
            <button
              className={`filter-btn ${activeTab === 'Today' ? 'active' : ''}`}
              onClick={() => setActiveTab('Today')}
            >
              <Clock size={13} />
              <span>Today</span>
            </button>
          </div>

          <div className="search-container">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search code, name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="toolbar-right">
          <span className="exams-active-count">Showing {filteredExamRows.length} exams</span>
        </div>
      </div>

      {viewMode === 'dynamic' ? (
        <div className="dynamic-table-wrapper" style={{ minHeight: '600px' }}>
          <DynamicTable
            tableId="exams_table"
            isDarkMode={isDarkMode}
            initialColumns={EXAM_COLUMNS}
            initialRows={filteredExamRows}
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="exams-table">
            <thead>
              <tr>
                <th>S.N</th>
                <th>CODE</th>
                <th>NAME</th>
                <th>STATUS</th>
                <th>DEL PWD</th>
                <th>ADM PWD</th>
                <th>ADDED BY</th>
                <th className="text-center">DEMO</th>
                <th className="text-center">NON-AADH</th>
                <th className="text-center">FR</th>
                <th>SHIFTS</th>
                <th>CENTRES</th>
                <th>CREATED</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredExamRows.map((r) => {
                const exam = r.values;
                return (
                  <tr key={exam.code}>
                    <td>{exam.sn}</td>
                    <td className="color-primary">{exam.code}</td>
                    <td>{exam.name}</td>
                    <td><span className="status-badge active">{exam.status}</span></td>
                    <td>{exam.delPwd}</td>
                    <td>{exam.admPwd}</td>
                    <td>{exam.addedBy}</td>
                    <td><div className={`status-dot ${exam.demo ? 'true' : 'false'}`}></div></td>
                    <td><div className={`status-dot ${exam.nonAadh ? 'true' : 'false'}`}></div></td>
                    <td><div className={`status-dot ${exam.fr ? 'true' : 'false'}`}></div></td>
                    <td>{exam.shifts}</td>
                    <td>{exam.centres}</td>
                    <td>{exam.created}</td>
                    <td>
                      <button className="more-btn" title="More Options">
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
