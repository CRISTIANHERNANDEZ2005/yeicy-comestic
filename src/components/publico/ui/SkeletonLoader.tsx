import React from 'react';


const SkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-loader ${className}`}></div>
);

export default SkeletonLoader; 