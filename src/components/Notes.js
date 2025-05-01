import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

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
    <div className="notes-popup">
      <h3>Notes</h3>
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Type your notes here..."
      />
      <div>
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
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default Notes;