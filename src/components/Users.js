import React from 'react';
import { FiUser } from 'react-icons/fi';

const Users = ({ users }) => {
    return (
        <div className="users-sidebar">
            <h3>Online Users</h3>
            <ul>
                {users.map((user, index) => (
                    <li key={index} className="user-item">
                        <FiUser className="user-icon" />
                        <span>{user}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Users;