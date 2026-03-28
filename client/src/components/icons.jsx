import React from 'react';

// Soft drifting clouds
export const Cloud = ({ className, delay }) => (
  <svg className={className} style={{ animationDelay: delay }} viewBox="0 0 575 304" fill="none">
    <path d="M455.5 106C451.3 46.4 401.7 0 341 0c-43.6 0-81.8 24-102.3 59.8C222.1 50.1 201.7 44 180 44c-53 0-96 43-96 96 0 4.2.3 8.3.8 12.3C36.3 162.1 0 206.8 0 260c0 53 43 96 96 96h359.5c66.3 0 120-53.7 120-120S521.8 116 455.5 116z" fill="white" fillOpacity="0.3" />
  </svg>
);

// The Brand Leaf
export const LeafIcon = () => (
  <svg className="nook-leaf-icon" viewBox="0 0 24 24" fill="none">
    <path d="M2 21c0-8 6-14 14-14s6 2 6 2-2 6-2 14" stroke="#5aaa78" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 7l-4 4" stroke="#5aaa78" strokeWidth="2" />
  </svg>
);

// Form Input Icons
export const InputIcon = ({ type }) => {
  if (type === 'email') {
    return (
      <svg className="input-icon" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="#5aaa78" strokeWidth="1.5" />
        <path d="M1 5l7 5 7-5" stroke="#5aaa78" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className="input-icon" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="2" stroke="#5aaa78" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" stroke="#5aaa78" strokeWidth="1.5" />
      <circle cx="8" cy="10.5" r="1" fill="#5aaa78" />
    </svg>
  );
};