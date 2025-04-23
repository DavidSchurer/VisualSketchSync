import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isWhiteboardPage = location.pathname.includes('/whiteboard');

  return (
    <header className="app-header">
      <div className="header-content">
        {isWhiteboardPage && (
          <button 
            className="back-button" 
            onClick={() => navigate('/homepage')}
          >
            ← Back to HomePage
          </button>
        )}
        <div className="title-container">
          <h1 className="app-title">VisualSketchSync</h1>
          <p className="app-subtitle">Developed by David Schurer</p>
        </div>
      </div>
    </header>
  );
};

export default Header; 