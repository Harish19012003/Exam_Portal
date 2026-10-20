import React from 'react';

export const Loader = ({ fullScreen = false }) => {
  const loaderStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: fullScreen ? '100vh' : '100%',
    backgroundColor: fullScreen ? 'var(--bg-primary)' : 'transparent',
    color: 'var(--accent)',
  };

  const spinnerStyles = {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border)',
    borderTop: '4px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  return (
    <div style={loaderStyles}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={spinnerStyles} />
    </div>
  );
};
