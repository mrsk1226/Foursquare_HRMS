import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Trash2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const NotificationBell = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!profile?.employee_id) return;

    fetchNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel(`notifications-${profile.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_employee_id=eq.${profile.employee_id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
          toast.success('New notification received');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.employee_id]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_employee_id', profile.employee_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      setNotifications(data || []);
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_employee_id', profile.employee_id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    }
  };

  const markAsRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    
    setIsOpen(false);

    if (notif.type === 'leave_request' || notif.type === 'leave_approved' || notif.type === 'leave_rejected') {
      navigate('/attendance', { state: { tab: 'leaves', highlightId: notif.reference_id } });
    } else if (notif.type === 'permission_request' || notif.type === 'permission_approved' || notif.type === 'permission_rejected') {
      navigate('/attendance', { state: { tab: 'permissions', highlightId: notif.reference_id } });
    }
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_employee_id', profile.employee_id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    }
  };

  const clearAll = async () => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_employee_id', profile.employee_id);

    if (!error) {
       setNotifications([]);
       setUnreadCount(0);
       toast.success('Notifications cleared');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-blue-500 transition-colors relative p-1 rounded-full hover:bg-gray-100"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-gray-50 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-[#1a2744]">Notifications</h3>
            <div className="flex gap-2">
              <button 
                onClick={markAllAsRead} 
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
              >
                Mark all read
              </button>
              <button 
                onClick={clearAll}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Clear all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <p className={`text-xs font-bold ${!n.is_read ? 'text-[#1a2744]' : 'text-gray-700'}`}>{n.title}</p>
                    <span className="text-[10px] text-gray-400 flex items-center">
                      <Clock size={10} className="mr-1" />
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  {!n.is_read && (
                    <div className="flex justify-end mt-2">
                      <span className="text-[9px] text-blue-600 font-bold flex items-center">
                        <Check size={10} className="mr-0.5" />
                        Mark as read
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
