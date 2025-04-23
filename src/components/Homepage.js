import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import Header from './Header';
import './Homepage.css';

const Homepage = () => {
    const [whiteboards, setWhiteboards] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchWhiteboards = async () => {
            const user = auth.currentUser;
            if (user) {
                const whiteboardCollection = collection(db, 'whiteboards');
                const snapshot = await getDocs(whiteboardCollection);
                const whiteboardData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setWhiteboards(whiteboardData);
            }
        };

        fetchWhiteboards();
    }, []);

    const createNewWhiteboard = async () => {
        const name = prompt("Enter a name for your new whiteboard:");
        if (name) {
            const user = auth.currentUser;
            if (user) {
                const newWhiteboard = {
                    name,
                    createdBy: user.email,
                    timestamp: Timestamp.now(),
                };
                const docRef = await addDoc(collection(db, 'whiteboards'), newWhiteboard);
                navigate(`/whiteboard/${docRef.id}`);
            }
        }
    };

    return (
        <div className="homepage-container">
            <Header />
            <div className="homepage-content">
                <h1>Your Whiteboards</h1>
                
                <button className="new-whiteboard-btn create-btn" onClick={createNewWhiteboard}>
                    Create New Whiteboard
                </button>
                
                <div className="whiteboard-grid">
                    {whiteboards.length === 0 ? (
                        <div className="no-whiteboards">
                            <p>You haven't created any whiteboards yet.</p>
                        </div>
                    ) : (
                        whiteboards.map(whiteboard => (
                            <button 
                                key={whiteboard.id} 
                                className="whiteboard-btn" 
                                onClick={() => navigate(`/whiteboard/${whiteboard.id}`)}
                            >
                                <h3>{whiteboard.name || "Untitled Whiteboard"}</h3>
                                <p>{new Date(whiteboard.timestamp.toDate()).toLocaleString()}</p>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Homepage;