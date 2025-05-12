import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import Header from './Header';
import './Homepage.css';

const Homepage = () => {
    const [whiteboards, setWhiteboards] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [whiteboardToDelete, setWhiteboardToDelete] = useState(null);
    const [showCreatePopup, setShowCreatePopup] = useState(false);
    const [newWhiteboardName, setNewWhiteboardName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchWhiteboards = async () => {
            const user = auth.currentUser;
            if (user) {
                const whiteboardCollection = collection(db, 'whiteboards');
                const snapshot = await getDocs(whiteboardCollection);
                const whiteboardData = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(whiteboard => whiteboard.createdBy === user.email); // Filter by current user
                
                // Sort whiteboards by timestamp (newest first) for better UX
                whiteboardData.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
                setWhiteboards(whiteboardData);
            }
        };

        fetchWhiteboards();
        
        // Set up real-time updates for whiteboards
        const intervalId = setInterval(fetchWhiteboards, 10000); // Refresh every 10 seconds
        
        return () => {
            clearInterval(intervalId); // Clean up on unmount
        };
    }, []);

    const openCreatePopup = () => {
        setNewWhiteboardName('');
        setShowCreatePopup(true);
    };

    const closeCreatePopup = () => {
        setShowCreatePopup(false);
        setNewWhiteboardName('');
    };

    const createNewWhiteboard = async () => {
        if (newWhiteboardName.trim()) {
            const user = auth.currentUser;
            if (user) {
                // Store user email in localStorage for persistence
                localStorage.setItem('currentUserEmail', user.email);
                
                const newWhiteboard = {
                    name: newWhiteboardName.trim(),
                    createdBy: user.email,
                    timestamp: Timestamp.now(),
                };
                const docRef = await addDoc(collection(db, 'whiteboards'), newWhiteboard);
                setShowCreatePopup(false);
                navigate(`/whiteboard/${docRef.id}`);
            }
        }
    };

    const handleDeleteClick = (e, whiteboard) => {
        e.stopPropagation(); // Prevent navigation to the whiteboard
        setWhiteboardToDelete(whiteboard);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (whiteboardToDelete) {
            try {
                await deleteDoc(doc(db, 'whiteboards', whiteboardToDelete.id));
                setWhiteboards(whiteboards.filter(wb => wb.id !== whiteboardToDelete.id));
                setShowDeleteConfirm(false);
                setWhiteboardToDelete(null);
            } catch (error) {
                console.error("Error deleting whiteboard:", error);
                alert("Failed to delete whiteboard. Please try again.");
            }
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setWhiteboardToDelete(null);
    };

    return (
        <div className="homepage-container">
            <Header />
            <div className="homepage-content">
                <h1>Your Whiteboards</h1>
                
                <div className="whiteboard-grid">
                    {whiteboards.length === 0 ? (
                        <div className="no-whiteboards">
                            <p>You haven't created any whiteboards yet.</p>
                        </div>
                    ) : (
                        whiteboards.map(whiteboard => (
                            <div 
                                key={whiteboard.id} 
                                className="whiteboard-item-container"
                            >
                                <button 
                                    className="whiteboard-btn" 
                                    onClick={() => navigate(`/whiteboard/${whiteboard.id}`)}
                                >
                                    <h3>{whiteboard.name || "Untitled Whiteboard"}</h3>
                                    <p>{new Date(whiteboard.timestamp.toDate()).toLocaleString()}</p>
                                </button>
                                <button 
                                    className="delete-btn"
                                    onClick={(e) => handleDeleteClick(e, whiteboard)}
                                    title="Delete whiteboard"
                                >
                                    <span className="trash-icon">🗑️</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
                
                <button className="new-whiteboard-btn create-btn" onClick={openCreatePopup}>
                    Create New Whiteboard
                </button>
            </div>
            
            {/* Delete Confirmation Popup */}
            {showDeleteConfirm && (
                <div className="confirmation-overlay">
                    <div className="confirmation-dialog">
                        <h3>Delete Whiteboard</h3>
                        <p>Are you sure you want to delete "{whiteboardToDelete?.name || 'this whiteboard'}"?</p>
                        <p className="confirmation-warning">This action cannot be undone.</p>
                        <div className="confirmation-buttons">
                            <button className="confirm-btn no-btn" onClick={cancelDelete}>No</button>
                            <button className="confirm-btn yes-btn" onClick={confirmDelete}>Yes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Whiteboard Popup */}
            {showCreatePopup && (
                <div className="confirmation-overlay">
                    <div className="confirmation-dialog create-dialog">
                        <h3>Create New Whiteboard</h3>
                        <div className="input-container">
                            <label htmlFor="whiteboard-name">Whiteboard Name</label>
                            <input
                                id="whiteboard-name"
                                type="text"
                                value={newWhiteboardName}
                                onChange={(e) => setNewWhiteboardName(e.target.value)}
                                placeholder="Enter a name for your whiteboard"
                                autoFocus
                            />
                        </div>
                        <div className="confirmation-buttons">
                            <button className="confirm-btn no-btn" onClick={closeCreatePopup}>Cancel</button>
                            <button 
                                className="confirm-btn create-confirm-btn" 
                                onClick={createNewWhiteboard}
                                disabled={!newWhiteboardName.trim()}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Homepage;