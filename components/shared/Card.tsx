
import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  // Fix: Replaced JSX.Element with React.ReactElement because the JSX namespace was not available.
  icon: React.ReactElement;
  color: string;
}

export const Card: React.FC<CardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">{title}</p>
        <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      </div>
      <div className={`p-4 rounded-full ${color}`}>
        {icon}
      </div>
    </div>
  );
};