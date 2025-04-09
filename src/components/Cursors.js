import React from 'react';
import './Cursors.css'; // Create this if it doesn't exist

const Cursors = ({ cursors }) => {
  return (
    <div className="cursors-overlay">
      {Object.keys(cursors).map(email => {
        const cursor = cursors[email];
        return (
          <div 
            key={email}
            className="remote-cursor"
            style={{
              left: cursor.x,
              top: cursor.y,
              backgroundColor: cursor.color || '#000'
            }}
          >
            <div className="cursor-pointer">✎</div>
            <div className="cursor-label">{email}</div>
          </div>
        );
      })}
    </div>
  );
};

export default Cursors;