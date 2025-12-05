// src/components/TopicListCard.jsx
import React, { useState } from "react";

const TopicListCard = ({ title, topics, bgColor, textColor, icon }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleTopics = expanded ? topics : topics.slice(0, 5);
  const hiddenCount = topics.length - 5;

  return (
    <div className={`p-5 rounded-xl ${bgColor} shadow-sm border border-opacity-50 transition-all duration-300`}>
      <h3 className={`font-bold text-lg mb-3 ${textColor} flex justify-between items-center`}>
        <span>{icon} {title}</span>
        <span className="text-sm opacity-70 bg-white bg-opacity-50 px-2 py-1 rounded-full">{topics.length}</span>
      </h3>
      
      {topics.length === 0 ? (
        <p className="text-sm opacity-70 italic pl-1">No data available yet.</p>
      ) : (
        <ul className="space-y-2">
          {visibleTopics.map(([name, data]) => (
            <li key={name} className="flex justify-between items-center text-gray-700 font-medium text-sm md:text-base border-b border-black/5 pb-1 last:border-0">
              <span className="capitalize truncate pr-2">{name}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.score > 0.6 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {Math.round(data.score * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {topics.length > 5 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className={`w-full mt-3 text-xs font-bold uppercase tracking-wide py-2 rounded-lg transition-colors ${textColor} hover:bg-white hover:bg-opacity-50`}
        >
          {expanded ? "Show Less" : `Show ${hiddenCount} More`}
        </button>
      )}
    </div>
  );
};

export default TopicListCard;