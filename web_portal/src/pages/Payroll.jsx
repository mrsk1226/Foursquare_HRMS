import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Receipt, Download, FileText, CheckCircle2, Calculator, 
  Calendar as CalendarIcon, Printer, X
} from 'lucide-react';

const Payroll = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isHR = profile?.role === 'hr';
  const canViewAll = isAdmin || isHR;
  
  const [employees, setEmployees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isProcessing, setIsProcessing] = useState(false);

  const [viewingPayslip, setViewingPayslip] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (canViewAll) {
        const [empRes, payRes] = await Promise.all([
          supabase.from('employees').select('*').eq('status', 'active'),
          supabase.from('payroll')
            .select('*, employees(full_name, designation, department)')
            .eq('month', selectedMonth)
            .eq('year', selectedYear)
        ]);
        if (empRes.error) throw empRes.error;
        if (payRes.error) throw payRes.error;
        setEmployees(empRes.data || []);
        setPayrolls(payRes.data || []);
      } else {
        const { data, error } = await supabase.from('payroll')
          .select('*, employees(full_name, designation, department)')
          .eq('employee_id', profile?.employee_id)
          .order('year', { ascending: false })
          .order('month', { ascending: false });
        if (error) throw error;
        setPayrolls(data || []);
      }
    } catch (err) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSalaryComponents = (basicSalary = 0) => {
    const basic = Number(basicSalary) || 25000; // Fallback if no basic is set
    const hra = basic * 0.40;
    const da = basic * 0.10;
    const specialAllowance = basic * 0.15;
    const grossEarnings = basic + hra + da + specialAllowance;

    const pf = basic * 0.12; // 12% of basic
    const esi = grossEarnings <= 21000 ? grossEarnings * 0.0075 : 0;
    const professionalTax = 200;
    const tds = grossEarnings > 50000 ? grossEarnings * 0.10 : 0;
    const totalDeductions = pf + esi + professionalTax + tds;

    const netSalary = grossEarnings - totalDeductions;

    return { 
      basic, hra, da, specialAllowance, grossEarnings,
      pf, esi, professionalTax, tds, totalDeductions,
      netSalary
    };
  };

  const handleBulkProcess = async () => {
    if (employees.length === 0) return toast.error("No active employees to process");
    
    // Check if already processed
    if (payrolls.length > 0) {
      if(!window.confirm(`Payroll for ${selectedMonth}/${selectedYear} has already been run. Do you want to overwrite it?`)) {
        return;
      }
    }

    setIsProcessing(true);
    try {
      // Clear existing records for this month/year for idempotency
      if (payrolls.length > 0) {
        const ids = payrolls.map(p => p.id);
        await supabase.from('payroll').delete().in('id', ids);
      }

      const payrollInserts = employees.map(emp => {
        const comps = calculateSalaryComponents(emp.salary_basic);
        return {
          employee_id: emp.employee_id,
          month: selectedMonth,
          year: selectedYear,
          basic: comps.grossEarnings, // Storing gross as basic in db schema due to schema constraints
          hra: comps.pf,              // Mapping PF to schema HRA slot temporarily
          deductions: comps.totalDeductions,
          net_salary: comps.netSalary,
          payslip_url: null
        };
      });

      const { error } = await supabase.from('payroll').insert(payrollInserts);
      if (error) throw error;
      
      toast.success(`Processed payroll for ${employees.length} employees successfully!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error executing payroll run');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentMonthTotal = payrolls.reduce((sum, p) => sum + Number(p.net_salary), 0);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const printPayslip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payslip-modal, #payslip-modal * { visibility: visible; }
          #payslip-modal { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: white !important; margin: 0; padding: 20px; box-shadow: none; border-radius: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Payroll Directory</h1>
          <p className="text-gray-500 mt-1">Manage and view salary slips</p>
        </div>

        {canViewAll && (
          <div className="flex gap-3">
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent border-none text-sm outline-none font-medium cursor-pointer"
              >
                {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent border-none text-sm outline-none font-medium text-gray-500 cursor-pointer pl-1 border-l border-gray-200"
              >
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {isAdmin && (
              <button 
                onClick={handleBulkProcess}
                disabled={isProcessing}
                className="flex items-center px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2A4D7C] transition-colors shadow-sm disabled:opacity-70"
              >
                {isProcessing ? 'Processing Run...' : <><Calculator className="w-4 h-4 mr-2" /> Run Payroll</>}
              </button>
            )}
          </div>
        )}
      </div>

      {canViewAll && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Payout for {months[selectedMonth-1]}</p>
              <h3 className="text-3xl font-bold text-[#1E3A5F]">₹ {currentMonthTotal.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-full">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Employees Processed</p>
              <h3 className="text-3xl font-bold text-gray-800">{payrolls.length} / {employees.length}</h3>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 flex items-center justify-center rounded-full">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-[#1E3A5F]" /> 
            {canViewAll ? `Salary Details for ${months[selectedMonth-1]} ${selectedYear}` : 'My Payslip History'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
             <thead>
                <tr className="border-b border-gray-100 text-gray-500 font-medium bg-white">
                  {!canViewAll && <th className="p-4 font-medium uppercase tracking-wider text-xs">Period</th>}
                  {canViewAll && <th className="p-4 font-medium uppercase tracking-wider text-xs">Employee</th>}
                  <th className="p-4 font-medium uppercase tracking-wider text-xs">Gross Earnings</th>
                  <th className="p-4 font-medium uppercase tracking-wider text-xs">Deductions</th>
                  <th className="p-4 font-medium uppercase tracking-wider text-xs">Net Salary</th>
                  <th className="p-4 font-medium uppercase tracking-wider text-xs text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-400">Loading payroll data...</td></tr>
                ) : payrolls.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-400">
                    {isAdmin ? "No payrolls generated for this period." : "No payslips available."}
                  </td></tr>
                ) : (
                  payrolls.map(pay => (
                    <tr key={pay.id} className="hover:bg-blue-50/20">
                      {!canViewAll && (
                        <td className="p-4 font-bold text-[#1E3A5F]">{months[pay.month-1]} {pay.year}</td>
                      )}
                      {canViewAll && (
                        <td className="p-4">
                          <div className="font-semibold text-gray-900">{pay.employees?.full_name || 'System Root'}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{pay.employee_id} • {pay.employees?.department || 'N/A'}</div>
                        </td>
                      )}
                      <td className="p-4 text-gray-700 font-medium tracking-wide">₹ {Number(pay.basic).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-red-500 font-medium tracking-wide">-₹ {Number(pay.deductions).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-green-600 font-bold tracking-wide">₹ {Number(pay.net_salary).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-right">
                         <button 
                           onClick={() => setViewingPayslip(pay)} 
                           className="px-4 py-1.5 bg-gray-100 text-gray-700 hover:bg-[#1E3A5F] hover:text-white rounded-md font-medium transition-colors text-xs border border-gray-200 inline-flex items-center gap-2"
                         >
                           <FileText className="w-3 h-3"/> View PDF
                         </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>
      </div>

      {/* PDF Payslip Modal */}
      {viewingPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm -m-8 no-print p-4">
           <div 
             id="payslip-modal" 
             className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto relative animate-in zoom-in-95 duration-200 print:shadow-none print:w-full"
           >
              {/* Actions Header (No Print) */}
              <div className="sticky top-0 right-0 p-4 flex justify-end gap-3 bg-white/90 backdrop-blur-md border-b border-gray-100 no-print">
                <button onClick={printPayslip} className="flex items-center px-4 py-2 bg-[#1E3A5F] text-white rounded-md text-sm font-medium shadow-sm hover:bg-[#2A4D7C] transition-colors"><Printer className="w-4 h-4 mr-2"/> Print to PDF</button>
                <button onClick={() => setViewingPayslip(null)} className="flex items-center px-3 py-2 bg-gray-100 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"><X className="w-4 h-4"/></button>
              </div>

              {/* Printable Body */}
              <div className="p-10 space-y-8 text-gray-800">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6">
                  <div>
                    <h1 className="text-2xl font-black text-[#1E3A5F] tracking-tight uppercase">FOURSQUARE</h1>
                    <p className="text-sm text-gray-500 font-medium mt-1">HRMS SYSTEM</p>
                    <p className="text-xs text-gray-400 mt-2">123 Corporate Blvd,<br/>Coimbatore, TN 641001</p>
                  </div>
                  <div className="text-right">
                     <h2 className="text-xl font-bold text-gray-800 uppercase tracking-widest text-[#2E86AB]">Payslip</h2>
                     <p className="text-sm font-semibold mt-1">For {months[viewingPayslip.month-1]} {viewingPayslip.year}</p>
                  </div>
                </div>

                {/* Employee Details Wrapper */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm bg-gray-50 p-6 rounded-lg border border-gray-200">
                   <div><span className="text-gray-500 w-32 inline-block">Employee Name:</span> <span className="font-bold">{viewingPayslip.employees?.full_name || 'System User'}</span></div>
                   <div><span className="text-gray-500 w-32 inline-block">Employee ID:</span> <span className="font-bold">{viewingPayslip.employee_id}</span></div>
                   <div><span className="text-gray-500 w-32 inline-block">Designation:</span> <span className="font-bold">{viewingPayslip.employees?.designation || 'Staff'}</span></div>
                   <div><span className="text-gray-500 w-32 inline-block">Department:</span> <span className="font-bold">{viewingPayslip.employees?.department || 'Operations'}</span></div>
                   <div><span className="text-gray-500 w-32 inline-block">UAN Number:</span> <span className="font-semibold">XXXXXXXXXX</span></div>
                   <div><span className="text-gray-500 w-32 inline-block">Bank A/C:</span> <span className="font-semibold">XXXXXXXXXXXX1234</span></div>
                </div>

                {/* Finance Breakdown */}
                {(() => {
                  const comps = calculateSalaryComponents(viewingPayslip.basic); // Demux Gross back into details
                  
                  return (
                    <div className="flex gap-8">
                       <div className="flex-1">
                          <h4 className="font-bold bg-[#1E3A5F] text-white px-3 py-1.5 uppercase text-xs tracking-wider">Earnings</h4>
                          <div className="mt-2 space-y-2 text-sm border-x border-b border-gray-200 p-3 pt-4">
                            <div className="flex justify-between"><span>Basic Salary</span> <span className="font-mono">₹ {comps.basic.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span>House Rent Allowance (HRA)</span> <span className="font-mono">₹ {comps.hra.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span>Dearness Allowance (DA)</span> <span className="font-mono">₹ {comps.da.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span>Special Allowance</span> <span className="font-mono">₹ {comps.specialAllowance.toLocaleString('en-IN')}</span></div>
                            <div className="pt-3 mt-3 border-t border-gray-200 flex justify-between font-bold text-gray-900">
                              <span>Total Earnings</span> <span className="font-mono">₹ {comps.grossEarnings.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                       </div>
                       
                       <div className="flex-1">
                          <h4 className="font-bold bg-gray-600 text-white px-3 py-1.5 uppercase text-xs tracking-wider">Deductions</h4>
                          <div className="mt-2 space-y-2 text-sm border-x border-b border-gray-200 p-3 pt-4">
                            <div className="flex justify-between"><span>Provident Fund (PF)</span> <span className="font-mono">₹ {comps.pf.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span>ESI</span> <span className="font-mono">₹ {comps.esi.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span>Professional Tax (PT)</span> <span className="font-mono">₹ {comps.professionalTax.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span>TDS</span> <span className="font-mono">₹ {comps.tds.toLocaleString('en-IN')}</span></div>
                            <div className="pt-3 mt-3 border-t border-gray-200 flex justify-between font-bold text-gray-900">
                              <span>Total Deductions</span> <span className="font-mono text-red-600">₹ {comps.totalDeductions.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                       </div>
                    </div>
                  );
                })()}

                {/* Net Pay */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex justify-between items-center text-green-900 mt-8">
                   <div>
                      <p className="text-sm font-semibold uppercase tracking-wider mb-1 text-green-700">Net Salary Payable</p>
                      <p className="text-xs font-medium italic opacity-70">Amount transferred to bank account</p>
                   </div>
                   <div className="text-3xl font-black font-mono">
                      ₹ {Number(viewingPayslip.net_salary).toLocaleString('en-IN')}
                   </div>
                </div>

                <div className="text-center pt-16 pb-4 opacity-50 text-xs italic">
                  This is a computer generated document. No signature is required.
                </div>

              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Payroll;

