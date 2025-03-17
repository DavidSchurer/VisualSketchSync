import React from 'react';

const Cursors = ({ cursors }) => {
  return (
    <div className="cursors-overlay">
      {Object.values(cursors).map((cursor, index) => (
        <div 
          key={index}
          className="remote-cursor"
          style={{
            position: 'fixed',
            left: cursor.x + 10,
            top: cursor.y - 20,
            color: cursor.color,
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          {cursor.email}
        </div>
      ))}
    </div>
  );
};

export default Cursors;