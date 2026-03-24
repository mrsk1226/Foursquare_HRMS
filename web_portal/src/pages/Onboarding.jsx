import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  CheckSquare, FileSpreadsheet, Plus, CheckCircle2, 
  Clock, ShieldCheck, Mail, Users
} from 'lucide-react';

const Onboarding = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Specific Admin View State (Grouping the tasks by Employee)
  const [employeeGroups, setEmployeeGroups] = useState({});

  useEffect(() => {
    fetchTasks();
  }, [profile]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // Admin gets all onboarding tasks with employee relational data
        const { data, error } = await supabase
          .from('onboarding')
          .select('*, employees(full_name, department, email)')
          .order('employee_id');
          
        if (error) throw error;
        
        // Group tasks by Employee
        const grouped = data?.reduce((acc, curr) => {
          if (!acc[curr.employee_id]) {
            acc[curr.employee_id] = {
              name: curr.employees?.full_name || 'Legacy Root',
              email: curr.employees?.email || 'N/A',
              department: curr.employees?.department || 'N/A',
              tasks: []
            };
          }
          acc[curr.employee_id].tasks.push(curr);
          return acc;
        }, {});
        
        setEmployeeGroups(grouped || {});
        setTasks(data || []);
      } else {
        // Employee gets their own
        const { data, error } = await supabase
          .from('onboarding')
          .select('*')
          .eq('employee_id', profile.employee_id);
          
        if (error) throw error;
        setTasks(data || []);
      }
    } catch (err) {
      toast.error('Error fetching onboarding data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('onboarding')
        .update({ is_completed: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const handleToggleVerified = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('onboarding')
        .update({ verified_by_admin: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      toast.success(currentStatus ? 'Verification revoked' : 'Task verified');
      fetchTasks();
    } catch (err) {
      toast.error('Failed to verify task');
    }
  };

  const seedNewEmployeeTasks = async () => {
     // A mock button method for admins to assign standard tasks to a newly joined employee
     const empId = prompt("Enter the precise Employee ID to assign standard onboarding tasks:");
     if (!empId) return;

     const stdTasks = [
       { task_name: 'Complete Profile Details', is_completed: false, verified_by_admin: false, employee_id: empId },
       { task_name: 'Upload Aadhaar & PAN', is_completed: false, verified_by_admin: false, employee_id: empId },
       { task_name: 'Sign Employment Contract', is_completed: false, verified_by_admin: false, employee_id: empId },
       { task_name: 'Provide Bank Account Details', is_completed: false, verified_by_admin: false, employee_id: empId },
       { task_name: 'IT Induction & Email Setup', is_completed: false, verified_by_admin: false, employee_id: empId }
     ];

     try {
       const { error } = await supabase.from('onboarding').insert(stdTasks);
       if(error) throw error;
       toast.success(`Assigned ${stdTasks.length} tasks to ${empId}`);
       fetchTasks();
     } catch (e) {
       toast.error(e.message || "Failed to assign tasks");
     }
  };

  // Rendering Employee View
  if (!isAdmin) {
    const completedTasks = tasks.filter(t => t.is_completed).length;
    const totalTasks = tasks.length || 1;
    const progress = Math.round((completedTasks / totalTasks) * 100) || 0;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">My Onboarding Checklist</h1>
          <p className="text-gray-500 mt-1">Complete these tasks to finish your onboarding process.</p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
           <div className="flex justify-between items-center mb-2">
             <h3 className="font-bold text-gray-800">Overall Progress</h3>
             <span className="text-lg font-bold text-[#2E86AB]">{progress}%</span>
           </div>
           <div className="w-full bg-gray-100 rounded-full h-3">
             <div className="bg-[#1E3A5F] h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
           </div>
           {progress === 100 && (
             <p className="text-green-600 text-sm font-medium mt-3 flex items-center bg-green-50 w-max px-3 py-1 rounded-md">
               <CheckCircle2 className="w-4 h-4 mr-2"/> You've completed all tasks! Pending final HR verification.
             </p>
           )}
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center">
              <CheckSquare className="w-5 h-5 mr-2 text-[#1E3A5F]" />
              <h3 className="font-bold text-gray-800">Assigned Tasks</h3>
           </div>
           <div className="divide-y divide-gray-100">
             {loading ? (
                <div className="p-8 text-center text-gray-400">Loading your tasks...</div>
             ) : tasks.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No induction tasks assigned yet.</p>
                </div>
             ) : (
                tasks.map(task => (
                  <div key={task.id} className="p-5 flex items-start justify-between hover:bg-gray-50 transition-colors">
                     <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          id={`task-${task.id}`}
                          checked={task.is_completed}
                          disabled={task.verified_by_admin} // Can't undo if HR verified it
                          onChange={() => handleToggleComplete(task.id, task.is_completed)}
                          className="mt-1 w-5 h-5 text-[#1E3A5F] border-gray-300 rounded focus:ring-[#1E3A5F] cursor-pointer disabled:opacity-50"
                        />
                        <div>
                          <label htmlFor={`task-${task.id}`} className={`font-semibold cursor-pointer select-none ${task.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.task_name}</label>
                          <div className="flex gap-4 mt-2">
                            {task.is_completed ? (
                              <span className="text-xs font-medium text-green-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</span>
                            ) : (
                              <span className="text-xs font-medium text-orange-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> Pending</span>
                            )}
                            {task.verified_by_admin && (
                              <span className="text-xs font-medium text-blue-600 flex items-center"><ShieldCheck className="w-3 h-3 mr-1"/> Verified by HR</span>
                            )}
                          </div>
                        </div>
                     </div>
                  </div>
                ))
             )}
           </div>
        </div>
      </div>
    );
  }

  // == Admin View ==
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Onboarding Workflows</h1>
          <p className="text-gray-500 mt-1">Track employee induction progress and verify documents.</p>
        </div>
        <button 
          onClick={seedNewEmployeeTasks} 
          className="flex items-center px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2A4D7C] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Assign Standard Tasks
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? (
             <div className="w-full col-span-full p-12 text-center text-gray-400">Loading inductions...</div>
         ) : Object.keys(employeeGroups).length === 0 ? (
             <div className="w-full col-span-full bg-white p-12 text-center rounded-xl border border-gray-100 shadow-sm text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No onboarding records exist.</p>
             </div>
         ) : (
           Object.entries(employeeGroups).map(([empId, empData]) => {
             const allTasks = empData.tasks.length;
             const doneTasks = empData.tasks.filter(t => t.is_completed).length;
             const verifiedTasks = empData.tasks.filter(t => t.verified_by_admin).length;
             const completionProgress = Math.round((doneTasks / allTasks) * 100);

             return (
              <div key={empId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                 <div className="p-5 border-b border-gray-100 bg-[#1E3A5F] text-white relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-bl-full"></div>
                    <h3 className="font-bold text-lg mb-1">{empData.name}</h3>
                    <p className="text-blue-200 text-xs font-medium">{empId} • {empData.department}</p>
                 </div>
                 
                 <div className="p-5 flex-1 bg-gray-50/50">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Completion</span>
                       <span className="text-sm font-bold text-[#1E3A5F]">{completionProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                      <div className={`h-2 rounded-full transition-all ${completionProgress === 100 ? 'bg-green-500' : 'bg-[#2E86AB]'}`} style={{ width: `${completionProgress}%` }}></div>
                    </div>

                    <div className="space-y-3">
                       {empData.tasks.map(task => (
                         <div key={task.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                               <p className={`text-sm font-semibold ${task.is_completed ? 'text-gray-900' : 'text-gray-500'}`}>{task.task_name}</p>
                               {task.is_completed ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> : <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-1">
                               <span className="text-xs text-gray-400 font-medium">Status</span>
                               <button 
                                 onClick={() => handleToggleVerified(task.id, task.verified_by_admin)}
                                 disabled={!task.is_completed}
                                 className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                   task.verified_by_admin 
                                     ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                                     : task.is_completed 
                                        ? 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700 border border-gray-200' 
                                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                 }`}
                               >
                                  {task.verified_by_admin ? 'HR Verified' : 'Verify'}
                               </button>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
                 
                 <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center text-xs font-medium text-gray-500">
                    <span>{verifiedTasks} / {allTasks} Verified</span>
                    <a href={`mailto:${empData.email}`} className="text-[#2E86AB] hover:underline flex items-center">
                      <Mail className="w-3 h-3 mr-1" /> Contact
                    </a>
                 </div>
              </div>
             )
           })
         )}
      </div>
    </div>
  );
};

export default Onboarding;

