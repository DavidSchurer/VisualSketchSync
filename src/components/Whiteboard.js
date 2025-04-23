import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { socket } from './socket';
import { auth, db } from '../firebase';
import Cursors from './Cursors';
import Users from './Users';
import Header from './Header';
import './Whiteboard.css';
import { collection, addDoc, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';

const Whiteboard = () => {
  // Core state
  const [color, setColor] = useState('black');
  const [size, setSize] = useState(5);
  const [isTextMode, setIsTextMode] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [isUsersExpanded, setIsUsersExpanded] = useState(true); // State for users section visibility
  const [currentWhiteboardId, setCurrentWhiteboardId] = useState(null);
  const [whiteboardName, setWhiteboardName] = useState('');
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [showSavePopup, setShowSavePopup] = useState(false); // State for save popup
  const [newWhiteboardName, setNewWhiteboardName] = useState(''); // State for whiteboard name input
  const [saveSuccess, setSaveSuccess] = useState(false); // State for save success message
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom level in percentage
  
  // Elements state
  const [textBoxes, setTextBoxes] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [previewShape, setPreviewShape] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [activeTextBoxId, setActiveTextBoxId] = useState(null);
  
  // Refs
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const shapeRefs = useRef({});
  const textBoxRefs = useRef({}); // Add refs for textboxes

  // Collaboration state
  const [users, setUsers] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});

  // Get the whiteboard ID from the URL and load data
  useEffect(() => {
    const urlParts = window.location.pathname.split('/');
    const id = urlParts[urlParts.length - 1];
    
    if (id && id !== 'whiteboard') {
      setCurrentWhiteboardId(id);
      
      // Fetch the whiteboard data
      const fetchWhiteboardData = async () => {
        try {
          const whiteboardRef = doc(db, 'whiteboards', id);
          const whiteboardSnapshot = await getDoc(whiteboardRef);
          
          if (whiteboardSnapshot.exists()) {
            const data = whiteboardSnapshot.data();
            setWhiteboardName(data.name || '');
            
            // If there's an image URL, load it onto the canvas
            if (data.imageUrl && canvasRef.current) {
              const img = new Image();
              img.onload = () => {
                const ctx = canvasRef.current.getContext('2d');
                ctx.drawImage(img, 0, 0);
              };
              img.src = data.imageUrl;
            }
          }
        } catch (error) {
          console.error("Error fetching whiteboard data:", error);
        }
      };
      
      fetchWhiteboardData();
    }
  }, []);

  // Socket connection
  useEffect(() => {
    socket.connect();
    const userEmail = auth.currentUser?.email;
    
    // Store user email in localStorage for persistence
    if (userEmail) {
      localStorage.setItem('currentUserEmail', userEmail);
    }
    
    // Get stored email from localStorage or use current auth email
    const persistedEmail = localStorage.getItem('currentUserEmail') || userEmail;
    
    if (persistedEmail) {
      socket.emit('join', persistedEmail);
    }

    socket.on('draw', handleRemoteDraw);
    socket.on('userList', setUsers);
    socket.on('addTextBox', handleRemoteTextBoxAdd);
    socket.on('updateTextBox', handleRemoteTextBoxUpdate);
    socket.on('remoteCursor', handleRemoteCursor);
    socket.on('userDisconnected', handleUserDisconnect);

    return () => {
      socket.off('draw');
      socket.off('userList');
      socket.off('addTextBox');
      socket.off('updateTextBox');
      socket.off('remoteCursor');
      socket.off('userDisconnected');
      socket.disconnect();
    };
  }, []);

  // Canvas initialization
  useEffect(() => {
    initializeCanvas();
    
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('mousemove', handleCursorMove);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('mousemove', handleCursorMove);
    };
  }, []);

  // Socket handlers
  const handleRemoteDraw = (data) => {
    const ctx = canvasRef.current.getContext('2d');
    const scale = data.scale || 1;
    
    ctx.beginPath();
    ctx.moveTo(data.lastX / scale, data.lastY / scale);
    ctx.lineTo(data.x / scale, data.y / scale);
    
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleRemoteTextBoxAdd = (textBox) => {
    setTextBoxes(prev => [...prev, textBox]);
  };

  const handleRemoteTextBoxUpdate = (updatedTextBox) => {
    setTextBoxes(prev => prev.map(tb =>
      tb.id === updatedTextBox.id ? updatedTextBox : tb
    ));
  };

  const handleRemoteCursor = (data) => {
    setRemoteCursors(prev => ({
      ...prev,
      [data.email]: data
    }));
  };

  const handleUserDisconnect = (email) => {
    setRemoteCursors(prev => {
      const newCursors = { ...prev };
      delete newCursors[email];
      return newCursors;
    });
  };

  const handleCursorMove = (e) => {
    const userEmail = localStorage.getItem('currentUserEmail') || auth.currentUser?.email;
    if (userEmail) {
      socket.emit('cursorMove', {
        x: e.clientX,
        y: e.clientY,
        email: userEmail,
        color
      });
    }
  };

  // Canvas functions
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const scale = window.devicePixelRatio || 1;
    
    // Calculate visible area dimensions
    const visibleWidth = window.innerWidth - 200;
    const visibleHeight = window.innerHeight;
    
    // Set canvas size to include the expanded area (10,000px in each direction)
    const totalWidth = visibleWidth + 20000; // +10,000px on left and right
    const totalHeight = visibleHeight + 20000; // +10,000px on top and bottom

    // Set the visible area dimensions for the canvas element
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    
    // Set the actual canvas dimensions with device pixel ratio
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;
    
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    
    // Center the canvas in the expanded area
    setCanvasPosition({ 
      x: -(10000 / 2), 
      y: -(10000 / 2) 
    });
  };

  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
    
    // Calculate visible area dimensions
    const visibleWidth = window.innerWidth - 200;
    const visibleHeight = window.innerHeight;
    
    // Set canvas size to include the expanded area
    const totalWidth = visibleWidth + 20000;
    const totalHeight = visibleHeight + 20000;
    
    // Preserve the drawing by copying it
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    
    // Update canvas dimensions
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;
    
    // Restore the drawing
    ctx.scale(scale, scale);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.imageSmoothingEnabled = true;
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Drawing functions
  const startDrawing = (e) => {
    if (isTextMode) return;
    
    if (isNavigationMode) {
      isDrawing.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      return;
    }
    
    isDrawing.current = true;
    const { x, y } = getMousePos(e);
    lastX.current = x;
    lastY.current = y;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    
    if (isNavigationMode) {
      // Calculate how much the mouse has moved
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      
      // Update the canvas position
      setCanvasPosition({
        x: canvasPosition.x + deltaX,
        y: canvasPosition.y + deltaY
      });
      
      // Update the canvas container's transform
      const canvasContainer = document.querySelector('.canvas-container');
      if (canvasContainer) {
        canvasContainer.style.transform = `translate(${canvasPosition.x + deltaX}px, ${canvasPosition.y + deltaY}px) scale(${zoomLevel / 100})`;
      }
      
      // Update the last position
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      return;
    }
    
    if (isTextMode) return;

    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
  
    ctx.beginPath();
    ctx.moveTo(lastX.current / scale, lastY.current / scale);
    ctx.lineTo(x / scale, y / scale);
    
    ctx.strokeStyle = isEraserActive ? 'white' : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  
    socket.emit('draw', {
      lastX: lastX.current,
      lastY: lastY.current,
      x: x,
      y: y,
      color: isEraserActive ? 'white' : color,
      size: size,
      scale: scale
    });
  
    lastX.current = x;
    lastY.current = y;
  };

  // UI handlers
  const handleColorChange = (newColor) => {
    setColor(newColor);
    setIsEraserActive(false);
  };


  const handleSizeChange = (e) => {
    setSize(parseInt(e.target.value, 10));
  };

  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };

  const toggleEraser = () => {
    setIsEraserActive(!isEraserActive);
  };

  // Users section toggle
  const toggleUsersList = () => {
    setIsUsersExpanded(!isUsersExpanded);
  };

  // Navigation mode toggle
  const toggleNavigationMode = () => {
    setIsNavigationMode(!isNavigationMode);
    setIsEraserActive(false);
    setIsTextMode(false);
    setSelectedShape(null);
  };

  // Shape and text handlers
  const handleTextModeToggle = () => {
    setIsTextMode(!isTextMode);
    setSelectedShape(null);
  };

  const handleShapeSelect = (shapeType) => {
    setSelectedShape(shapeType);
    setIsTextMode(false);
    setActiveTextBoxId(null); // Clear textbox selection when selecting a shape
  };

  const handleCanvasClick = (e) => {
    if (isNavigationMode) {
      // Don't do anything when in navigation mode
      return;
    }
    
    if (isTextMode) {
      addNewTextBox(e);
    } else if (selectedShape) {
      addNewShape(e);
    } else {
      // Deselect everything
      setSelectedShapeId(null);
      setActiveTextBoxId(null); // Clear textbox selection when clicking on canvas
      setTextBoxes(textBoxes.map(box => ({...box, isSelected: false})));
    }
  };

  const addNewTextBox = (e) => {
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    
    const newTextBox = {
      id: Date.now(),
      x,
      y,
      width: 200,
      height: 50,
      text: 'Double-click to edit',
      isEditing: false,
      isSelected: true,
    };
    
    const updatedTextBoxes = textBoxes.map(box => ({...box, isSelected: false}));
    setTextBoxes([...updatedTextBoxes, newTextBox]);
    setActiveTextBoxId(newTextBox.id);
    setIsTextMode(false);
    
    socket.emit('addTextBox', newTextBox);
  };

  const addNewShape = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newShape = {
      id: Date.now(),
      type: selectedShape,
      x,
      y,
      width: 100,
      height: 100,
      color,
      rotation: 0,
    };

    setShapes([...shapes, newShape]);
    setSelectedShape(null);
    setPreviewShape(null);
  };

  const handleTextChangeInBox = (e, index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = {
      ...updatedTextBoxes[index],
      text: e.target.value,
    };
    setTextBoxes(updatedTextBoxes);

    socket.emit('updateTextBox', updatedTextBoxes[index]);
  };

  const handleTextChange = (e, index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = {
      ...updatedTextBoxes[index],
      text: e.target.value,
    };
    setTextBoxes(updatedTextBoxes);

    socket.emit('updateTextBox', updatedTextBoxes[index]);
  };

  const handleTextDoubleClick = (index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = {
      ...updatedTextBoxes[index],
      isEditing: true
    };
    setTextBoxes(updatedTextBoxes);
  };

  const handleTextEditComplete = (index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = {
      ...updatedTextBoxes[index],
      isEditing: false
    };
    setTextBoxes(updatedTextBoxes);
  };

  const handleDragTextBoxStart = (e, index) => {
    if (e.target.classList.contains('handle')) {
      return;
    }
    
    const textBox = textBoxes[index];
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = textBox.x;
    const startTop = textBox.y;
    
    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      const updatedTextBoxes = [...textBoxes];
      updatedTextBoxes[index] = {
        ...updatedTextBoxes[index],
        x: startLeft + dx,
        y: startTop + dy
      };
      setTextBoxes(updatedTextBoxes);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Emit update to other users
      socket.emit('updateTextBox', textBoxes[index]);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTextBoxClick = (index) => {
    const updatedTextBoxes = textBoxes.map((box, i) => ({
      ...box,
      isSelected: i === index
    }));
    setTextBoxes(updatedTextBoxes);
    setActiveTextBoxId(updatedTextBoxes[index].id);
    setSelectedShapeId(null);
  };

  // Resize handlers
  const handleResizeTextBox = (e, index, direction) => {
    e.stopPropagation();
    e.preventDefault();
    
    const textBox = textBoxes[index];
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = textBox.width;
    const startHeight = textBox.height;
    const startX1 = textBox.x;
    const startY1 = textBox.y;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX1;
      let newY = startY1;
      
      // Apply transformations based on the handle being dragged
      switch(direction) {
        case 'bottom-right':
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = Math.max(30, startHeight + deltaY);
          break;
        case 'bottom-left':
          newWidth = Math.max(50, startWidth - deltaX);
          newHeight = Math.max(30, startHeight + deltaY);
          newX = startX1 + (startWidth - newWidth);
          break;
        case 'top-right':
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = Math.max(30, startHeight - deltaY);
          newY = startY1 + (startHeight - newHeight);
          break;
        case 'top-left':
          newWidth = Math.max(50, startWidth - deltaX);
          newHeight = Math.max(30, startHeight - deltaY);
          newX = startX1 + (startWidth - newWidth);
          newY = startY1 + (startHeight - newHeight);
          break;
        default:
          break;
      }
      
      const updatedTextBoxes = [...textBoxes];
      updatedTextBoxes[index] = {
        ...updatedTextBoxes[index],
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY
      };
      setTextBoxes(updatedTextBoxes);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Emit update to other users
      socket.emit('updateTextBox', textBoxes[index]);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Render helpers
  const renderShape = (shape) => {
    if (!shapeRefs.current[shape.id]) {
      shapeRefs.current[shape.id] = React.createRef();
    }
    
    const isSelected = selectedShapeId === shape.id;
    
    return (
      <Draggable
        key={shape.id}
        nodeRef={shapeRefs.current[shape.id]}
        position={{ x: shape.x, y: shape.y }}
        bounds=".canvas-container"
        onStart={(e) => {
          if (e.target.classList.contains('handle')) {
            return false;
          }
          setSelectedShapeId(shape.id);
          setTextBoxes(textBoxes.map(box => ({...box, isSelected: false})));
        }}
        onStop={(e, data) => {
          setShapes(shapes.map(s => 
            s.id === shape.id ? { ...s, x: data.x, y: data.y } : s
          ));
        }}
      >
        <div
          ref={shapeRefs.current[shape.id]}
          className={`shape ${shape.type} ${isSelected ? 'selected' : ''}`}
          style={{
            width: shape.width,
            height: shape.height,
            border: `2px solid ${shape.color}`,
            transform: `rotate(${shape.rotation || 0}deg)`
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShapeId(shape.id);
            setTextBoxes(textBoxes.map(box => ({...box, isSelected: false})));
          }}
        >
          {isSelected && (
            <>
              <div className="handle resize-handle top-left" />
              <div className="handle resize-handle top-right" />
              <div className="handle resize-handle bottom-left" />
              <div className="handle resize-handle bottom-right" />
            </>
          )}
        </div>
      </Draggable>
    );
  };

  const saveDrawing = async () => {
    setShowSavePopup(true);
  };

  const handleSaveConfirm = async () => {
    const canvas = canvasRef.current;
    const imageUrl = canvas.toDataURL(); // Get the image data

    try {
      // Check if we have a valid whiteboard ID
      if (currentWhiteboardId) {
        // This is an existing whiteboard, update it
        const whiteboardRef = doc(db, 'whiteboards', currentWhiteboardId);
        
        // Update with new image and timestamp
        await updateDoc(whiteboardRef, {
          imageUrl,
          timestamp: Timestamp.now()
        });
        
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setShowSavePopup(false);
        }, 2000);
      } else {
        // This is a new whiteboard
        if (newWhiteboardName.trim()) {
          setWhiteboardName(newWhiteboardName);
          
          const whiteboardData = {
            name: newWhiteboardName.trim(),
            imageUrl,
            createdBy: auth.currentUser.email,
            timestamp: Timestamp.now(),
          };

          const docRef = await addDoc(collection(db, 'whiteboards'), whiteboardData);
          setCurrentWhiteboardId(docRef.id);
          
          // Update URL without refreshing page
          window.history.pushState({}, '', `/whiteboard/${docRef.id}`);
          
          setSaveSuccess(true);
          setTimeout(() => {
            setSaveSuccess(false);
            setShowSavePopup(false);
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Error saving whiteboard:", error);
      // Show error in popup
      setSaveSuccess(false);
    }
  };

  const handleCancelSave = () => {
    setShowSavePopup(false);
    setSaveSuccess(false);
    setNewWhiteboardName(whiteboardName);
  };

  const handleZoomChange = (e) => {
    setZoomLevel(parseInt(e.target.value, 10));
  };

  // Main render
  return (
    <div className="app-container">
      <Header />
      <div className="whiteboard-container">
        <Cursors cursors={remoteCursors} />
        
        {/* Users section with toggle button */}
        <div className={`users-sidebar ${isUsersExpanded ? '' : 'collapsed'}`}>
          <button className="toggle-btn" onClick={toggleUsersList}>
            {isUsersExpanded ? '<' : '>'}
          </button>
          {isUsersExpanded && (
            <Users users={users} />
          )}
        </div>

        {/* Toolbar */}
        <div className={`toolbar ${isToolbarCollapsed ? 'collapsed' : ''}`}>
          <button className="collapse-btn" onClick={toggleToolbar}>
            {isToolbarCollapsed ? '>' : '<'}
          </button>
          
          <button className="save-btn" onClick={saveDrawing}>
            Save Whiteboard
          </button>
          
          {whiteboardName && (
            <div className="whiteboard-name">
              <h3>{whiteboardName}</h3>
            </div>
          )}
          
          <div className="colors">
            <div className="color-column">
              {['black', 'grey', 'blue', 'red', 'green'].map((colorOption) => (
                <div
                  key={colorOption}
                  className="color-option"
                  style={{ backgroundColor: colorOption }}
                  onClick={() => handleColorChange(colorOption)}
                />
              ))}
            </div>
            <div className="color-column">
              {['yellow', 'orange', 'purple', 'pink', 'brown'].map((colorOption) => (
                <div
                  key={colorOption}
                  className="color-option"
                  style={{ backgroundColor: colorOption }}
                  onClick={() => handleColorChange(colorOption)}
                />
              ))}
            </div>
          </div>
          
          <input
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{ width: '100%', marginTop: '10px'}}
          />
          
          <div 
            className={`navigation-tool ${isNavigationMode ? 'active' : ''}`} 
            onClick={toggleNavigationMode}
          >
            <span role="img" aria-label="navigation">👆</span>
            <span>Pan Mode {isNavigationMode ? '(Active)' : ''}</span>
          </div>
          
          <div className="eraser-tool" onClick={toggleEraser}>
            <span role="img" aria-label="eraser">🧽</span>
            <span>Eraser</span>
          </div>
          
          <div className="size-slider">
            <input
              type="range"
              min="1"
              max="20"
              value={size}
              onChange={handleSizeChange}
            />
            <span>{size}</span>
          </div>
          
          {/* Zoom Control */}
          <div className="zoom-control">
            <label htmlFor="zoom-slider">Zoom: {zoomLevel}%</label>
            <div className="zoom-slider">
              <span>20%</span>
              <input
                id="zoom-slider"
                type="range"
                min="20"
                max="150"
                step="5"
                value={zoomLevel}
                onChange={handleZoomChange}
              />
              <span>150%</span>
            </div>
          </div>
          
          <div className="tools">
            <button 
              className={`tool-button ${isTextMode ? 'active' : ''}`} 
              onClick={handleTextModeToggle}
            >
              <span role="img" aria-label="text">📝</span>
              Text
            </button>
            
            <div className="shapes-container">
              <h4>Shapes</h4>
              <div className="shapes-grid">
                {['circle', 'oval', 'square', 'rectangle'].map(shapeType => (
                  <button 
                    key={shapeType}
                    className={`shape-button ${selectedShape === shapeType ? 'active' : ''}`}
                    onClick={() => handleShapeSelect(shapeType)}
                  >
                    <div className={`shape-icon ${shapeType}`} style={{ borderColor: color }}></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas area */}
        <div 
          className="canvas-container" 
          onClick={handleCanvasClick}
          onMouseMove={handleCursorMove}
          style={{ 
            marginRight: '200px', 
            width: 'calc(100% - 200px)',
            height: 'calc(100vh - 80px)',
            overflow: 'hidden',
            position: 'relative',
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoomLevel / 100})`,
            transformOrigin: 'center center',
            cursor: isNavigationMode ? (isDrawing.current ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <div className="canvas-position-indicator">
            Position: {Math.round(canvasPosition.x)}, {Math.round(canvasPosition.y)} | Zoom: {zoomLevel}%
          </div>
          
          <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseMove={draw}
            onMouseLeave={stopDrawing}
          />
          
          {/* Render shapes */}
          {shapes.map(renderShape)}

          {/* Preview shape */}
          {previewShape && (
            <div
              className={`shape ${previewShape.type}`}
              style={{
                position: 'absolute',
                left: previewShape.x,
                top: previewShape.y,
                width: 100,
                height: 100,
                border: `2px solid ${color}`,
                backgroundColor: 'transparent',
                pointerEvents: 'none',
                transform: `translate(-50%, -50%)`,
              }}
            />
          )}

          {/* Render textboxes */}
          {textBoxes.map((textBox, index) => {
            const isSelected = activeTextBoxId === textBox.id;
            
            return (
              <div
                key={textBox.id}
                ref={el => {
                  if (!textBoxRefs.current[textBox.id]) {
                    textBoxRefs.current[textBox.id] = React.createRef();
                  }
                  textBoxRefs.current[textBox.id].current = el;
                }}
                className={`text-box ${isSelected ? 'selected' : ''}`}
                style={{
                  left: textBox.x,
                  top: textBox.y,
                  width: textBox.width,
                  height: textBox.height,
                  transform: ``,
                  zIndex: isSelected ? 100 : 1,
                  cursor: isSelected ? 'move' : 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTextBoxId(textBox.id);
                  setSelectedShapeId(null);
                }}
                onMouseDown={(e) => handleDragTextBoxStart(e, index)}
                onDoubleClick={() => handleTextDoubleClick(index)}
              >
                {textBox.isEditing ? (
                  <textarea
                    value={textBox.text}
                    onChange={(e) => handleTextChange(e, index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey === false) {
                        e.preventDefault();
                        handleTextEditComplete(index);
                      }
                    }}
                    onBlur={() => handleTextEditComplete(index)}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      resize: 'none',
                      border: 'none',
                      backgroundColor: 'transparent',
                      outline: 'none',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      overflow: 'hidden',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}
                  />
                ) : (
                  <div style={{ 
                    width: '100%', 
                    height: '100%', 
                    overflow: 'auto',
                    wordWrap: 'break-word', 
                    whiteSpace: 'pre-wrap'
                  }}>
                    {textBox.text}
                  </div>
                )}
                
                {isSelected && !textBox.isEditing && (
                <>
                  <div className="handle resize-handle top-left" onMouseDown={(e) => handleResizeTextBox(e, index, 'top-left')} />
                  <div className="handle resize-handle top-right" onMouseDown={(e) => handleResizeTextBox(e, index, 'top-right')} />
                  <div className="handle resize-handle bottom-left" onMouseDown={(e) => handleResizeTextBox(e, index, 'bottom-left')} />
                  <div className="handle resize-handle bottom-right" onMouseDown={(e) => handleResizeTextBox(e, index, 'bottom-right')} />
                </>
              )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Popup */}
      {showSavePopup && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog save-dialog">
            <h3>{currentWhiteboardId ? 'Update Whiteboard' : 'Save Whiteboard'}</h3>
            
            {!saveSuccess ? (
              <>
                {!currentWhiteboardId && (
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
                )}
                
                <div className="confirmation-buttons">
                  <button className="confirm-btn no-btn" onClick={handleCancelSave}>Cancel</button>
                  <button 
                    className="confirm-btn create-confirm-btn" 
                    onClick={handleSaveConfirm}
                    disabled={!currentWhiteboardId && !newWhiteboardName.trim()}
                  >
                    {currentWhiteboardId ? 'Update' : 'Save'}
                  </button>
                </div>
              </>
            ) : (
              <div className="success-message">
                <p>Whiteboard saved successfully!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Whiteboard;