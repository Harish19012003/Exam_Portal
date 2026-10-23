import type { ColumnConfig, DataRow } from './types';

// ─── Column Config ─────────────────────────────────────────────────────────────

export const COLUMN_CONFIG: ColumnConfig[] = [
  // All fields shown individually — users group them into composites at runtime via the Layers button
  { key: 'profile_picture', label: 'Avatar', dataType: 'image', order: 1, visible: true, pinned: 'left', width: 60, editable: false },
  { key: 'full_name', label: 'Full Name', dataType: 'text', order: 2, visible: true, pinned: 'left', width: 220, editable: true },
  { key: 'designation', label: 'Designation', dataType: 'text', order: 3, visible: true, pinned: null, width: 180, editable: true },
  { key: 'email', label: 'Email', dataType: 'email', order: 4, visible: true, pinned: null, width: 210, editable: true },
  { key: 'phone_number', label: 'Phone', dataType: 'phone', order: 5, visible: true, pinned: null, width: 155, editable: true },
  { key: 'country', label: 'Country', dataType: 'text', order: 6, visible: true, pinned: null, width: 130, editable: true },
  { key: 'state', label: 'State', dataType: 'text', order: 7, visible: true, pinned: null, width: 120, editable: true },
  { key: 'address', label: 'Address', dataType: 'text', order: 8, visible: true, pinned: null, width: 240, editable: true },
  { key: 'remark', label: 'Remark', dataType: 'text', order: 9, visible: true, pinned: null, width: 190, editable: true },
  { key: 'salary', label: 'Salary', dataType: 'currency', order: 10, visible: true, pinned: null, width: 130, editable: true, aggregation: 'sum' },
  { key: 'joined_date', label: 'Joined', dataType: 'date', order: 11, visible: true, pinned: null, width: 140, editable: true },
  { key: 'is_remote', label: 'Remote', dataType: 'boolean', order: 12, visible: true, pinned: null, width: 90, editable: true },
  { key: 'is_verified', label: 'Verified', dataType: 'checkbox', order: 13, visible: true, pinned: null, width: 90, editable: true },
  { key: 'status', label: 'Status', dataType: 'status', order: 14, visible: true, pinned: 'left', width: 140, editable: true, options: ['Active', 'Inactive', 'Pending'] },
  { key: 'experience', label: 'Experience', dataType: 'number', order: 15, visible: true, pinned: null, width: 130, editable: true, aggregation: 'avg' },
  { key: 'completion', label: 'Completion', dataType: 'progress', order: 16, visible: true, pinned: null, width: 150, editable: true, aggregation: 'avg' },
  { key: 'rating', label: 'Rating', dataType: 'rating', order: 17, visible: true, pinned: null, width: 120, editable: true, aggregation: 'avg' },
  { key: 'roles', label: 'Roles', dataType: 'multiselect', order: 18, visible: true, pinned: null, width: 180, editable: true, options: ['Admin', 'Manager', 'User', 'Editor', 'Reviewer', 'Guest', 'Superadmin', 'Contributor'] },
  { key: 'skills', label: 'Skills', dataType: 'tags', order: 19, visible: true, pinned: null, width: 220, editable: true },
  { key: 'resume', label: 'Resume', dataType: 'attachment', order: 20, visible: true, pinned: null, width: 140, editable: true },
  { key: 'department', label: 'Department', dataType: 'dropdown', order: 21, visible: true, pinned: null, width: 140, editable: true, options: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] },
  { key: 'team_icon', label: 'Team Icon', dataType: 'icon', order: 21.5, visible: true, pinned: null, width: 100, editable: true },
  { key: 'last_login', label: 'Last Login', dataType: 'datetime', order: 22, visible: true, pinned: null, width: 160, editable: true },
  { key: 'shift_time', label: 'Shift Time', dataType: 'time', order: 22.5, visible: true, pinned: null, width: 120, editable: true },
  { key: 'website', label: 'Website', dataType: 'link', order: 23, visible: true, pinned: null, width: 180, editable: true },
  { key: 'bonus', label: 'Bonus (15%)', dataType: 'formula', order: 24, visible: true, pinned: null, width: 140, editable: false, formula: '{salary} * 0.15', resultType: 'number', aggregation: 'sum' },
];

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const RAW_PEOPLE = [
  // Deliberate duplicates added for testing multi-column sorting (Name -> Designation)
  { name: 'John Doe', des: 'Software Engineer', email: 'john.se@techcorp.com', phone: '+1 555 111 0001', country: 'United States', state: 'California', address: '123 Code St, San Francisco', remark: 'Backend specialist', salary: 130000, status: 'Active', joined: '2022-01-15', experience: 5, remote: true, verified: true },
  { name: 'John Doe', des: 'Project Manager', email: 'john.pm@techcorp.com', phone: '+1 555 111 0002', country: 'United States', state: 'New York', address: '456 Plan Ave, New York', remark: 'Agile expert', salary: 145000, status: 'Active', joined: '2021-08-10', experience: 7, remote: false, verified: true },
  { name: 'John Doe', des: 'Data Analyst', email: 'john.da@techcorp.com', phone: '+1 555 111 0003', country: 'United States', state: 'Texas', address: '789 Data Blvd, Austin', remark: 'Excel wizard', salary: 95000, status: 'Active', joined: '2023-03-22', experience: 3, remote: true, verified: false },
  { name: 'Jane Smith', des: 'VP of Sales', email: 'jane.vp@techcorp.com', phone: '+1 555 222 0001', country: 'United States', state: 'Illinois', address: '101 Sell Rd, Chicago', remark: 'Top executive', salary: 190000, status: 'Active', joined: '2020-11-05', experience: 12, remote: false, verified: true },
  { name: 'Jane Smith', des: 'HR Manager', email: 'jane.hr@techcorp.com', phone: '+1 555 222 0002', country: 'United States', state: 'Florida', address: '202 People St, Miami', remark: 'Employee relations', salary: 110000, status: 'Active', joined: '2021-02-14', experience: 8, remote: false, verified: true },
  { name: 'Jane Smith', des: 'Accountant', email: 'jane.ac@techcorp.com', phone: '+1 555 222 0003', country: 'United States', state: 'Washington', address: '303 Math Ave, Seattle', remark: 'CPA certified', salary: 85000, status: 'Pending', joined: '2023-09-01', experience: 4, remote: true, verified: false },

  // Original mock data
  { name: 'Liam Smith', des: 'CEO', email: 'liam@techcorp.com', phone: '+1 555 010 2233', country: 'United States', state: 'California', address: '123 Market St, San Francisco', remark: 'Key decision maker', salary: 180000, status: 'Active', joined: '2021-03-15', experience: 15, remote: false, verified: true },
  { name: 'Emma Johnson', des: 'CTO', email: 'emma@techcorp.com', phone: '+1 555 020 4455', country: 'United States', state: 'New York', address: '456 Broadway, New York', remark: 'Technical lead', salary: 160000, status: 'Active', joined: '2021-06-01', experience: 10, remote: false, verified: true },
  { name: 'Ravi Kumar', des: 'Product Manager', email: 'ravi@example.com', phone: '+91 98765 43210', country: 'India', state: 'Karnataka', address: '789 MG Road, Bengaluru', remark: 'Strong analytical skills', salary: 85000, status: 'Active', joined: '2022-01-10', experience: 6, remote: true, verified: true },
  { name: 'Sophie Müller', des: 'UI/UX Designer', email: 'sophie@design.eu', phone: '+49 30 12345678', country: 'Germany', state: 'Berlin', address: '12 Unter den Linden, Berlin', remark: 'UI/UX specialist', salary: 72000, status: 'Active', joined: '2022-04-20', experience: 5, remote: true, verified: false },
  { name: 'James Wilson', des: 'Sales Director', email: 'james@sales.io', phone: '+44 20 7946 0958', country: 'United Kingdom', state: 'England', address: '10 Downing St, London', remark: 'Top performer', salary: 95000, status: 'Inactive', joined: '2020-09-05', experience: 9, remote: false, verified: true },
  { name: 'Aiko Tanaka', des: 'Backend Engineer', email: 'aiko@jp.tech', phone: '+81 3 1234 5678', country: 'Japan', state: 'Tokyo', address: '1-1 Chiyoda, Tokyo', remark: 'Backend expert', salary: 68000, status: 'Active', joined: '2022-07-12', experience: 4, remote: true, verified: true },
  { name: 'Carlos Mendez', des: 'Marketing Lead', email: 'carlos@market.co', phone: '+52 55 1234 5678', country: 'Mexico', state: 'CDMX', address: 'Paseo de la Reforma, CDMX', remark: 'Growth hacker', salary: 55000, status: 'Pending', joined: '2023-02-28', experience: 3, remote: false, verified: false },
  { name: 'Priya Sharma', des: 'Data Scientist', email: 'priya@data.in', phone: '+91 99887 76655', country: 'India', state: 'Maharashtra', address: 'Bandra West, Mumbai', remark: 'ML expert', salary: 90000, status: 'Active', joined: '2021-11-18', experience: 6, remote: true, verified: true },
  { name: 'Oliver Brown', des: 'DevOps Engineer', email: 'oliver@ops.uk', phone: '+44 161 999 8888', country: 'United Kingdom', state: 'Scotland', address: '5 High St, Edinburgh', remark: 'CI/CD master', salary: 82000, status: 'Active', joined: '2022-03-07', experience: 7, remote: true, verified: true },
  { name: 'Fatima Al-Rashid', des: 'HR Manager', email: 'fatima@hr.ae', phone: '+971 4 555 6677', country: 'UAE', state: 'Dubai', address: 'Downtown Dubai, UAE', remark: 'People first', salary: 78000, status: 'Active', joined: '2021-08-22', experience: 8, remote: false, verified: true },
  { name: 'Lucas Rossi', des: 'Full Stack Dev', email: 'lucas@code.it', phone: '+39 06 12345678', country: 'Italy', state: 'Lazio', address: 'Via Condotti, Rome', remark: 'Frontend wizard', salary: 70000, status: 'Pending', joined: '2023-01-05', experience: 4, remote: true, verified: false },
  { name: 'Mei Lin', des: 'QA Engineer', email: 'mei@qa.cn', phone: '+86 10 1234 5678', country: 'China', state: 'Beijing', address: 'Zhongguancun, Beijing', remark: 'Automation focused', salary: 62000, status: 'Active', joined: '2022-09-14', remote: true, verified: true },
  { name: 'Noah Davis', des: 'Finance Analyst', email: 'noah@finance.us', phone: '+1 312 555 0199', country: 'United States', state: 'Illinois', address: '233 S Wacker Dr, Chicago', remark: 'Numbers person', salary: 88000, status: 'Inactive', joined: '2021-05-30', remote: false, verified: true },
  { name: 'Zara Ahmed', des: 'Legal Counsel', email: 'zara@law.pk', phone: '+92 21 3456 7890', country: 'Pakistan', state: 'Sindh', address: 'Clifton, Karachi', remark: 'Compliance expert', salary: 92000, status: 'Active', joined: '2020-12-01', remote: true, verified: true },
  { name: 'Ethan Taylor', des: 'Cloud Architect', email: 'ethan@cloud.au', phone: '+61 2 9876 5432', country: 'Australia', state: 'New South Wales', address: 'George St, Sydney', remark: 'AWS certified', salary: 125000, status: 'Active', joined: '2021-02-14', remote: true, verified: true },
  { name: 'Anya Petrov', des: 'Security Engineer', email: 'anya@sec.ru', phone: '+7 495 123 4567', country: 'Russia', state: 'Moscow Oblast', address: 'Arbat Street, Moscow', remark: 'Penetration testing', salary: 68000, status: 'Pending', joined: '2023-03-20', remote: true, verified: false },
  { name: 'Kevin Park', des: 'Mobile Developer', email: 'kevin@mobile.kr', phone: '+82 2 1234 5678', country: 'South Korea', state: 'Seoul', address: 'Gangnam-gu, Seoul', remark: 'React Native expert', salary: 74000, status: 'Active', joined: '2022-06-08', remote: false, verified: true },
  { name: 'Isabella Ferreira', des: 'UX Researcher', email: 'isa@ux.br', phone: '+55 11 91234 5678', country: 'Brazil', state: 'São Paulo', address: 'Av. Paulista, SP', remark: 'User empathy', salary: 65000, status: 'Active', joined: '2022-10-25', remote: true, verified: true },
  { name: 'Mohammed Hassan', des: 'AI Engineer', email: 'mhasan@ai.eg', phone: '+20 2 2345 6789', country: 'Egypt', state: 'Cairo', address: 'Tahrir Square, Cairo', remark: 'Deep learning', salary: 58000, status: 'Active', joined: '2022-08-03', remote: true, verified: true },
  { name: 'Chloe Martin', des: 'Scrum Master', email: 'chloe@agile.fr', phone: '+33 1 23 45 67 89', country: 'France', state: 'Île-de-France', address: 'Champs-Élysées, Paris', remark: 'Agile coach', salary: 78000, status: 'Inactive', joined: '2021-04-17', remote: true, verified: false },
  { name: 'Diego Vega', des: 'Backend Developer', email: 'diego@backend.ar', phone: '+54 11 1234 5678', country: 'Argentina', state: 'Buenos Aires', address: 'Florida St, Buenos Aires', remark: 'Node.js expert', salary: 52000, status: 'Active', joined: '2023-05-09', remote: true, verified: true },
  { name: 'Nadia Kowalski', des: 'Business Analyst', email: 'nadia@ba.pl', phone: '+48 22 123 45 67', country: 'Poland', state: 'Masovia', address: 'Nowy Świat, Warsaw', remark: 'Requirements wizard', salary: 61000, status: 'Pending', joined: '2023-06-15', remote: false, verified: false },
  { name: 'Thomas Berg', des: 'Systems Admin', email: 'thomas@sys.se', phone: '+46 8 1234 5678', country: 'Sweden', state: 'Stockholm County', address: 'Stureplan, Stockholm', remark: 'Linux expert', salary: 70000, status: 'Active', joined: '2021-07-04', remote: false, verified: true },
  { name: 'Amara Okonkwo', des: 'Content Manager', email: 'amara@content.ng', phone: '+234 1 234 5678', country: 'Nigeria', state: 'Lagos', address: 'Victoria Island, Lagos', remark: 'SEO driven', salary: 42000, status: 'Active', joined: '2022-11-30', remote: true, verified: true },
  { name: 'Sven Larsson', des: 'Database Admin', email: 'sven@db.no', phone: '+47 22 12 34 56', country: 'Norway', state: 'Oslo', address: 'Karl Johans Gate, Oslo', remark: 'PostgreSQL pro', salary: 76000, status: 'Active', joined: '2021-09-12', remote: true, verified: true },
  { name: 'Yuki Nakamura', des: 'Frontend Developer', email: 'yuki@fe.jp', phone: '+81 6 1234 5678', country: 'Japan', state: 'Osaka', address: 'Namba, Osaka', remark: 'Vue.js specialist', salary: 65000, status: 'Inactive', joined: '2022-02-20', remote: false, verified: false },
  { name: 'Sara Goldstein', des: 'CFO', email: 'sara@finance.il', phone: '+972 3 123 4567', country: 'Israel', state: 'Tel Aviv', address: 'Rothschild Blvd, Tel Aviv', remark: 'Financial strategist', salary: 145000, status: 'Active', joined: '2020-11-08', remote: false, verified: true },
  { name: 'Ahmad Al-Farsi', des: 'Network Engineer', email: 'ahmad@net.sa', phone: '+966 11 123 4567', country: 'Saudi Arabia', state: 'Riyadh', address: 'King Fahd Road, Riyadh', remark: 'Cisco certified', salary: 82000, status: 'Active', joined: '2021-12-19', remote: true, verified: true },
  { name: 'Mia Christensen', des: 'Operations Lead', email: 'mia@ops.dk', phone: '+45 33 12 34 56', country: 'Denmark', state: 'Capital Region', address: 'Strøget, Copenhagen', remark: 'Process optimizer', salary: 79000, status: 'Pending', joined: '2023-04-01', remote: false, verified: false },
  { name: 'Jack Thompson', des: 'Growth Engineer', email: 'jack@growth.ca', phone: '+1 416 555 0123', country: 'Canada', state: 'Ontario', address: 'Bay St, Toronto', remark: 'A/B testing guru', salary: 97000, status: 'Active', joined: '2022-05-22', remote: true, verified: true },
  { name: 'Leila Moradi', des: 'VP Engineering', email: 'leila@vp.ir', phone: '+98 21 1234 5678', country: 'Iran', state: 'Tehran', address: 'Vali-e-Asr, Tehran', remark: 'Engineering leader', salary: 132000, status: 'Active', joined: '2021-01-15', remote: false, verified: true },
  { name: 'Felix Hoffmann', des: 'Blockchain Dev', email: 'felix@chain.de', phone: '+49 89 12345678', country: 'Germany', state: 'Bavaria', address: 'Marienplatz, Munich', remark: 'Solidity expert', salary: 105000, status: 'Active', joined: '2022-08-28', remote: true, verified: true },
  { name: 'Rin Watanabe', des: 'ML Engineer', email: 'rin@ml.jp', phone: '+81 52 1234 5678', country: 'Japan', state: 'Aichi', address: 'Nagoya Station, Nagoya', remark: 'PyTorch wizard', salary: 88000, status: 'Pending', joined: '2023-01-22', remote: true, verified: false },
  { name: 'Camille Dubois', des: 'Art Director', email: 'cam@art.fr', phone: '+33 4 56 78 90 12', country: 'France', state: 'Provence', address: 'La Canebière, Marseille', remark: 'Creative vision', salary: 82000, status: 'Active', joined: '2021-10-10', remote: false, verified: true },
  { name: 'Paulo Oliveira', des: 'Backend Architect', email: 'paulo@arch.br', phone: '+55 21 91234 5678', country: 'Brazil', state: 'Rio de Janeiro', address: 'Copacabana, Rio', remark: 'Java expert', salary: 76000, status: 'Inactive', joined: '2021-03-28', remote: true, verified: true },
  { name: 'Ingrid Svensson', des: 'HR Lead', email: 'ingrid@hr.se', phone: '+46 31 123 456', country: 'Sweden', state: 'Västra Götaland', address: 'Avenyn, Gothenburg', remark: 'Talent acquisition', salary: 68000, status: 'Active', joined: '2022-07-07', remote: false, verified: true },
  { name: 'Ben Chen', des: 'Platform Engineer', email: 'ben@platform.sg', phone: '+65 6789 0123', country: 'Singapore', state: 'Central Region', address: 'Orchard Road, Singapore', remark: 'Kubernetes master', salary: 110000, status: 'Active', joined: '2021-11-05', remote: true, verified: true },
  { name: 'Valentina Cruz', des: 'Social Media', email: 'val@social.co', phone: '+57 1 234 5678', country: 'Colombia', state: 'Bogotá', address: 'Zona Rosa, Bogotá', remark: 'Influencer strategy', salary: 48000, status: 'Pending', joined: '2023-06-01', remote: true, verified: false },
  { name: 'Marcus Johnson', des: 'Site Reliability', email: 'marcus@sre.us', phone: '+1 206 555 0156', country: 'United States', state: 'Washington', address: '4th Ave, Seattle', remark: 'SLO focused', salary: 118000, status: 'Active', joined: '2021-06-14', remote: true, verified: true },
  { name: 'Yuna Kim', des: 'Product Designer', email: 'yuna@design.kr', phone: '+82 51 123 4567', country: 'South Korea', state: 'Busan', address: 'Haeundae, Busan', remark: 'Figma pro', salary: 72000, status: 'Active', joined: '2022-09-19', remote: false, verified: true },
  { name: 'Olga Ivanova', des: 'Tech Lead', email: 'olga@tech.ru', phone: '+7 812 123 4567', country: 'Russia', state: 'Saint Petersburg', address: 'Nevsky Prospekt, SPB', remark: 'Mentorship focus', salary: 72000, status: 'Inactive', joined: '2021-08-01', remote: false, verified: false },
  { name: 'Aaron Lee', des: 'iOS Developer', email: 'aaron@ios.us', phone: '+1 650 555 0182', country: 'United States', state: 'California', address: '1 Infinite Loop, Cupertino', remark: 'Swift expert', salary: 130000, status: 'Active', joined: '2020-10-20', remote: true, verified: true },
  { name: 'Nour El-Din', des: 'Data Engineer', email: 'nour@data.eg', phone: '+20 10 1234 5678', country: 'Egypt', state: 'Alexandria', address: 'Corniche, Alexandria', remark: 'Spark/Hadoop', salary: 55000, status: 'Active', joined: '2022-12-03', remote: true, verified: true },
  { name: 'Hannah Schmidt', des: 'Research Analyst', email: 'hannah@research.de', phone: '+49 211 12345678', country: 'Germany', state: 'NRW', address: 'Königsallee, Düsseldorf', remark: 'Market insights', salary: 69000, status: 'Pending', joined: '2023-03-08', remote: false, verified: false },
  { name: 'Raj Patel', des: 'Android Developer', email: 'raj@android.in', phone: '+91 79 1234 5678', country: 'India', state: 'Gujarat', address: 'CG Road, Ahmedabad', remark: 'Kotlin expert', salary: 70000, status: 'Active', joined: '2022-05-18', remote: true, verified: true },
  { name: 'Sofía Herrera', des: 'Content Writer', email: 'sofia@write.mx', phone: '+52 33 1234 5678', country: 'Mexico', state: 'Jalisco', address: 'Chapultepec, Guadalajara', remark: 'Bilingual writer', salary: 38000, status: 'Active', joined: '2023-04-25', remote: true, verified: true },
  { name: 'Nathan Fox', des: 'BI Developer', email: 'nathan@bi.nz', phone: '+64 9 123 4567', country: 'New Zealand', state: 'Auckland', address: 'Queen St, Auckland', remark: 'Tableau expert', salary: 88000, status: 'Active', joined: '2021-10-30', remote: false, verified: true },
  { name: 'Aria Khalid', des: 'Compliance Officer', email: 'aria@comply.ae', phone: '+971 2 444 5566', country: 'UAE', state: 'Abu Dhabi', address: 'Corniche Rd, Abu Dhabi', remark: 'GDPR specialist', salary: 84000, status: 'Active', joined: '2022-01-28', remote: true, verified: true },
  { name: 'Pierre Leclerc', des: 'Solution Architect', email: 'pierre@arch.fr', phone: '+33 3 45 67 89 01', country: 'France', state: 'Alsace', address: 'Grande Île, Strasbourg', remark: 'Solution design', salary: 91000, status: 'Inactive', joined: '2021-07-17', remote: false, verified: false },
  { name: 'Ting Zhang', des: 'AI Researcher', email: 'ting@ai.cn', phone: '+86 21 1234 5678', country: 'China', state: 'Shanghai', address: 'The Bund, Shanghai', remark: 'NLP specialist', salary: 98000, status: 'Active', joined: '2021-04-05', remote: true, verified: true },
];

const AVATAR_BG = ['6366f1', '14b8a6', 'f59e0b', 'ec4899', '8b5cf6', '06b6d4', 'f97316', '10b981', 'e11d48', '0ea5e9'];

const SUB_TEMPLATES = [
  { name: 'Initial Milestone Requirements', cat: 'Engineering', owner: 'Alex Rivers', dept: 'Core Platform', prio: 'High', status: 'Completed', comp: 100 },
  { name: 'Architecture & Code Review', cat: 'Quality Assurance', owner: 'Sarah Chen', dept: 'DevOps', prio: 'Medium', status: 'Active', comp: 65 },
  { name: 'Final Integration & Testing', cat: 'Product Ops', owner: 'Marcus Vance', dept: 'Product Management', prio: 'Low', status: 'Pending', comp: 20 },
  { name: 'Security Audit & Compliance', cat: 'SecOps', owner: 'Elena Rostova', dept: 'Security', prio: 'High', status: 'Active', comp: 80 },
  { name: 'API Docs & Release Notes', cat: 'Technical Writing', owner: 'David Miller', dept: 'Developer Experience', prio: 'Low', status: 'Completed', comp: 100 },
];

export const MOCK_ROWS: DataRow[] = RAW_PEOPLE.map((p, i) => {
  const countPattern = [2, 4, 1, 3, 5, 2, 4, 3, 1, 2];
  const subCount = countPattern[i % countPattern.length];

  const subRows = Array.from({ length: subCount }, (_, sIdx) => {
    const tmpl = SUB_TEMPLATES[sIdx % SUB_TEMPLATES.length];
    return {
      rowId: `sub_row_${i + 1}_${sIdx + 1}`,
      values: {
        task_id: `TASK-${i + 1}0${sIdx + 1}`,
        task_name: `${p.name.split(' ')[0]}'s ${tmpl.name}`,
        category: tmpl.cat,
        owner: tmpl.owner,
        department: tmpl.dept,
        priority: tmpl.prio,
        status: tmpl.status,
        completion: tmpl.comp,
        budget: (sIdx + 1) * 4500,
        spent: (sIdx + 1) * 3200,
        start_date: '2026-08-01',
        due_date: '2026-10-15',
        is_approved: true,
      },
    };
  });

  return {
    rowId: `row_${String(i + 1).padStart(4, '0')}`,
    version: 1,
    subRows,



  values: {
    profile_picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=${AVATAR_BG[i % AVATAR_BG.length]}&color=fff&size=128&bold=true`,
    full_name: p.name,
    designation: p.des,
    email: p.email,
    phone_number: p.phone,
    country: p.country,
    state: p.state,
    address: p.address,
    remark: p.remark,
    salary: p.salary,
    joined_date: p.joined,
    is_remote: (p as any).remote !== undefined ? p.remote : Math.random() > 0.3,
    is_verified: (p as any).verified !== undefined ? p.verified : Math.random() > 0.5,
    status: p.status,
    experience: (p as any).experience || Math.floor(Math.random() * 20),
    completion: Math.floor(Math.random() * 100),
    rating: Math.floor(Math.random() * 5) + 1,
    roles: ['Admin', 'Manager', 'User', 'Editor', 'Reviewer', 'Guest', 'Superadmin', 'Contributor'].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1),
    skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'Python', 'AWS', 'Docker'].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1),
    department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][Math.floor(Math.random() * 5)],
    team_icon: ['💻', '📈', '🎯', '🤝', '💰', '🚀', '⚡'][Math.floor(Math.random() * 7)],
    last_login: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    shift_time: `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    website: `https://${p.name.replace(/\s+/g, '').toLowerCase()}.demo.com`,
    resume: [
      { id: `res_${i}`, name: `${p.name.split(' ')[0]}_Resume.pdf`, url: `https://example.com/resume_${p.name.replace(/\s+/g, '_').toLowerCase()}.pdf`, type: 'file' },
      { id: `img_${i}`, name: 'Profile_Shot.jpg', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=${AVATAR_BG[i % AVATAR_BG.length]}&color=fff&size=128&bold=true`, type: 'image' }
    ],
  },
};
});

