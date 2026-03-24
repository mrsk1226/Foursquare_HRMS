import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Download, Filter, CalendarCheck, CalendarOff, Receipt, Users,
  TrendingDown, TrendingUp, Search, CheckSquare
} from 'lucide-react';

const HARDCODED_DEPTS = [
  'Sales', 'Operations', 'Accounts', 'HR', 'Design', 'Production', 
  'Installation', 'Service', 'Procurement', 'Admin', 'Management', 
  'Quotations', 'Cutting Sheet', 'Warehouse', 'Marketing', 'Finance'
];

const COLORS = ['#26A69A', '#1E3A5F', '#28A745', '#FFC107', '#DC3545', '#6f42c1', '#fd7e14'];
const PIE_COLORS = { Active: '#28A745', Inactive: '#DC3545', Male: '#2E86AB', Female: '#e83e8c', Other: '#6c757d' };
const STATUS_COLORS = { approved: '#28A745', pending: '#FFC107', rejected: '#DC3545' };

export default function Reports() {
  const [reportType, setReportType] = useState('attendance');
  const [loading, setLoading] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);

  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterDept, setFilterDept] = useState('All');
  
  const [allDepts, setAllDepts] = useState(HARDCODED_DEPTS);

  // Employee Multi-select State
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmps, setSelectedEmps] = useState([]); // array of employee_ids
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  useEffect(() => {
    fetchRawData();
  }, [filterStartDate, filterEndDate]);

  const fetchRawData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('employees').select('*');
      const emps = empData || [];
      setEmployees(emps);
      setSelectedEmps(emps.map(e => e.employee_id)); // default select all

      // Merge dynamic depts from DB
      const dbDepts = emps.map(e => e.department).filter(Boolean);
      const mergedDepts = Array.from(new Set(['All', ...HARDCODED_DEPTS, ...dbDepts]));
      setAllDepts(mergedDepts);

      const { data: attData } = await supabase.from('attendance_logs').select('*, employees(full_name, department)').gte('date', filterStartDate).lte('date', filterEndDate);
      setAttendance(attData || []);

      const { data: levData } = await supabase.from('leave_requests').select('*, employees(full_name, department)').gte('start_date', filterStartDate).lte('start_date', filterEndDate);
      setLeaves(levData || []);

      const { data: payData } = await supabase.from('payroll').select('*, employees(full_name, department)');
      setPayroll(payData || []);

    } catch (err) {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const deptFilter = (record) => filterDept === 'All' || record?.employees?.department === filterDept || record?.department === filterDept;
  const empFilter = (record) => selectedEmps.includes(record?.employee_id);

  const handleExportCSV = (filename, headers, rows) => {
    if (rows.length === 0) return toast.error("No data to export");
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Report downloaded');
  };

  const REPORT_TABS = [
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'leaves', label: 'Leave', icon: CalendarOff },
    { id: 'payroll', label: 'Payroll', icon: Receipt },
    { id: 'employee', label: 'Employee', icon: Users },
  ];

  const filteredEmployeesList = employees.filter(e => e.full_name?.toLowerCase().includes(empSearch.toLowerCase()) || e.employee_id?.toLowerCase().includes(empSearch.toLowerCase()));

  const handleSelectAllEmps = (e) => {
    if (e.target.checked) setSelectedEmps(employees.map(emp => emp.employee_id));
    else setSelectedEmps([]);
  };

  const toggleEmp = (id) => {
    if (selectedEmps.includes(id)) setSelectedEmps(selectedEmps.filter(e => e !== id));
    else setSelectedEmps([...selectedEmps, id]);
  };

  const renderAttendanceReport = () => {
    const filteredAtt = attendance.filter(a => deptFilter(a) && empFilter(a));
    
    const dailyMap = {};
    filteredAtt.forEach(a => {
      if(!dailyMap[a.date]) dailyMap[a.date] = { date: a.date, Present: 0, Absent: 0, Late: 0 };
      if (a.status === 'present') dailyMap[a.date].Present += 1;
      else if (a.status === 'absent') dailyMap[a.date].Absent += 1;
      else if (a.status === 'late') dailyMap[a.date].Late += 1;
    });
    const dailyTrend = Object.values(dailyMap).sort((a,b) => new Date(a.date) - new Date(b.date));

    // Department Heatmap (Bar)
    const deptMap = {};
    filteredAtt.forEach(a => {
      const d = a.employees?.department || 'Unknown';
      if(!deptMap[d]) deptMap[d] = { name: d, count: 0 };
      if (a.status === 'present') deptMap[d].count += 1;
    });
    const deptTrend = Object.values(deptMap);

    const empAgg = {};
    filteredAtt.forEach(a => {
      const id = a.employee_id;
      if (!empAgg[id]) empAgg[id] = { id, name: a.employees?.full_name, present: 0, absent: 0, late: 0, total: 0 };
      empAgg[id].total += 1;
      if (a.status === 'present') empAgg[id].present += 1;
      else if (a.status === 'absent') empAgg[id].absent += 1;
      else if (a.status === 'late') empAgg[id].late += 1;
    });
    const empTable = Object.values(empAgg).map(e => ({ ...e, percentage: ((e.present / Math.max(e.total, 1)) * 100).toFixed(1) }));

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-end mb-4">
          <button onClick={() => handleExportCSV('Attendance_Report', ['Employee', 'Present', 'Absent', 'Late', 'Att %'], empTable.map(e => [`"${e.name}"`, e.present, e.absent, e.late, `${e.percentage}%`]))} className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
             <Download className="w-4 h-4 mr-2" /> Export CSV
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-[#1E3A5F] mb-6">Daily Attendance Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <RechartsTooltip cursor={{fill: '#f5f6fa'}} />
                  <Legend />
                  <Bar dataKey="Present" stackId="a" fill="#26A69A" />
                  <Bar dataKey="Late" stackId="a" fill="#FFC107" />
                  <Bar dataKey="Absent" stackId="a" fill="#DC3545" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-[#1E3A5F] mb-6">Department Presence</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptTrend} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                  <RechartsTooltip cursor={{fill: '#f5f6fa'}} />
                  <Bar dataKey="count" name="Days Present" fill="#26A69A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaveReport = () => {
    const filteredLev = leaves.filter(l => deptFilter(l) && empFilter(l));
    const typeCount = { Casual: 0, Sick: 0, Annual: 0, Unpaid: 0 };
    filteredLev.forEach(l => { if (typeCount[l.leave_type] !== undefined) typeCount[l.leave_type] += 1; });
    const typeData = Object.entries(typeCount).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));

    const statusCount = { approved: 0, Pending: 0, rejected: 0 };
    filteredLev.forEach(l => { if (statusCount[l.status] !== undefined) statusCount[l.status] += 1; });
    const statusData = Object.entries(statusCount).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));

    const deptLev = {};
    filteredLev.forEach(l => { const d = l.employees?.department || 'Unknown'; deptLev[d] = (deptLev[d] || 0) + 1; });
    const deptLevData = Object.entries(deptLev).map(([name, count]) => ({ name, count }));

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h3 className="font-bold text-[#1E3A5F] mb-6 text-center">Requests by Type</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={typeData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{typeData.map((e, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend verticalAlign="bottom" height={36}/></PieChart></ResponsiveContainer></div></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h3 className="font-bold text-[#1E3A5F] mb-6 text-center">Approval Status</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} outerRadius={80} dataKey="value" label>{statusData.map((e, index) => <Cell key={index} fill={STATUS_COLORS[e.name?.toLowerCase()] || '#26A69A'} />)}</Pie><RechartsTooltip /><Legend verticalAlign="bottom" height={36} formatter={(val) => val.toUpperCase()} /></PieChart></ResponsiveContainer></div></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h3 className="font-bold text-[#1E3A5F] mb-6">Volume by Department</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={deptLevData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} /><YAxis tick={{fontSize: 12}} /><RechartsTooltip cursor={{fill: '#f5f6fa'}} /><Bar dataKey="count" name="Leaves" fill="#26A69A" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        </div>
      </div>
    );
  };

  const renderEmployeeReport = () => {
    const filteredEmp = employees.filter(e => deptFilter(e) && empFilter(e));
    
    // Headcount Dept - Real data
    const hDept = {};
    filteredEmp.forEach(e => { 
      if (e.department) hDept[e.department] = (hDept[e.department] || 0) + 1; 
    });
    const hDeptData = Object.entries(hDept).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
           <h3 className="font-bold text-[#1E3A5F] mb-6">Headcount by Department</h3>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={hDeptData} layout="vertical">
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                 <XAxis type="number" />
                 <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                 <RechartsTooltip cursor={{fill: '#f5f6fa'}} />
                 <Bar dataKey="value" name="Employees" fill="#26A69A" radius={[0, 4, 4, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    );
  };

  const renderPayrollReport = () => {
    return <div className="p-8 text-center bg-white rounded-xl">Payroll charts loading...</div>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">Cross-departmental performance and HR statistics.</p>
        </div>

        <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
             <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#26A69A]"/>
          </div>
          <div className="flex flex-col">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
             <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#26A69A]"/>
          </div>
          <div className="flex flex-col">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Department</label>
             <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#26A69A]">
               {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
             </select>
          </div>
          <div className="flex flex-col relative">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Employees</label>
             <button onClick={() => setShowEmpDropdown(!showEmpDropdown)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-left flex justify-between items-center text-sm">
                {selectedEmps.length === employees.length ? 'All Employees Selected' : `${selectedEmps.length} Selected`}
             </button>
             {showEmpDropdown && (
               <div className="absolute top-full mt-2 w-full sm:w-[300px] right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                 <div className="p-3 border-b border-gray-100">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input type="text" placeholder="Search employee..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-md text-sm" />
                    </div>
                 </div>
                 <div className="max-h-[200px] overflow-y-auto p-2">
                    <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                       <input type="checkbox" checked={selectedEmps.length === employees.length} onChange={handleSelectAllEmps} className="mr-3 rounded text-[#26A69A] focus:ring-[#26A69A]" />
                       <span className="font-bold text-sm">Select All</span>
                    </label>
                    {filteredEmployeesList.map(emp => (
                      <label key={emp.employee_id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                         <input type="checkbox" checked={selectedEmps.includes(emp.employee_id)} onChange={() => toggleEmp(emp.employee_id)} className="mr-3 rounded text-[#26A69A] focus:ring-[#26A69A]" />
                         <span className="text-sm font-medium mr-2">{emp.employee_id}</span>
                         <span className="text-sm text-gray-600 truncate">{emp.full_name}</span>
                      </label>
                    ))}
                 </div>
                 <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={() => setShowEmpDropdown(false)} className="px-4 py-2 bg-[#26A69A] text-white rounded-lg text-sm font-medium">Apply</button>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {REPORT_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button key={tab.id} onClick={() => setReportType(tab.id)} className={`flex items-center gap-2 px-6 py-4 font-bold transition-all border-b-[3px] whitespace-nowrap ${isActive ? 'border-[#26A69A] text-[#26A69A] bg-white rounded-t-xl' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          )
        })}
      </div>

      <div className="pb-12">
        {loading ? <div className="p-12 text-center text-gray-500">Loading charts...</div> : (
          <>
            {reportType === 'attendance' && renderAttendanceReport()}
            {reportType === 'leaves' && renderLeaveReport()}
            {reportType === 'payroll' && renderPayrollReport()}
            {reportType === 'employee' && renderEmployeeReport()}
          </>
        )}
      </div>
    </div>
  );
}

