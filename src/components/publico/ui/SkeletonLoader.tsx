import React from 'react';
import './skeleton.css';

const SkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-loader ${className}`}></div>
);

export default SkeletonLoader; 