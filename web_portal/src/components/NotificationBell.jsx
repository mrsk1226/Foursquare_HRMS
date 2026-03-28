import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, domAnimation, LazyMotion, m, Reorder } from 'framer-motion';
import {
  Bell,
  Cake,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Heart,
  Megaphone,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';

const MotionDiv = m.div;
const MotionButton = m.button;
const ReorderGroup = Reorder.Group;
const ReorderItem = Reorder.Item;

const PANEL_MOTION = {
  initial: { opacity: 0, y: -12, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 340, damping: 28, mass: 0.8 },
  },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.18, ease: 'easeOut' } },
};

const FILTERS = [
  { id: 'all', label: 'All', icon: Bell },
  { id: 'announcement', label: 'Announcements', icon: Megaphone },
  { id: 'request', label: 'Leave and Permission', icon: CalendarDays },
  { id: 'birthday', label: 'Birthdays', icon: Cake },
  { id: 'engagement', label: 'Likes and Comments', icon: Heart },
];

const CATEGORY_STYLES = {
  announcement: {
    icon: Megaphone,
    chip: 'bg-sky-50 text-sky-700 border-sky-100',
    iconWrap: 'bg-sky-100 text-sky-700',
  },
  request: {
    icon: CalendarDays,
    chip: 'bg-violet-50 text-violet-700 border-violet-100',
    iconWrap: 'bg-violet-100 text-violet-700',
  },
  birthday: {
    icon: Cake,
    chip: 'bg-amber-50 text-amber-700 border-amber-100',
    iconWrap: 'bg-amber-100 text-amber-700',
  },
  engagement: {
    icon: MessageSquare,
    chip: 'bg-rose-50 text-rose-700 border-rose-100',
    iconWrap: 'bg-rose-100 text-rose-700',
  },
  system: {
    icon: Bell,
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    iconWrap: 'bg-slate-100 text-slate-700',
  },
};

const getReferenceParentId = (notification) =>
  notification?.reference_parent_id ||
  notification?.parent_reference_id ||
  notification?.parent_id ||
  notification?.announcement_id ||
  notification?.post_id ||
  null;

const getNotificationDestination = (notification, role) => {
  const signal = `${notification?.type || ''} ${notification?.reference_type || ''}`.toLowerCase();
  const referenceId = notification?.reference_id ? String(notification.reference_id) : null;
  const parentReferenceId = getReferenceParentId(notification)
    ? String(getReferenceParentId(notification))
    : null;
  const isLeave = signal.includes('leave');
  const isPermission = signal.includes('permission');
  const isAnnouncement = signal.includes('announcement');
  const isComment = signal.includes('comment');
  const isLike = signal.includes('like') || signal.includes('reaction');
  const isBirthday = signal.includes('birthday');

  if (role === 'manager' && (isLeave || isPermission)) {
    return {
      path: '/manager-approvals',
      state: referenceId ? { highlightId: referenceId } : undefined,
      actionLabel: 'Open Approval Queue',
    };
  }

  if (isLeave) {
    return {
      path: '/leaves',
      state: {
        tab: role === 'hr' ? 'TeamLeaves' : 'MyLeaves',
        highlightId: referenceId,
      },
      actionLabel: 'Open Leave History',
    };
  }

  if (isPermission) {
    return {
      path: '/leaves',
      state: {
        tab: role === 'hr' ? 'TeamPermissions' : 'MyPermissions',
        highlightId: referenceId,
      },
      actionLabel: 'Open Permission History',
    };
  }

  if (isComment) {
    const postId = parentReferenceId || referenceId;
    return {
      path: '/announcements',
      state: {
        highlightId: postId,
        highlightCommentId: referenceId,
        openCommentsFor: postId,
        filter: 'All',
      },
      actionLabel: 'Open Comment',
    };
  }

  if (isAnnouncement || isLike) {
    return {
      path: '/announcements',
      state: {
        highlightId: parentReferenceId || referenceId,
        filter: isAnnouncement ? 'Announcements' : 'All',
      },
      actionLabel: isLike ? 'Open Post' : 'Open Announcement',
    };
  }

  if (isBirthday) {
    return {
      path: '/dashboard',
      state: referenceId ? { highlightId: referenceId } : undefined,
      actionLabel: 'Open Celebrations',
    };
  }

  return null;
};

const getNotificationCategory = (notification) => {
  const signal = `${notification?.type || ''} ${notification?.reference_type || ''}`.toLowerCase();

  if (signal.includes('birthday')) return 'birthday';
  if (signal.includes('announcement')) return 'announcement';
  if (
    signal.includes('comment') ||
    signal.includes('like') ||
    signal.includes('reaction')
  ) {
    return 'engagement';
  }
  if (signal.includes('leave') || signal.includes('permission')) return 'request';
  return 'system';
};

const getNotificationMeta = (notification, role) => {
  const category = getNotificationCategory(notification);
  const destination = getNotificationDestination(notification, role);
  const styles = CATEGORY_STYLES[category] || CATEGORY_STYLES.system;

  return {
    category,
    destination,
    styles,
    icon: styles.icon,
    title: notification?.title || 'Notification',
    message: notification?.message || 'No details are available yet.',
    timeLabel: formatDistanceToNow(new Date(notification.created_at), { addSuffix: true }),
  };
};

const requestDesktopNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (window.Notification.permission === 'granted') return 'granted';
  return window.Notification.requestPermission();
};

const pushDesktopNotification = (notification, destination, navigate) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted' || document.visibilityState === 'visible') return;

  const desktopNotice = new window.Notification(notification.title || 'New notification', {
    body: notification.message || 'Open the HRMS portal for more details.',
    tag: `fsq-${notification.id}`,
  });

  desktopNotice.onclick = () => {
    window.focus();
    if (destination) {
      navigate(destination.path, { state: destination.state });
    }
    desktopNotice.close();
  };
};

const pushHybridLocalNotification = async (notification) => {
  if (typeof window === 'undefined') return;

  const localNotifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!localNotifications?.schedule) return;

  try {
    await localNotifications.requestPermissions?.();
    await localNotifications.schedule({
      notifications: [
        {
          id: Number(String(notification.id).replace(/\D/g, '').slice(-8)) || Date.now(),
          title: notification.title || 'New notification',
          body: notification.message || 'Open the app for more details.',
          schedule: { at: new Date(Date.now() + 250) },
        },
      ],
    });
  } catch (error) {
    console.error('Local notification scheduling failed:', error);
  }
};

function reconcileNotificationOrder(current, nextVisible, activeFilter) {
  if (activeFilter === 'all') return nextVisible;

  const visibleIds = new Set(nextVisible.map((item) => item.id));
  const hiddenItems = current.filter((item) => !visibleIds.has(item.id));

  return [...nextVisible, ...hiddenItems];
}

const NotificationRow = memo(function NotificationRow({ notification, meta, onSelect }) {
  const Icon = meta.icon;

  return (
    <ReorderItem
      value={notification}
      id={notification.id}
      whileDrag={{ scale: 1.01, boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)' }}
      className="list-none"
    >
      <MotionButton
        type="button"
        layout
        onClick={() => onSelect(notification)}
        className={`group w-full rounded-[24px] border px-4 py-4 text-left transition-all duration-200 will-change-transform hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] ${
          notification.is_read
            ? 'border-slate-100 bg-white'
            : 'border-blue-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))]'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${meta.styles.iconWrap}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${meta.styles.chip}`}>
                    {meta.category}
                  </span>
                  {!notification.is_read && <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.14)]" />}
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-slate-900">{meta.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{meta.message}</p>
              </div>
              <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Clock3 size={12} />
                {meta.timeLabel}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {meta.destination ? meta.destination.actionLabel : 'View details'}
              </span>
            </div>
          </div>
        </div>
      </MotionButton>
    </ReorderItem>
  );
});

const NotificationBell = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [hasUnreadBadge, setHasUnreadBadge] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
  );

  useEffect(() => {
    if (!profile?.employee_id) return;

    let isMounted = true;

    const fetchNotifications = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_employee_id', profile.employee_id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) {
        console.error('Error fetching notifications:', error);
        if (isMounted) setLoading(false);
        return;
      }

      if (isMounted) {
        const nextNotifications = data || [];
        setNotifications(nextNotifications);
        setHasUnreadBadge(nextNotifications.some((item) => !item.is_read));
        setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${profile.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_employee_id=eq.${profile.employee_id}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const incoming = payload.new;
          setNotifications((current) => [incoming, ...current].slice(0, 24));
          setHasUnreadBadge(true);

          const destination = getNotificationDestination(incoming, profile?.role);
          pushDesktopNotification(incoming, destination, navigate);
          await pushHybridLocalNotification(incoming);
          toast.success(incoming.title || 'New notification received');
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [navigate, profile?.employee_id, profile?.role]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notificationMetaMap = useMemo(() => {
    const entries = notifications.map((notification) => [
      notification.id,
      getNotificationMeta(notification, profile?.role),
    ]);
    return new Map(entries);
  }, [notifications, profile?.role]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((notification) => {
      const meta = notificationMetaMap.get(notification.id);
      return meta?.category === activeFilter;
    });
  }, [activeFilter, notificationMetaMap, notifications]);

  const categoryCounts = useMemo(() => {
    const counts = { all: notifications.length };
    notifications.forEach((notification) => {
      const category = getNotificationCategory(notification);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const markSingleAsRead = async (notificationId) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);

    if (!error) {
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
      );
    }
  };

  const handleOpenDestination = async (notification) => {
    const meta = getNotificationMeta(notification, profile?.role);

    if (!notification.is_read) {
      await markSingleAsRead(notification.id);
    }

    setIsPanelOpen(false);

    if (meta.destination) {
      navigate(meta.destination.path, { state: meta.destination.state });
      return;
    }

    toast('This notification does not have a linked record yet.');
  };

  const markAllAsRead = async () => {
    if (!profile?.employee_id || !notifications.length) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_employee_id', profile.employee_id)
      .eq('is_read', false);

    if (error) {
      toast.error('Unable to mark notifications as read');
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setHasUnreadBadge(false);
    toast.success('All notifications marked as read');
  };

  const enableDesktopAlerts = async () => {
    const permission = await requestDesktopNotificationPermission();
    setDesktopPermission(permission);

    if (permission === 'granted') {
      toast.success('Desktop alerts are enabled');
      return;
    }

    if (permission === 'denied') {
      toast.error('Desktop alerts are blocked in this browser');
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsPanelOpen((current) => !current)}
          className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
          aria-label="Open notifications"
        >
          <Bell size={18} />
          {hasUnreadBadge && (
            <span className="absolute right-1 top-1 block h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow-sm" />
          )}
        </button>

        <AnimatePresence>
          {isPanelOpen && (
            <MotionDiv
              {...PANEL_MOTION}
              className="glass-gpu absolute right-0 z-50 mt-3 w-[min(94vw,28rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.18)]"
            >
              <div className="glass-gpu border-b border-slate-100 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(241,245,249,0.95))] px-5 py-5 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Notification Center</h3>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Real-time updates for announcements, approvals, celebrations, and engagement.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    aria-label="Close notifications"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white">
                    <Sparkles size={13} />
                    {unreadCount} unread
                  </div>
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <CheckCheck size={14} />
                    Mark all as read
                  </button>
                  {desktopPermission === 'default' && (
                    <button
                      type="button"
                      onClick={enableDesktopAlerts}
                      className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                    >
                      <ExternalLink size={14} />
                      Enable desktop alerts
                    </button>
                  )}
                  {desktopPermission === 'granted' && (
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                      Desktop alerts on
                    </span>
                  )}
                </div>
              </div>

              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = activeFilter === filter.id;

                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setActiveFilter(filter.id)}
                        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-semibold transition-colors ${
                          isActive
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        <Icon size={13} />
                        {filter.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {categoryCounts[filter.id] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="max-h-[30rem] overflow-y-auto px-4 py-4">
                {loading ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">Loading notifications...</div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Bell size={18} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-600">No notifications in this category</p>
                    <p className="mt-1 text-xs text-slate-400">Fresh updates will appear here as soon as they arrive.</p>
                  </div>
                ) : (
                  <ReorderGroup
                    axis="y"
                    values={filteredNotifications}
                    onReorder={(nextVisible) => setNotifications((current) => reconcileNotificationOrder(current, nextVisible, activeFilter))}
                    className="space-y-3"
                  >
                    <AnimatePresence initial={false}>
                      {filteredNotifications.map((notification) => {
                        const meta = notificationMetaMap.get(notification.id);

                        return (
                          <NotificationRow
                            key={notification.id}
                            notification={notification}
                            meta={meta}
                            onSelect={handleOpenDestination}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </ReorderGroup>
                )}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
};

export default NotificationBell;
