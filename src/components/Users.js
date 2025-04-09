import React, { useState } from 'react';
import { auth } from '../firebase';
import './Users.css'; // Ensure you have a CSS file for Users

const Users = ({ users }) => {
    const currentUserEmail = auth.currentUser?.email;
    const [isExpanded, setIsExpanded] = useState(true); // State to manage visibility

    const toggleUsersList = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={`users-sidebar ${isExpanded ? '' : 'collapsed'}`}>
            <button className="toggle-btn" onClick={toggleUsersList}>
                {isExpanded ? '<' : '>'}
            </button>
            {isExpanded && (
                <>
                    <h3>Online Users</h3>
                    {users.length === 0 ? (
                        <div className="empty-user-list">No users online</div>
                    ) : (
                        <ul className="user-list">
                            {users.map((email, index) => (
                                <li 
                                    key={index} 
                                    className={`user-item ${email === currentUserEmail ? 'current-user' : ''}`}
                                >
                                    <span className="user-icon">👤</span>
                                    <span className="user-email">{email}</span>
                                    {email === currentUserEmail && <span className="user-label">(You)</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default Users;