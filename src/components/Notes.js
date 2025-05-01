import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import './Notes.css'; // Ensure you have the CSS file imported

const Notes = ({ onClose, whiteboardId }) => {
  const [noteText, setNoteText] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');

  // Fetch existing notes from Firestore
  useEffect(() => {
    const notesRef = collection(db, 'whiteboards', whiteboardId, 'notes');
    const unsubscribe = onSnapshot(notesRef, (snapshot) => {
      const notesData = snapshot.docs.map(doc => doc.data());
      if (notesData.length > 0) {
        setNoteText(notesData[0].text); // Display the first note in the textarea
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [whiteboardId]);

  // Autosave function
  useEffect(() => {
    const saveNote = async () => {
      try {
        const noteData = {
          text: noteText,
          fontSize,
          fontFamily,
          timestamp: new Date(),
        };
        // Update the existing note or create a new one
        const notesRef = collection(db, 'whiteboards', whiteboardId, 'notes');
        const existingNotes = await notesRef.get();
        if (existingNotes.docs.length > 0) {
          // Update the first note
          const noteDoc = existingNotes.docs[0];
          await noteDoc.ref.update(noteData);
        } else {
          // Create a new note
          await addDoc(notesRef, noteData);
        }
      } catch (error) {
        console.error("Error saving note:", error);
      }
    };

    const timeoutId = setTimeout(saveNote, 1000); // Autosave every second

    return () => clearTimeout(timeoutId); // Cleanup timeout on unmount
  }, [noteText, fontSize, fontFamily, whiteboardId]);

  const handleSaveNote = async () => {
    try {
      const noteData = {
        text: noteText,
        fontSize,
        fontFamily,
        timestamp: new Date(),
      };
      const notesRef = collection(db, 'whiteboards', whiteboardId, 'notes');
      const existingNotes = await notesRef.get();
      if (existingNotes.docs.length > 0) {
        const noteDoc = existingNotes.docs[0];
        await noteDoc.ref.update(noteData);
      } else {
        await addDoc(notesRef, noteData);
      }
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  return (
    <div className="notes-backdrop" onClick={onClose}>
      <div className="notes-popup" onClick={(e) => e.stopPropagation()}>
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
        <button className="save-button" onClick={handleSaveNote}>Save Note</button>
      </div>
    </div>
  );
};

export default Notes;