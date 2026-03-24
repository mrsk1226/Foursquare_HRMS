import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, isPast, parseISO } from 'date-fns';
import { 
  Megaphone, Plus, Pin, Clock, Trash2, X, Users, Image as ImageIcon, Send, MessageSquare, Heart, Edit 
} from 'lucide-react';
import classNames from 'classnames';

const REACTION_TYPES = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'clap', emoji: '👏', label: 'Clap' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' }
];

const Announcements = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hr';
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEditing, setIsEditing] = useState(null); // stores ID if editing
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    post_type: 'Announcement',
    priority: 'Low',
    target_dept: 'All',
    expires_at: '',
    is_pinned: false
  });

  // Comment state
  const [commentInputs, setCommentInputs] = useState({});
  const [showComments, setShowComments] = useState({});
  
  // UI states
  const [animatingReaction, setAnimatingReaction] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, [profile]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error:', error);
        setAnnouncements([]);
      } else {
        const announcementIds = data.map(a => a.id);
        let reactions = [];
        let comments = [];
        
        if (announcementIds.length > 0) {
          const [reactionsRes, commentsRes] = await Promise.all([
            supabase.from('announcement_reactions').select('*').in('announcement_id', announcementIds),
            supabase.from('announcement_comments').select('*').in('announcement_id', announcementIds).order('created_at', { ascending: true })
          ]);
          reactions = reactionsRes.data || [];
          comments = commentsRes.data || [];
        }

        const valid = data.map(ann => ({
          ...ann,
          announcement_reactions: reactions.filter(r => r.announcement_id === ann.id),
          announcement_comments: comments.filter(c => c.announcement_id === ann.id)
        }));
        
        setAnnouncements(valid);
      }
    } catch (err) {
      console.error('Catch error:', err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error } = await supabase.storage.from('announcement-images').upload(fileName, file);
    if (error) {
      console.warn('Failed to upload image. Storage bucket might not exist.', error);
      return null;
    }
    const { data } = supabase.storage.from('announcement-images').getPublicUrl(fileName);
    return data.publicUrl;
  };
  
  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    let imageUrl = null;

    if (selectedFile) {
      imageUrl = await uploadImage(selectedFile);
    }

    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        target_role: formData.target_dept,
        created_by: profile.id,
        is_pinned: formData.is_pinned,
      };
      
      if (imageUrl) payload.image_url = imageUrl;
      
      if (isEditing) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', isEditing);
        if (error) throw error;
        toast.success('Post updated!');
      } else {
        const { error } = await supabase.from('announcements').insert([payload]);
        if (error) throw error;
        toast.success('Post published successfully');
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err) {
      toast.error(`Failed: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (ann) => {
    setIsEditing(ann.id);
    setFormData({
      title: ann.title,
      content: ann.content,
      post_type: ann.post_type,
      priority: ann.priority,
      target_dept: ann.target_role || 'All',
      is_pinned: ann.is_pinned,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', post_type: 'Announcement', priority: 'Low', target_dept: 'All', expires_at: '', is_pinned: false });
    setSelectedFile(null);
    setIsEditing(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post? All reactions and comments will be lost.")) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast.success("Deleted successfully");
      fetchAnnouncements();
    } catch (err) {
      toast.error("Deletion failed");
    }
  };


  const togglePin = async (id, currentVal) => {
    try {
      const { error } = await supabase.from('announcements').update({ is_pinned: !currentVal }).eq('id', id);
      if (error) throw error;
      fetchAnnouncements();
    } catch (err) {
      toast.error("Pin toggle failed");
    }
  };

  // REACTION HANDLER
  const handleReact = async (announcementId, type) => {
    if (!profile) return;
    
    setAnimatingReaction({ annId: announcementId, type });
    setTimeout(() => setAnimatingReaction(null), 300);

    const existingReaction = announcements
      .find(a => a.id === announcementId)
      ?.announcement_reactions?.find(r => r.employee_id === (profile?.employee_id || profile?.id));

    try {
      if (existingReaction && existingReaction.reaction_type === type) {
         // Toggle off (remove reaction)
         await supabase.from('announcement_reactions').delete().eq('id', existingReaction.id);
      } else {
         // Upsert reaction
         const { error } = await supabase
          .from('announcement_reactions')
          .upsert({
            announcement_id: announcementId,
            employee_id: profile?.employee_id || profile?.id,
            employee_name: profile?.email || 'User',
            reaction_type: type
          }, { onConflict: 'announcement_id,employee_id' });
         
         if (error) throw error;
      }
      fetchAnnouncements();
    } catch (error) {
      console.error("Reaction failed:", error);
      toast.error("Reaction failed");
    }
  };

  // COMMENT HANDLER
  const handlePostComment = async (announcementId) => {
    const content = commentInputs[announcementId]?.trim();
    if (!content) return;

    try {
      const { error } = await supabase.from('announcement_comments').insert({
        announcement_id: announcementId,
        content: content,
        employee_id: profile?.employee_id || profile?.id,
        employee_name: 'Santhoshkumar Ganesan'
      });
      if (error) throw error;

      setCommentInputs({ ...commentInputs, [announcementId]: '' });
      fetchAnnouncements();
    } catch (error) {
      console.error("Comment failed:", error);
      toast.error("Failed to post comment");
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await supabase.from('announcement_comments').delete().eq('id', commentId);
      fetchAnnouncements();
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  const getPriorityColor = (p) => {
    switch(p) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPostTypeStyle = (type) => {
    switch(type) {
      case 'Birthday': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg animate-pulse';
      case 'Anniversary': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg';
      case 'Achievement': return 'bg-gradient-to-r from-green-400 to-blue-500 text-white shadow-lg';
      default: return 'bg-white text-gray-800';
    }
  };

  const filteredAnnouncements = announcements.filter(ann => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Announcements') return ann.post_type === 'Announcement';
    if (activeFilter === 'Events') return ann.post_type === 'Achievement' || ann.post_type === 'General';
    if (activeFilter === 'Birthdays') return ann.post_type === 'Birthday';
    if (activeFilter === 'Anniversaries') return ann.post_type === 'Anniversary';
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-2">
        <div>
          <div className="text-sm text-gray-400 mb-2">
            <span>Home</span> <span className="mx-1">&gt;</span> <span className="text-gray-700 font-semibold">Engage</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Company Feed</h1>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-2 bg-[#1E3A5F] text-white rounded font-medium hover:bg-[#2A4D7C] transition-shadow shadow-sm active:scale-95 text-sm"
          >
            <Plus className="w-5 h-5 mr-1.5" /> Create Post
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
        {['All', 'Announcements', 'Events', 'Birthdays', 'Anniversaries'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap border ${
              activeFilter === filter 
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="animate-pulse space-y-6">
            {[1,2,3].map(i => <div key={i} className="bg-white h-64 rounded-2xl shadow-sm border border-gray-100"></div>)}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
           <div className="bg-white p-12 rounded shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-400 text-center">
             <Megaphone className="w-16 h-16 mb-4 opacity-20" />
             <p className="text-xl font-bold text-gray-500">No Posts Yet</p>
             <p className="text-sm mt-2">Check back later for updates in this category!</p>
           </div>
        ) : (
           filteredAnnouncements.map(ann => {
             const isSpecial = ['Birthday', 'Anniversary', 'Achievement'].includes(ann.post_type);
             const typeClass = getPostTypeStyle(ann.post_type);
             const myReaction = ann.announcement_reactions?.find(r => r.employee_id === profile.employee_id);
             
             const authorName = ann.created_by || "Admin";
             const initials = typeof authorName === 'string' && authorName.length >= 2 ? authorName.substring(0, 2).toUpperCase() : 'AD';
             const avatarUrl = null;

             return (
              <div key={ann.id} className={classNames(
                "rounded shadow-sm border overflow-hidden transition-all duration-300",
                isSpecial ? 'border-transparent' : 'bg-white border-gray-200'
              )}>
                
                {/* Special Post Wrapper */}
                <div className={classNames("p-6", isSpecial ? typeClass : '')}>
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-full bg-gray-200 flex items-center justify-center border border-white shadow-sm overflow-hidden text-sm font-bold text-[#1E3A5F] shrink-0">
                          {isSpecial ? '🎉' : (
                            avatarUrl ? <img src={avatarUrl} alt="user" className="w-full h-full object-cover" /> : initials
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className={classNames("text-[15px] font-bold leading-tight", isSpecial ? 'text-white' : 'text-gray-900')}>
                            {authorName}
                          </span>
                          <div className={classNames("flex items-center text-[12px] font-medium mt-0.5 gap-2", isSpecial ? 'text-white/80' : 'text-gray-500')}>
                            <span>{format(parseISO(ann.created_at), 'MMM d, yyyy • h:mm a')}</span>
                            {!isSpecial && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPriorityColor(ann.priority)}`}>{ann.priority.toUpperCase()}</span>}
                            {ann.target_dept !== 'All' && <span>• 🎯 {ann.target_dept}</span>}
                          </div>
                        </div>
                     </div>
                     
                     {/* Actions */}
                     <div className="flex gap-1 items-center shrink-0">
                       <button onClick={() => togglePin(ann.id, ann.is_pinned)} className={classNames("p-1.5 rounded-md transition", ann.is_pinned ? "text-orange-500" : "text-gray-400 hover:text-orange-600")} title={ann.is_pinned ? "Unpin Post" : "Pin Post"}>
                         <Pin className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => handleEdit(ann)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md transition" title="Edit Post">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(ann.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md transition" title="Delete Post">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                  </div>

                  {/* Post Title & Content */}
                  <h3 className={classNames("text-[17px] font-semibold mb-2 text-left", isSpecial ? 'text-white' : 'text-[#1E3A5F]')}>
                    {ann.title}
                  </h3>
                  <div className={classNames("whitespace-pre-wrap text-[15px] leading-relaxed", isSpecial ? 'text-white font-medium text-lg text-center' : 'text-gray-700')}>
                    {ann.content}
                  </div>
                </div>

                {/* Media Image */}
                {ann.image_url && (
                  <div 
                    className="w-full max-h-96 overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer"
                    onClick={() => setLightboxImage(ann.image_url)}
                  >
                    <img src={ann.image_url} alt="post media" className="w-full object-cover hover:opacity-95 transition-opacity" loading="lazy" />
                  </div>
                )}

                {/* Reactions Bar Below Content */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white flex flex-col gap-4">
                  {/* Reaction Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {REACTION_TYPES.map(rx => {
                       const count = ann.announcement_reactions?.filter(r => r.reaction_type === rx.type).length || 0;
                       const hasReacted = ann.announcement_reactions?.some(r => r.reaction_type === rx.type && r.employee_id === (profile?.employee_id || profile?.id));
                       const isAnimating = animatingReaction?.annId === ann.id && animatingReaction?.type === rx.type;
                       
                       return (
                         <div key={rx.type} className="relative group/react">
                           <button 
                             onClick={() => handleReact(ann.id, rx.type)}
                             className={classNames(
                               "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border",
                               hasReacted ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100',
                               isAnimating ? 'animate-reactionPop' : 'hover:scale-105 active:scale-95'
                             )}
                           >
                             <span className="text-base">{rx.emoji}</span>
                             {count > 0 && <span>{count}</span>}
                           </button>
                           
                           {/* Hover Info */}
                           {count > 0 && (
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/react:block w-max max-w-[150px] bg-gray-900 text-white text-xs rounded-lg p-2 z-50 shadow-xl opacity-90 text-center pointer-events-none">
                               {ann.announcement_reactions.filter(r => r.reaction_type === rx.type).slice(0, 5).map(r => (
                                 <div key={r.id} className="truncate">{r.employee_name || 'Employee'}</div>
                               ))}
                               {count > 5 && <div className="text-gray-400 italic">+{count - 5} more</div>}
                             </div>
                           )}
                         </div>
                       );
                    })}
                  </div>
                  
                  {/* Comments Toggle */}
                  <div className="flex justify-between items-center text-sm font-medium border-t border-gray-100 pt-3">
                     <span className="text-gray-500">{ann.announcement_comments?.length || 0} Comments</span>
                     <button 
                        onClick={() => setShowComments(prev => ({...prev, [ann.id]: !prev[ann.id]}))}
                        className="text-gray-600 hover:text-[#2E86AB] flex items-center gap-2 transition-colors"
                     >
                       <MessageSquare className="w-4 h-4" /> {showComments[ann.id] ? 'Hide Comments' : 'Show Comments'}
                     </button>
                  </div>
                </div>

                {/* Comments Section */}
                {showComments[ann.id] && (
                  <div className="bg-gray-50 p-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Comment List */}
                    {ann.announcement_comments?.map(comment => {
                      let timeAgo = 'Just now';
                      if (comment.created_at) {
                         const diffMins = Math.floor((new Date() - new Date(comment.created_at)) / 60000);
                         if (diffMins < 1) timeAgo = 'Just now';
                         else if (diffMins < 60) timeAgo = `${diffMins} mins ago`;
                         else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins/60)} hrs ago`;
                         else timeAgo = `${Math.floor(diffMins/1440)} days ago`;
                      }

                      return (
                        <div key={comment.id} className="flex gap-3 relative group/comment">
                          <div className="w-8 h-8 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {comment.employee_name ? comment.employee_name[0].toUpperCase() : 'E'}
                          </div>
                          <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none shadow-sm flex-1 border border-gray-100">
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-sm text-[#1E3A5F] hover:underline cursor-pointer">{comment.employee_name || 'Employee'}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{timeAgo}</span>
                            </div>
                            <p className="text-gray-700 text-sm mt-0.5">{comment.content}</p>
                          </div>
                          {/* Delete comment if admin or owner */}
                          {(isAdmin || profile?.employee_id === comment.employee_id) && (
                            <button onClick={() => deleteComment(comment.id)} className="absolute right-0 top-1 p-1 invisible group-hover/comment:visible text-gray-400 hover:text-red-500 bg-gray-50 rounded-full shadow-sm border border-gray-200">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Write Comment */}
                    <div className="flex gap-3 items-start mt-2">
                      <div className="w-8 h-8 rounded-full bg-[#2E86AB] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                        {profile?.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <form 
                        onSubmit={e => { e.preventDefault(); handlePostComment(ann.id); }} 
                        className="flex-1 relative"
                      >
                        <textarea 
                          rows="2"
                          placeholder="Write a comment..." 
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:border-[#2E86AB] focus:ring-1 focus:ring-[#2E86AB] resize-none"
                          value={commentInputs[ann.id] || ''}
                          onChange={e => setCommentInputs({...commentInputs, [ann.id]: e.target.value})}
                          onKeyDown={e => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handlePostComment(ann.id);
                            }
                          }}
                        />
                        <button 
                          type="submit" 
                          disabled={!commentInputs[ann.id]?.trim()}
                          className="absolute right-3 bottom-3 p-1.5 bg-[#1E3A5F] text-white hover:bg-[#2E86AB] rounded-lg disabled:opacity-50 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}

              </div>
             );
           })
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.9)] animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-[101]"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <X className="w-8 h-8" />
          </button>
          
          <img 
            src={lightboxImage} 
            alt="Fullscreen media" 
            className="max-w-[90vw] max-h-[90vh] object-contain select-none shadow-2xl rounded-sm cursor-default"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      {/* Admin Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F5F6FA] shrink-0">
              <h2 className="font-bold text-[#1E3A5F] flex items-center text-lg"><Megaphone className="w-5 h-5 mr-2" /> {isEditing ? 'Edit Post' : 'Create Post'}</h2>
              <button disabled={isSubmitting} onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 transition"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-5 overflow-y-auto">
              
              {/* Type & Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Post Type</label>
                    <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none transition-all font-medium text-gray-700" value={formData.post_type} onChange={e => setFormData({...formData, post_type: e.target.value})}>
                      <option>Announcement</option>
                      <option>Achievement</option>
                      <option>Birthday</option>
                      <option>Anniversary</option>
                      <option>General</option>
                    </select>
                 </div>
                 {formData.post_type === 'Announcement' && (
                   <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Priority</label>
                      <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none transition-all font-medium text-gray-700" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                        <option>Low</option><option>Medium</option><option>High</option>
                      </select>
                   </div>
                 )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Post Title <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none transition-all placeholder:text-gray-400" placeholder="What's the update about?" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Content <span className="text-red-500">*</span></label>
                <textarea required rows="4" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none transition-all placeholder:text-gray-400 resize-none" placeholder="Share your thoughts or news with the team..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
              </div>

              {/* Photo Attachment Section */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Attach Image / Media</label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group relative overflow-hidden"
                  onClick={() => document.getElementById('photo-upload').click()}
                >
                  <input type="file" id="photo-upload" className="hidden" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} />
                  
                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-32 mb-3 bg-gray-200 rounded-lg overflow-hidden relative">
                         <img src={URL.createObjectURL(selectedFile)} alt="preview" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-sm font-bold text-[#1E3A5F] truncate max-w-xs">{selectedFile.name}</span>
                      <p className="text-xs text-gray-500 hover:text-red-500 mt-1" onClick={(e) => {e.stopPropagation(); setSelectedFile(null);}}>Remove Image</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-6 h-6 text-blue-500" />
                      </div>
                      <span className="text-sm font-bold text-[#1E3A5F] block mb-1">Upload from Device</span>
                      <p className="text-xs text-gray-500">Supports JPG, PNG (Max 5MB)</p>
                      
                      <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
                           <ImageIcon className="w-3 h-3 text-[darkgray]" /> Google Photos
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
                           <ImageIcon className="w-3 h-3 text-[darkgray]" /> Google Drive
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 space-y-4">
                 <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-gray-700">Target Department</label>
                    <select className="p-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none cursor-pointer" value={formData.target_dept} onChange={e => setFormData({...formData, target_dept: e.target.value})}>
                      <option>All</option><option>Engineering</option><option>HR</option><option>Sales</option>
                    </select>
                 </div>
                 
                 {isAdmin && (
                   <label className="flex justify-between items-center cursor-pointer group">
                     <div className="flex flex-col">
                       <span className="text-sm font-bold text-gray-700">Pin to Feed</span>
                       <span className="text-xs text-gray-500">Keep this post fixed at the top</span>
                     </div>
                     <div className="relative inline-flex items-center">
                       <input type="checkbox" className="sr-only peer" checked={formData.is_pinned} onChange={e => setFormData({...formData, is_pinned: e.target.checked})} />
                       <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#28A745] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                     </div>
                   </label>
                 )}
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-[#1E3A5F] text-white rounded-xl font-bold hover:bg-[#2A4D7C] transition-colors disabled:opacity-70 flex items-center justify-center">
                  {isSubmitting ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : (isEditing ? 'Save Changes' : 'Post to Feed')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Announcements;

