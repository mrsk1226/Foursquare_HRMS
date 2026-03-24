import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  CreditCard, 
  LayoutDashboard, 
  Bell, 
  Search, 
  UserPlus,
  TrendingUp
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const stats = [
    { title: 'Total Employees', value: '145', icon: <Users size={20}/>, color: 'text-blue-400' },
    { title: 'Present Today', value: '128', icon: <Clock size={20}/>, color: 'text-green-400' },
    { title: 'On Leave', value: '12', icon: <Calendar size={20}/>, color: 'text-orange-400' },
    { title: 'Pending Payroll', value: '₹4.5L', icon: <CreditCard size={20}/>, color: 'text-purple-400' },
  ];

  return (
    <div className="flex h-screen bg-[#0d1117] text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#161b22] border-r border-gray-800 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-blue-500 flex items-center gap-2">
            <LayoutDashboard /> Foursquare HR
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {['Dashboard', 'Employees', 'Attendance', 'Payroll', 'Leaves'].map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                activeTab === item ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'
              }`}
            >
              {item === 'Dashboard' && <LayoutDashboard size={18} />}
              {item === 'Employees' && <Users size={18} />}
              {item === 'Attendance' && <Clock size={18} />}
              {item === 'Payroll' && <CreditCard size={18} />}
              {item === 'Leaves' && <Calendar size={18} />}
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Header */}
        <header className="h-16 bg-[#161b22] border-b border-gray-800 flex items-center justify-between px-8">
          <div className="relative w-96">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search employee or ID..." 
              className="w-full bg-[#0d1117] border border-gray-700 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-800 rounded-full text-gray-400 relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-gray-700 pl-4">
              <div className="text-right">
                <p className="text-sm font-medium">Santhosh Kumar</p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">S</div>
            </div>
          </div>
        </header>

        {/* Dashboard View */}
        <main className="p-8 space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Welcome back, Santhosh!</h2>
              <p className="text-gray-400 text-sm">Here is what's happening with your company today.</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <UserPlus size={18} /> Add New Employee
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="bg-[#161b22] p-6 rounded-xl border border-gray-800 hover:border-gray-600 transition cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg bg-opacity-10 ${stat.color.replace('text', 'bg')}`}>
                    {stat.icon}
                  </div>
                  <TrendingUp size={16} className="text-green-500" />
                </div>
                <p className="text-gray-400 text-sm">{stat.title}</p>
                <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
              </div>
            ))}
          </div>

          {/* Table Placeholder */}
          <div className="bg-[#161b22] rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-bold mb-4">Recent Attendance Logs</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-sm">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">In-Time</th>
                    <th className="pb-3">Out-Time</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {[1, 2, 3].map((row) => (
                    <tr key={row} className="text-sm">
                      <td className="py-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                        <span>Employee {row}</span>
                      </td>
                      <td className="py-4 text-gray-400">09:00 AM</td>
                      <td className="py-4 text-gray-400">06:00 PM</td>
                      <td className="py-4 text-green-500 font-medium">Present</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
