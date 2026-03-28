import React from 'react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock3, GripHorizontal, X, XCircle } from 'lucide-react';

const MotionDiv = motion.div;

const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

const cardMotion = {
  initial: { opacity: 0, scale: 0.8, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: 18 },
  transition: { type: 'spring', duration: 0.5, bounce: 0.18 },
};

const getGradient = (status) => {
  const value = String(status || '').toLowerCase();
  if (value.includes('approved')) return 'from-emerald-500 via-emerald-400 to-teal-300';
  if (value.includes('rejected')) return 'from-red-500 via-rose-400 to-orange-300';
  return 'from-amber-400 via-yellow-300 to-emerald-300';
};

const getTimelineSteps = (request, department) => {
  const isSales = String(department || '').toLowerCase().includes('sales');
  const status = String(request?.status || '').toLowerCase();
  const hrStatus = String(request?.hr_status || '').toLowerCase();
  const managerApproved = Boolean(request?.level_1_approved_at) || hrStatus === 'approved' || status === 'approved';
  const rejected = status === 'rejected' || hrStatus === 'rejected';

  const submitted = {
    key: 'submitted',
    title: 'Submitted',
    state: 'approved',
    detail: request?.created_at ? `Submitted on ${format(new Date(request.created_at), 'dd MMM yyyy, hh:mm a')}` : 'Submitted',
  };

  if (isSales) {
    return [
      submitted,
      {
        key: 'manager',
        title: 'Manager Approval',
        state: managerApproved ? 'approved' : rejected ? 'rejected' : 'pending',
        detail: managerApproved
          ? `Approved${request?.level_1_approved_at ? ` on ${format(new Date(request.level_1_approved_at), 'dd MMM yyyy, hh:mm a')}` : ''}`
          : rejected && !hrStatus
            ? 'Stopped during manager review'
            : 'Waiting for manager action',
      },
      {
        key: 'hr',
        title: 'HR Final Approval',
        state: status === 'approved' || hrStatus === 'approved' ? 'approved' : rejected && hrStatus === 'rejected' ? 'rejected' : managerApproved ? 'pending' : 'locked',
        detail: status === 'approved' || hrStatus === 'approved'
          ? `Approved${(request?.approved_at || request?.hr_approved_at) ? ` on ${format(new Date(request.approved_at || request.hr_approved_at), 'dd MMM yyyy, hh:mm a')}` : ''}`
          : rejected && hrStatus === 'rejected'
            ? 'Rejected by HR'
            : managerApproved
              ? 'Waiting for HR final approval'
              : 'Available after manager approval',
      },
    ];
  }

  return [
    submitted,
    {
      key: 'final',
      title: 'Final Approval',
      state: status === 'approved' || hrStatus === 'approved' ? 'approved' : rejected ? 'rejected' : 'pending',
      detail: status === 'approved' || hrStatus === 'approved'
        ? `Approved${(request?.approved_at || request?.hr_approved_at) ? ` on ${format(new Date(request.approved_at || request.hr_approved_at), 'dd MMM yyyy, hh:mm a')}` : ''}`
        : rejected
          ? 'Request was rejected'
          : 'Waiting for final decision',
    },
  ];
};

const StatusNode = ({ state }) => {
  if (state === 'approved') {
    return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200"><CheckCircle2 size={20} /></div>;
  }
  if (state === 'rejected') {
    return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-200"><XCircle size={20} /></div>;
  }
  if (state === 'locked') {
    return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Clock3 size={18} /></div>;
  }
  return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg shadow-amber-200"><Clock3 size={18} /></div>;
};

export default function RequestStatusModal({ open, request, kind = 'leave', fallbackName, fallbackDepartment, onClose }) {
  if (!open || !request) return null;

  const department = request?.employees?.department || fallbackDepartment || '';
  const steps = getTimelineSteps(request, department);
  const gradient = getGradient(request?.status);
  const approvedAt = request?.approved_at || request?.hr_approved_at || request?.level_1_approved_at || null;
  const dateValue = kind === 'permission'
    ? request?.date
      ? format(parseISO(request.date), 'dd MMM yyyy')
      : '-'
    : request?.start_date && request?.end_date
      ? `${format(parseISO(request.start_date), 'dd MMM yyyy')} - ${format(parseISO(request.end_date), 'dd MMM yyyy')}`
      : '-';

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 140 || info.velocity.y > 800) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <MotionDiv
        {...backdropMotion}
        className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 p-0 md:items-center md:p-4"
        style={{ backdropFilter: 'blur(15px)' }}
        onClick={onClose}
      >
        <MotionDiv
          {...cardMotion}
          drag="y"
          dragDirectionLock
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.22 }}
          onDragEnd={handleDragEnd}
          onClick={(event) => event.stopPropagation()}
          className="transform-gpu will-change-transform w-full max-w-2xl rounded-t-[30px] border border-white/35 bg-white/80 shadow-[0_28px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl md:rounded-[32px]"
        >
          <div className={`rounded-t-[30px] bg-gradient-to-r ${gradient} px-6 py-5 text-slate-950 md:rounded-t-[32px]`}>
            <div className="mx-auto mb-3 flex w-fit items-center justify-center rounded-full bg-white/40 px-3 py-1 text-slate-700 md:hidden">
              <GripHorizontal size={18} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-700/70">{kind === 'permission' ? 'Permission Details' : 'Leave Details'}</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{request?.employees?.full_name || fallbackName || request?.employee_id || 'Request'}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-800/75">{department || 'Department not available'}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/40 bg-white/35 p-2 text-slate-800 transition-colors hover:bg-white/55"
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard title="Type" value={kind === 'permission' ? 'Permission' : request?.leave_type || 'Leave'} />
              <InfoCard title="Schedule" value={dateValue} icon={<CalendarDays size={16} />} />
              <InfoCard title="Approved Date & Time" value={approvedAt ? format(new Date(approvedAt), 'dd MMM yyyy, hh:mm a') : 'Not approved yet'} />
            </div>

            <InfoCard title="Reason" value={request?.reason || 'No reason provided.'} large />

            <div className="rounded-[28px] border border-white/50 bg-white/55 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Status Tracker</p>
              <div className="relative mt-5 space-y-5 pl-1">
                <div className="absolute left-5 top-3 h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-amber-300 via-yellow-300 to-emerald-300" />
                {steps.map((step) => (
                  <div key={step.key} className="relative flex gap-4">
                    <div className="relative z-10">
                      <StatusNode state={step.state} />
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/55 bg-white/75 px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{step.title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          step.state === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : step.state === 'rejected'
                              ? 'bg-red-100 text-red-600'
                              : step.state === 'locked'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-amber-100 text-amber-700'
                        }`}>
                          {step.state}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </MotionDiv>
      </MotionDiv>
    </AnimatePresence>
  );
}

function InfoCard({ title, value, icon, large = false }) {
  return (
    <div className={`rounded-[24px] border border-white/50 bg-white/60 p-5 shadow-sm ${large ? 'md:col-span-3' : ''}`}>
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[11px] font-black uppercase tracking-[0.22em]">{title}</p>
      </div>
      <p className={`mt-3 text-slate-900 ${large ? 'text-sm leading-7' : 'text-sm font-bold'}`}>{value}</p>
    </div>
  );
}
