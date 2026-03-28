import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import classNames from 'classnames';
import { 
  Megaphone, Plus, Pin, Clock, Trash2, X, Users, Image as ImageIcon, Send, MessageSquare, Heart, Edit, 
  ThumbsUp, User, Reply, Loader2, SmilePlus, ArrowLeft
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

const REACTION_TYPES = [
  { type: 'like', emoji: '👍', label: 'Like', color: 'text-blue-500' },
  { type: 'love', emoji: '❤️', label: 'Love', color: 'text-red-500' },
  { type: 'haha', emoji: '😂', label: 'Haha', color: 'text-yellow-500' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-yellow-600' },
  { type: 'clap', emoji: '👏', label: 'Clap', color: 'text-orange-500' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate', color: 'text-purple-500' }
];

const Announcements = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hr';
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEditing, setIsEditing] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    post_type: 'Announcement',
    priority: 'Low',
    target_role: 'All',
    is_pinned: false
  });
  // UI States
  const [commentInputs, setCommentInputs] = useState({});
  const [showComments, setShowComments] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [hoveredReactionPost, setHoveredReactionPost] = useState(null);
  const [isReactionPillVisible, setIsReactionPillVisible] = useState(false);

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const fetchAnnouncements = async () => {
    try {
      console.log("fetching announcements...");
      setLoading(true);
      setError(null);
      
      // Step 1: fetch announcements
      const { data: posts, error: postsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (postsError) throw postsError;
      if (!posts || posts.length === 0) { 
        setAnnouncements([]); 
        return; 
      }
      
      // Step 2: fetch author profiles separately (safer than JOIN)
      const authorIds = [...new Set(posts.map(p => p.created_by).filter(Boolean))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', authorIds);
      
      if (profilesError) console.error('Profiles fetch error:', profilesError);
      
      const profileMap = {};
      (profiles || []).forEach(p => { 
        profileMap[p.id] = p; 
      });
      
      // Step 3: fetch reactions and comments
      const announcementIds = posts.map(a => a.id);
      const [reactionsRes, commentsRes] = await Promise.all([
        supabase.from('announcement_reactions').select('*, profiles(full_name, avatar_url, role)').in('announcement_id', announcementIds),
        supabase.from('announcement_comments').select('*, profiles(full_name, avatar_url, employee_id, role, id)').in('announcement_id', announcementIds).order('created_at', { ascending: true })
      ]);
      
      const reactions = reactionsRes.data || [];
      const comments = commentsRes.data || [];
      // Step 4: merge
      const enriched = posts.map(post => ({
        ...post,
        profiles: profileMap[post.created_by] || { full_name: 'Company Admin', role: 'System' },
        announcement_reactions: reactions.filter(r => r.announcement_id === post.id),
        announcement_comments: comments.filter(c => c.announcement_id === post.id)
      }));
      
      setAnnouncements(enriched);
    } catch (err) {
      console.error('Feed error:', err);
      setError('Failed to load feed: ' + err.message);
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    let imageUrl = null;
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('announcement-images').upload(fileName, selectedFile);
      if (!uploadError) {
        const { data } = supabase.storage.from('announcement-images').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }
    }
    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        target_role: formData.target_role,
        created_by: profile.id,
        is_pinned: formData.is_pinned,
        post_type: formData.post_type
      };
      
      if (imageUrl) payload.image_url = imageUrl;
      
      if (isEditing) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', isEditing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert([payload]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();
      toast.success(isEditing ? "Updated!" : "Published!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const resetForm = () => {
    setFormData({ title: '', content: '', post_type: 'Announcement', priority: 'Low', target_role: 'All', is_pinned: false });
    setSelectedFile(null);
    setIsEditing(null);
  };

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await supabase.from('announcements').delete().eq('id', id);
      toast.success("Deleted");
      fetchAnnouncements();
    } catch {
      toast.error("Failed");
    }
  };

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const handleReact = async (announcementId, type) => {
    if (!profile) return;
    
    // Optimistic Update
    const prevAnnouncements = [...announcements];
    const updated = announcements.map(ann => {
      if (ann.id !== announcementId) return ann;
      const reactions = [...(ann.announcement_reactions || [])];
      const existingIdx = reactions.findIndex(r => r.employee_id === profile.employee_id);
      
      if (existingIdx > -1) {
        if (reactions[existingIdx].reaction_type === type) {
          reactions.splice(existingIdx, 1);
        } else {
          reactions[existingIdx] = { ...reactions[existingIdx], reaction_type: type };
        }
      } else {
        reactions.push({
          announcement_id: announcementId,
          employee_id: profile.employee_id,
          reaction_type: type,
          profiles: { full_name: profile.full_name, avatar_url: profile.avatar_url }
        });
      }
      return { ...ann, announcement_reactions: reactions };
    });
    setAnnouncements(updated);
    try {
      const existing = prevAnnouncements.find(a => a.id === announcementId)?.announcement_reactions?.find(r => r.employee_id === profile.employee_id);
      if (existing && existing.reaction_type === type) {
        await supabase.from('announcement_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('announcement_reactions').upsert({
          announcement_id: announcementId,
          employee_id: profile.employee_id,
          employee_name: profile.full_name,
          reaction_type: type
        }, { onConflict: 'announcement_id,employee_id' });
      }
    } catch (error) {
      setAnnouncements(prevAnnouncements);
      toast.error("Reaction failed");
    }
  };

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const handlePostComment = async (announcementId, parentId = null) => {
    const content = (parentId ? replyInputs[parentId] : commentInputs[announcementId])?.trim();
    if (!content) return;
    try {
      const { data, error } = await supabase.from('announcement_comments').insert({
        announcement_id: announcementId,
        content: content,
        employee_id: profile.employee_id,
        employee_name: profile.full_name,
        parent_id: parentId
      }).select();
      if (error) throw error;
      // Notify parent author if reply
      if (parentId) {
        const parentComment = announcements.find(a => a.id === announcementId)?.announcement_comments.find(c => c.id === parentId);
        if (parentComment && parentComment.profiles?.id !== profile.id) {
          await supabase.from('notifications').insert({
            employee_id: parentComment.profiles.employee_id,
            message: `${profile.full_name} replied to your comment: "${content.substring(0, 30)}..."`,
            type: 'announcement_reply',
            href: `/announcements#post-${announcementId}`,
            created_at: new Date()
          });
        }
        setReplyInputs({ ...replyInputs, [parentId]: '' });
      } else {
        setCommentInputs({ ...commentInputs, [announcementId]: '' });
      }
      fetchAnnouncements();
      toast.success("Posted");
    } catch (error) {
      toast.error("Failed to post");
    }
  };

  // ✅ MOVED ABOVE useEffect - Hoisting fix
  const ReactionPill = ({ annId }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.8 }}
      className="absolute bottom-full mb-2 left-0 flex items-center gap-1.5 p-1.5 bg-black/85 backdrop-blur-md rounded-full border border-white/10 shadow-2xl z-50 pointer-events-auto"
      onMouseEnter={() => { setHoveredReactionPost(annId); setIsReactionPillVisible(true); }}
      onMouseLeave={() => { setHoveredReactionPost(null); setIsReactionPillVisible(false); }}
    >
      {REACTION_TYPES.map((r, idx) => (
        <motion.button
          key={r.type}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
          whileHover={{ scale: 1.4, y: -4 }}
          onClick={() => { handleReact(annId, r.type); setHoveredReactionPost(null); }}
          className="w-8 h-8 flex items-center justify-center text-xl hover:filter hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all"
          title={r.label}
        >
          {r.emoji}
        </motion.button>
      ))}
    </motion.div>
  );

  // ✅ NOW useEffect can call these functions (they're defined above)
  useEffect(() => {
    fetchAnnouncements();
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data: profileData } = await supabase.from('profiles').select('id, full_name, avatar_url, role').eq('id', payload.new.created_by).single();
          setAnnouncements(prev => [{ ...payload.new, profiles: profileData || { full_name: 'Company Admin', role: 'System' }, announcement_reactions: [], announcement_comments: [] }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setAnnouncements(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a));
        } else if (payload.eventType === 'DELETE') {
          setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reactions' }, () => fetchAnnouncements())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments' }, () => fetchAnnouncements())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <Breadcrumb items={[{ label: 'Announcements', path: null }]} />
      <button 
        onClick={() => navigate('/dashboard')} 
        className="group flex items-center text-xs font-black text-slate-400 hover:text-[#0f172a] transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </button>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Company Feed</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Updates & Announcements</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="group flex items-center px-5 py-2.5 bg-[#0f172a] text-white rounded-2xl font-bold hover:bg-blue-600 transition-all hover:scale-[1.02] shadow-xl hover:shadow-blue-500/20 active:scale-95 text-sm"
          >
            <Plus className="w-5 h-5 mr-1 group-hover:rotate-90 transition-transform" /> Publish
          </button>
        )}
      </div>
      {/* Announcements List */}
      <div className="space-y-6">
        {loading ? (
          <div className="animate-pulse space-y-6">
            {[1,2,3].map(i => <div key={i} className="bg-white h-72 rounded-[24px] shadow-sm border border-slate-100"></div>)}
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-100 rounded-[32px] p-12 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <X size={40} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-red-900">Something went wrong</h3>
            <p className="text-red-600/80 text-sm mt-1 max-w-sm mx-auto">{error}</p>
            <button 
              onClick={fetchAnnouncements}
              className="mt-8 px-8 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20 flex items-center gap-2 mx-auto"
            >
              <Clock size={18} /> Retry Loading Feed
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[32px] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Megaphone size={40} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No announcements yet</h3>
            <p className="text-slate-400 text-sm mt-1">Company-wide updates will appear here</p>
          </div>
        ) : announcements.map(ann => {
           const authorProfile = ann.profiles;
           const authorName = authorProfile?.full_name || 'Company Admin';
           const authorRole = authorProfile?.role || 'Admin';
           const authorAvatar = authorProfile?.avatar_url;
           const userReaction = ann.announcement_reactions?.find(r => r.employee_id === profile?.employee_id);
           const reactionCounts = REACTION_TYPES.map(rt => ({
             ...rt,
             count: ann.announcement_reactions?.filter(r => r.reaction_type === rt.type).length || 0
           })).filter(rt => rt.count > 0);
           return (
            <motion.div 
              key={ann.id} 
              id={`post-${ann.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] hover:-translate-y-1"
            >
              <div className="p-6">
                {/* Author Info */}
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-50 flex items-center justify-center">
                      {authorAvatar ? <img src={authorAvatar} alt="" className="w-full h-full object-cover" /> : <User className="text-slate-300" size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-[#0f172a] text-[15px]">{authorName}</span>
                         <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider rounded-md border border-blue-100">{authorRole}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">{formatDistanceToNow(parseISO(ann.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {ann.is_pinned && <div className="p-1.5 bg-orange-50 text-orange-500 rounded-full"><Pin size={14} strokeWidth={3} /></div>}
                    {isAdmin && (
                      <button onClick={() => handleDelete(ann.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
                {/* Content */}
                <div className="px-1 mb-4">
                  <h2 className="text-xl font-bold text-[#0f172a] mb-2 leading-tight">{ann.title}</h2>
                  <p className="text-slate-600 whitespace-pre-wrap text-[15px] leading-[1.66]">
                    {ann.content}
                  </p>
                </div>
                {ann.image_url && (
                  <div className="mb-5 rounded-[20px] overflow-hidden border border-slate-50 shadow-sm">
                    <img src={ann.image_url} alt="" className="w-full h-auto object-cover max-h-[500px]" />
                  </div>
                )}
                {/* Actions Bar */}
                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between relative">
                   <div 
                     className="relative flex items-center gap-1"
                     onMouseEnter={() => { setHoveredReactionPost(ann.id); setIsReactionPillVisible(true); }}
                     onMouseLeave={() => { setHoveredReactionPost(null); setIsReactionPillVisible(false); }}
                   >
                     <AnimatePresence>
                       {hoveredReactionPost === ann.id && isReactionPillVisible && <ReactionPill annId={ann.id} />}
                     </AnimatePresence>
                     <button 
                        onClick={() => handleReact(ann.id, userReaction?.reaction_type || 'like')}
                        className={classNames(
                          "flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-90",
                          userReaction 
                            ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100" 
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 shadow-sm"
                        )}
                     >
                       <span className="text-lg">{userReaction ? REACTION_TYPES.find(r => r.type === userReaction.reaction_type)?.emoji : '👍'}</span>
                       <span>{userReaction ? REACTION_TYPES.find(r => r.type === userReaction.reaction_type)?.label : 'Like'}</span>
                     </button>
                     {reactionCounts.length > 0 && (
                       <div className="flex -space-x-1 ml-2">
                         {reactionCounts.slice(0, 3).map(r => (
                           <span key={r.type} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white ring-1 ring-slate-100 text-[10px] shadow-sm">{r.emoji}</span>
                         ))}
                         <span className="ml-2 text-[12px] font-bold text-slate-400">
                           {ann.announcement_reactions.length}
                         </span>
                       </div>
                     )}
                   </div>
                   <button 
                     onClick={() => setShowComments({...showComments, [ann.id]: !showComments[ann.id]})} 
                     className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-[#0f172a] hover:bg-slate-50 rounded-full font-bold text-sm transition-all"
                   >
                     <MessageSquare size={18} className={showComments[ann.id] ? "text-blue-500" : ""} />
                     <span>Comments {ann.announcement_comments?.length > 0 ? `(${ann.announcement_comments.length})` : ''}</span>
                   </button>
                </div>
                {/* Comments Section */}
                <AnimatePresence>
                {showComments[ann.id] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 pt-4 border-t border-slate-50 space-y-6">
                      {/* Comment Input */}
                      <div className="flex gap-3 mb-6">
                        <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-lg shadow-blue-900/10 uppercase">
                          {profile?.full_name?.[0]}
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            className="w-full bg-slate-50 border border-slate-100 rounded-[18px] px-5 py-2.5 text-[14px] focus:bg-white focus:ring-2 focus:ring-blue-100/50 outline-none transition-all placeholder-slate-300" 
                            placeholder="Share your thoughts..." 
                            value={commentInputs[ann.id] || ''} 
                            onChange={e => setCommentInputs({...commentInputs, [ann.id]: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && handlePostComment(ann.id)}
                          />
                          <button onClick={() => handlePostComment(ann.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#0f172a] text-white rounded-full hover:bg-blue-600 transition-colors shadow-lg active:scale-95">
                            <Send size={14} />
                          </button>
                        </div>
                      </div>
                      {ann.announcement_comments?.filter(c => !c.parent_id).map(comment => (
                        <div key={comment.id} className="group/comment flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-50">
                            {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={18} className="text-slate-300" />}
                          </div>
                          <div className="flex-1">
                            <div className="bg-slate-50/80 p-4 rounded-[22px] rounded-tl-none border border-slate-100 relative group">
                              <div className="flex items-center gap-2 mb-1.5">
                                 <p className="text-sm font-black text-[#0f172a]">{comment.profiles?.full_name || authorName}</p>
                                 <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">{formatDistanceToNow(parseISO(comment.created_at), { addSuffix: false })}</span>
                              </div>
                              <p className="text-[14px] text-slate-600 leading-normal">{comment.content}</p>
                            </div>
                            
                            <div className="flex gap-4 mt-2 ml-3 items-center">
                               <button className="text-[11px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-tighter transition-colors">Like</button>
                               <button 
                                 onClick={() => setReplyInputs({ ...replyInputs, [comment.id]: '' })} 
                                 className="text-[11px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-tighter transition-colors"
                               >
                                 Reply
                               </button>
                            </div>
                            
                            {/* Nested Replies */}
                            <div className="mt-4 ml-4 space-y-4 pl-4 border-l-2 border-slate-100">
                               {ann.announcement_comments.filter(r => r.parent_id === comment.id).map(reply => (
                                 <div key={reply.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-400">
                                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100/50">
                                       {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={12} className="text-blue-300" />}
                                    </div>
                                    <div className="bg-blue-50/40 p-3 rounded-[18px] rounded-tl-none border border-blue-100/30 flex-1">
                                      <p className="text-[12px] font-black text-[#0f172a] mb-0.5">{reply.profiles?.full_name}</p>
                                      <p className="text-[13px] text-slate-600 font-medium leading-normal">{reply.content}</p>
                                    </div>
                                 </div>
                               ))}
                               
                               {replyInputs[comment.id] !== undefined && (
                                 <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 items-center">
                                   <input 
                                     autoFocus
                                     className="flex-1 h-9 bg-white border border-slate-200 rounded-full px-4 text-xs focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm" 
                                     placeholder={`Reply to ${comment.profiles?.full_name?.split(' ')[0]}...`} 
                                     value={replyInputs[comment.id]} 
                                     onChange={e => setReplyInputs({...replyInputs, [comment.id]: e.target.value})}
                                     onKeyDown={e => e.key === 'Enter' && handlePostComment(ann.id, comment.id)}
                                   />
                                   <button 
                                     onClick={() => handlePostComment(ann.id, comment.id)} 
                                     className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
                                   >
                                     <Send size={14} />
                                   </button>
                                   <button 
                                     onClick={() => {
                                       const newReplies = { ...replyInputs };
                                       delete newReplies[comment.id];
                                       setReplyInputs(newReplies);
                                     }} 
                                     className="text-slate-300 hover:text-slate-500"
                                   >
                                     <X size={14} />
                                   </button>
                                 </motion.div>
                               )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </motion.div>
           );
        })}
      </div>
      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[32px] w-full max-w-xl p-8 relative shadow-2xl overflow-hidden"
          >
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-[#0f172a]">New Announcement</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Publish to company feed</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
             </div>
             
             <form onSubmit={handleCreateOrUpdate} className="space-y-5">
                <input 
                  required 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all text-slate-800" 
                  placeholder="Post Title (e.g. Holiday List 2024)" 
                  value={formData.title} 
                  onChange={e=>setFormData({...formData, title: e.target.value})} 
                />
                
                <textarea 
                  required 
                  rows="5" 
                  className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all text-[15px] resize-none" 
                  placeholder="What's the update today?..." 
                  value={formData.content} 
                  onChange={e=>setFormData({...formData, content: e.target.value})} 
                />
                
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Priority</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 text-sm focus:bg-white" value={formData.priority} onChange={e=>setFormData({...formData, priority: e.target.value})}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Attachment</label>
                    <label className="w-full bg-slate-50 p-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors border-2 border-dashed border-slate-200">
                      <ImageIcon size={20} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500">{selectedFile ? selectedFile.name.substring(0, 10) + '...' : 'Add Image'}</span>
                      <input type="file" className="hidden" accept="image/*" onChange={e=>setSelectedFile(e.target.files[0])} />
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 px-1">
                   <input 
                     type="checkbox" 
                     id="is_pinned" 
                     className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                     checked={formData.is_pinned}
                     onChange={e => setFormData({...formData, is_pinned: e.target.checked})}
                   />
                   <label htmlFor="is_pinned" className="text-sm font-bold text-slate-600 cursor-pointer">Pin to top of feed</label>
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full py-4.5 bg-[#0f172a] text-white rounded-[20px] font-black shadow-xl shadow-slate-900/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'PUBLISH NOW'}
                </button>
             </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Announcements;