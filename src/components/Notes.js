import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import Draggable from 'react-draggable';

const Notes = ({ onClose, whiteboardId }) => {
  const [noteText, setNoteText] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');

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
    <Draggable>
      <div className="notes-popup">
        <div className="notes-header">
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
    </Draggable>
  );
};

export default Notes;