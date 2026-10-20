import React from 'react';

export const Skeleton = ({ width = '100%', height = '20px', borderRadius = 'var(--radius)' }) => {
  const skeletonStyles = {
    width,
    height,
    borderRadius,
    backgroundColor: 'var(--bg-secondary)',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      <div style={skeletonStyles} />
    </>
  );
};
