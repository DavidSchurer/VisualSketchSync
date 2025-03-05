import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from './components/Login';
import Register from './components/Register';
import Whiteboard from './components/Whiteboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/whiteboard" 
          element={
            <ProtectedRoute>
              <Whiteboard />
            </ProtectedRoute>
          } />
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
