import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import './NotesEditor.css'; 

const NotesEditor = ({ whiteboardId, onClose }) => {
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const notesRef = collection(db, 'whiteboards', whiteboardId, 'notes');
        const unsubscribe = onSnapshot(notesRef, (snapshot) => {
            const notesData = snapshot.docs.map(doc => doc.data()).join('\n');
            setNotes(notesData);
        });

        return () => unsubscribe();
    }, [whiteboardId]);

    const handleNotesChange = (e) => {
        const newNotes = e.target.value;
        setNotes(newNotes);

        // Save notes to Firestore
        const notesRef = doc(db, 'whiteboards', whiteboardId, 'notes', 'currentNotes');
        setDoc(notesRef, { content: newNotes });
    };

    return (
        <div className="notes-editor">
            <h3>Notes</h3>
            <textarea
                value={notes}
                onChange={handleNotesChange}
                placeholder="Type your notes here..."
                rows={10}
            />
            <button className="close-btn" onClick={onClose}>Close</button>
        </div>
    );
};

export default NotesEditor;