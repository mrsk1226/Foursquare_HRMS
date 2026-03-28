import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumb = ({ items = [] }) => {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-2 mb-6 text-sm font-medium">
      <div 
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-blue-400 cursor-pointer hover:text-blue-300 transition-colors group"
      >
        <Home size={14} className="group-hover:scale-110 transition-transform" />
        <span>Home</span>
      </div>
      
      {(items || []).map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="text-slate-600 mt-0.5" />
          {item.path ? (
            <span 
              onClick={() => navigate(item.path)}
              className="text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
            >
              {item.label}
            </span>
          ) : (
            <span className="text-slate-400 cursor-default">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
