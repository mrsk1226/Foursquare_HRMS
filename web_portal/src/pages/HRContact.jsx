import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { 
  Headset, Mail, Phone, MessageSquare, ExternalLink, 
  Send, HelpCircle, FileQuestion, BookOpen
} from 'lucide-react';

const HRContact = () => {
  const [ticketForm, setTicketForm] = useState({
    subject: '', type: 'Payroll Query', message: ''
  });
  const [isSending, setIsSending] = useState(false);

  const HR_TEAM = [
    { name: 'Sarah Jenkins', role: 'Head of HR', email: 'sarah.hr@foursquare.com', phone: '919876543210' },
    { name: 'Michael Chen', role: 'Payroll Specialist', email: 'payroll@foursquare.com', phone: '919876543211' },
    { name: 'Priya Sharma', role: 'Employee Relations', email: 'priya.hr@foursquare.com', phone: '919876543212' }
  ];

  const FAQS = [
    { q: 'How do I apply for Sick Leave?', a: 'Go to the Leave Management tab, select Sick Leave, enter your dates, and attach a medical certificate if absent for more than 2 days.' },
    { q: 'When is salary disbursed?', a: 'Salary is disbursed on the last working day of every month.' },
    { q: 'How do I download my payslip?', a: 'Navigate to Payroll -> My Payslip History, and click "View PDF" next to the respective month. You can print it from there.' },
    { q: 'Can I change my bank account details?', a: 'Please raise a ticket through this portal under "General Inquiry" with your new canceled cheque attached.' }
  ];

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    setIsSending(true);
    
    // Simulate API call to ticketing system
    setTimeout(() => {
      toast.success(`Ticket Created: #${Math.floor(Math.random() * 10000)}`);
      setTicketForm({ subject: '', type: 'Payroll Query', message: '' });
      setIsSending(false);
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">HR & Helpdesk</h1>
        <p className="text-gray-500 mt-1">Contact your HR representatives or raise a support ticket</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Contact Cards */}
        <div className="lg:col-span-1 space-y-4">
           <h2 className="font-bold text-gray-800 text-lg flex items-center mb-4"><Headset className="w-5 h-5 mr-2 text-[#2E86AB]" /> HR Contacts</h2>
           
           {HR_TEAM.map((hr, idx) => (
             <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1E3A5F] flex items-center justify-center font-bold text-lg">
                      {hr.name.charAt(0)}
                   </div>
                   <div>
                     <h3 className="font-bold text-gray-900">{hr.name}</h3>
                     <p className="text-xs text-blue-600 font-medium">{hr.role}</p>
                   </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                   <a 
                     href={`mailto:${hr.email}`} 
                     className="flex-1 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200"
                   >
                     <Mail className="w-4 h-4"/> Email
                   </a>
                   <a 
                     href={`https://wa.me/${hr.phone}`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="flex-1 flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-lg text-sm font-medium transition-colors border border-green-200"
                   >
                     <MessageSquare className="w-4 h-4"/> WhatsApp
                   </a>
                </div>
             </div>
           ))}
        </div>

        {/* Middle Column: Ticket Form */}
        <div className="lg:col-span-1">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
              <h2 className="font-bold text-gray-800 text-lg flex items-center mb-6"><HelpCircle className="w-5 h-5 mr-2 text-orange-500" /> Raise a Ticket</h2>
              
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F]"
                      value={ticketForm.type}
                      onChange={e => setTicketForm({...ticketForm, type: e.target.value})}
                    >
                      <option>Payroll Query</option>
                      <option>Leave Discrepancy</option>
                      <option>Policy Clarification</option>
                      <option>General Inquiry</option>
                      <option>Grievance</option>
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Brief title of your issue" 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F]"
                      value={ticketForm.subject}
                      onChange={e => setTicketForm({...ticketForm, subject: e.target.value})}
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message Detail</label>
                    <textarea 
                      required 
                      rows="6" 
                      placeholder="Please describe your issue in detail..." 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F]"
                      value={ticketForm.message}
                      onChange={e => setTicketForm({...ticketForm, message: e.target.value})}
                    ></textarea>
                 </div>

                 <button 
                   disabled={isSending}
                   type="submit" 
                   className="w-full bg-[#1E3A5F] text-white py-3 rounded-lg font-medium hover:bg-[#2A4D7C] transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
                 >
                   {isSending ? 'Creating Ticket...' : <><Send className="w-4 h-4" /> Submit Ticket</>}
                 </button>
              </form>
           </div>
        </div>

        {/* Right Column: FAQs */}
        <div className="lg:col-span-1">
           <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2E86AB] rounded-xl shadow-md p-6 text-white h-full relative overflow-hidden">
              <BookOpen className="absolute -right-8 -bottom-8 w-40 h-40 text-blue-400/20" />
              
              <h2 className="font-bold text-lg flex items-center mb-6 relative z-10"><FileQuestion className="w-5 h-5 mr-2 text-blue-200" /> Frequently Asked Questions</h2>
              
              <div className="space-y-6 relative z-10">
                 {FAQS.map((faq, i) => (
                    <div key={i} className="border-b border-blue-400/30 pb-4 last:border-0">
                       <h3 className="font-semibold text-blue-100 text-sm mb-1">{faq.q}</h3>
                       <p className="text-blue-50/80 text-xs leading-relaxed">{faq.a}</p>
                    </div>
                 ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-blue-400/30 relative z-10">
                 <p className="text-sm font-medium mb-2">Need Policies?</p>
                 <button onClick={() => toast.success('Simulating handbook download')} className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors flex justify-center items-center">
                   <ExternalLink className="w-4 h-4 mr-2"/> Employee Handbook
                 </button>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default HRContact;

