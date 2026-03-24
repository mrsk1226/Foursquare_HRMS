import React from 'react';

const StatsCard = ({ title, value, icon: Icon, trend, colorClass = "bg-[#1E3A5F]" }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <p className="text-xs mt-2 text-green-600 bg-green-50 inline-block px-2 py-1 rounded-full">
            {trend}
          </p>
        )}
      </div>
      <div className={`p-4 rounded-xl ${colorClass} text-white`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
};

export default StatsCard;
