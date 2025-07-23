import React, { useState } from 'react';
import { auth } from '../firebase';
import './Users.css'; // Ensure you have a CSS file for Users

const Users = ({ users, sharedUsers = [] }) => {
  return (
    <div className="users">
      <h4>Online Users</h4>
      <ul>
        {users.map((user, index) => (
          <li key={index}>{user}</li>
        ))}
      </ul>
      
      {/* Add shared users section */}
      <h4 style={{ marginTop: '20px' }}>Users with Edit Access</h4>
      {sharedUsers.length === 0 ? (
        <div className="no-shared-users">No Users Have Edit Access</div>
      ) : (
        <ul>
          {sharedUsers.map((email, index) => (
            <li key={index}>{email}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Users;