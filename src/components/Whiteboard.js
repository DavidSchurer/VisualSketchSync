import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { socket } from './socket';
import { auth } from '../firebase';
import Cursors from './Cursors';
import Users from './Users';
import Header from './Header';
import './Whiteboard.css';

const Whiteboard = () => {
  // Core state
  const [color, setColor] = useState('black');
  const [size, setSize] = useState(5);
  const [isTextMode, setIsTextMode] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [isUsersExpanded, setIsUsersExpanded] = useState(true); // State for users section visibility
  
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

  // Socket connection
  useEffect(() => {
    socket.connect();
    const userEmail = auth.currentUser?.email;
    socket.emit('join', userEmail);

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
    const userEmail = auth.currentUser?.email;
    socket.emit('cursorMove', {
      x: e.clientX,
      y: e.clientY,
      email: userEmail,
      color
    });
  };

  // Canvas functions
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const scale = window.devicePixelRatio || 1;
    const width = window.innerWidth - 200;
    const height = window.innerHeight;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * scale;
    canvas.height = height * scale;
    
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
  };

  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
    const width = window.innerWidth - 200;
    
    canvas.style.width = `${width}px`;
    canvas.width = width * scale;
    canvas.height = window.innerHeight * scale;
    ctx.scale(scale, scale);
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
    isDrawing.current = true;
    const { x, y } = getMousePos(e);
    lastX.current = x + 4;
    lastY.current = y;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const draw = (e) => {
    if (!isDrawing.current || isTextMode) return;

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

  // Shape and text handlers
  const handleTextModeToggle = () => {
    setIsTextMode(!isTextMode);
    setSelectedShape(null);
  };

  const handleShapeSelect = (shapeType) => {
    setSelectedShape(shapeType);
    setIsTextMode(false);
  };

  const handleCanvasClick = (e) => {
    if (isTextMode) {
      addNewTextBox(e);
    } else if (selectedShape) {
      addNewShape(e);
    } else {
      // Deselect everything
      setSelectedShapeId(null);
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
      rotation: 0,
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
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      switch(direction) {
        case 'bottom-right':
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = Math.max(30, startHeight + deltaY);
          break;
        default:
          break;
      }
      
      const updatedTextBoxes = [...textBoxes];
      updatedTextBoxes[index] = {
        ...updatedTextBoxes[index],
        width: newWidth,
        height: newHeight
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
  
  // Rotate handlers
  const handleRotateTextBox = (e, index) => {
    e.stopPropagation();
    e.preventDefault();
    
    const textBox = textBoxes[index];
    const textBoxElement = textBoxRefs.current[textBox.id]?.current;
    
    if (!textBoxElement) return;
    
    const rect = textBoxElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startRotation = textBox.rotation || 0;
    
    const handleMouseMove = (moveEvent) => {
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
      const newRotation = startRotation + angleDiff;
      
      const updatedTextBoxes = [...textBoxes];
      updatedTextBoxes[index] = {
        ...updatedTextBoxes[index],
        rotation: newRotation
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
              <div className="handle rotate-handle" />
            </>
          )}
        </div>
      </Draggable>
    );
  };

  const renderTextBox = (textBox, index) => {
    // Create ref if it doesn't exist
    if (!textBoxRefs.current[textBox.id]) {
      textBoxRefs.current[textBox.id] = React.createRef();
    }
    
    const isSelected = textBox.isSelected;
    
    return (
      <Draggable
        key={textBox.id}
        nodeRef={textBoxRefs.current[textBox.id]}
        position={{ x: textBox.x, y: textBox.y }}
        bounds=".canvas-container"
        disabled={textBox.isEditing}
        onStart={(e) => {
          if (e.target.classList.contains('handle')) {
            return false;
          }
          handleTextBoxClick(index);
        }}
        onStop={(e, data) => {
          setTextBoxes(textBoxes.map((box, i) => 
            i === index ? { ...box, x: data.x, y: data.y } : box
          ));
          
          // Emit update to other users
          socket.emit('updateTextBox', {
            ...textBoxes[index],
            x: data.x,
            y: data.y
          });
        }}
      >
        <div
          ref={textBoxRefs.current[textBox.id]}
          className={`text-box ${isSelected ? 'selected' : ''}`}
          style={{
            width: textBox.width,
            height: textBox.height,
            transform: `rotate(${textBox.rotation || 0}deg)`
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleTextBoxClick(index);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setTextBoxes(textBoxes.map((box, i) => ({
              ...box,
              isEditing: i === index,
              isSelected: i === index
            })));
          }}
        >
          {textBox.isEditing ? (
            <input
              type="text"
              value={textBox.text}
              onChange={(e) => handleTextChangeInBox(e, index)}
              onBlur={() => setTextBoxes(textBoxes.map((box, i) => ({
                ...box,
                isEditing: false
              })))}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span>{textBox.text}</span>
          )}
          
          {isSelected && (
            <>
              <div 
                className="handle text-resize-handle" 
                onMouseDown={(e) => handleResizeTextBox(e, index, 'bottom-right')}
              />
              <div 
                className="handle text-rotate-handle" 
                onMouseDown={(e) => handleRotateTextBox(e, index)}
              />
            </>
          )}
        </div>
      </Draggable>
    );
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
          style={{ marginRight: '200px', width: 'calc(100% - 200px)' }}
        >
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
          {textBoxes.map(renderTextBox)}
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;