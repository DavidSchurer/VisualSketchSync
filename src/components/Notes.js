import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const Notes = ({ onClose, whiteboardId }) => {
  const [noteText, setNoteText] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e) => {
    setDragging(true);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      const newX = e.clientX - position.x;
      const newY = e.clientY - position.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleSaveNote = async () => {
    try {
      const noteData = {
        text: noteText,
        fontSize,
        fontFamily,
        timestamp: new Date(),
      };
      await addDoc(collection(db, 'whiteboards', whiteboardId, 'notes'), noteData);
      onClose(); // Close the notes UI after saving
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  return (
    <div
      className="notes-popup"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="notes-header" onMouseDown={handleMouseDown}>
        <h3>Notes</h3>
        <button className="close-button" onClick={onClose}>✖</button>
      </div>
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Type your notes here..."
      />
      <div className="notes-controls">
        <label>Font Size:</label>
        <input
          type="number"
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
        />
        <label>Font Family:</label>
        <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
      </div>
      <button onClick={handleSaveNote}>Save Note</button>
    </div>
  );
};

export default Notes;