import React, { useState, useRef, useEffect } from 'react';
import { socket } from './socket';
import { auth } from '../firebase';
import Cursors from './Cursors';
import Users from './Users';
import './Whiteboard.css';

const Whiteboard = () => {
  const [color, setColor] = useState('black');
  const [size, setSize] = useState(5);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);
  const [currentText, setCurrentText] = useState('Textbox');
  const [isMoving, setIsMoving] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [activeTextBoxId, setActiveTextBoxId] = useState(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [users, setUsers] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const canvasRect = useRef(null);
  const dragRequestRef = useRef(null);

useEffect(() => {
  console.log('Socket connected:', socket.connected);
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });
}, []);

  useEffect(() => {
    socket.connect();

    const userEmail = auth.currentUser?.email;
    socket.emit('join', userEmail);

  // Update the socket.on('draw') handler
  socket.on('draw', (data) => {
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
  });

    socket.on('userList', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    return () => {
      socket.off('draw');
      socket.off('userList');
      socket.disconnect();
    };
  }, []);



  const handleRGBColorChange = (e) => {
    setColor(e.target.value);
  };

  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };

  const toggleEraser = () => {
    setIsEraserActive(!isEraserActive);
  };

// Update getMousePos function
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

  // Start drawing for the whiteboard
  const startDrawing = (e) => {
    if (isTextMode) return;
    isDrawing.current = true;
    const { x, y } = getMousePos(e);
    lastX.current = x + 4; // Shift drawing 4px to the right
    lastY.current = y;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  useEffect(() => {
    socket.connect();
    const userEmail = auth.currentUser?.email;

    socket.emit('join', userEmail);

    // Cursor move event listener
    const handleCursorMove = (e) => {
      const { x, y } = getMousePos(e);
      socket.emit('cursorMove', {
        x: e.clientX,
        y: e.clientY,
        email: userEmail,
        color
      });
    };

    window.addEventListener('mousemove', handleCursorMove);

    socket.on('remoteCursor', (data) => {
      setRemoteCursors(prev => ({
        ...prev,
        [data.email]: data
      }));
    });

    socket.on('userDisconnected', (email) => {
      setRemoteCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[email];
        return newCursors;
      });
    });

    return () => {
      window.removeEventListener('mousemove', handleCursorMove);
      socket.off('remoteCursor');
      socket.off('userDisconnected');
      socket.disconnect();
    };
  }, []);

// Optimized draw function
const draw = (e) => {
  if (!isDrawing.current || isTextMode) return;

  requestAnimationFrame(() => {
    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
  
    // Check boundaries
    if (x > (canvas.width / scale) - 200) return;
  
    // Smoother drawing
    ctx.beginPath();
    ctx.moveTo(lastX.current / scale, lastY.current / scale);
    ctx.lineTo(x / scale, y / scale);
    
    ctx.strokeStyle = isEraserActive ? 'white' : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  
    // Emit normalized coordinates
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
  });
};

  const handleColorChange = (newColor) => {
    setColor(newColor);
    setIsEraserActive(false);
  };

  const handleSizeChange = (e) => {
    setSize(e.target.value);
  };

  const handleTextModeToggle = () => {
    setIsTextMode(!isTextMode);
  };

  const addTextBox = (e) => {
    if (!isTextMode) return;

    const newTextBox = {
      id: Date.now(),
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
      width: 200,
      height: 50,
      text: currentText,
      rotation: 0,
      isEditing: false,
      isSelected: true,
      isPlaced: false,
    };
    setTextBoxes((prevTextBoxes) => [...prevTextBoxes, newTextBox]);
    setIsTextMode(false);

    socket.emit('addTextBox', newTextBox);
  };

  const handleTextBoxClick = (index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes.forEach((box) => (box.isSelected = false)); // Deselect all textboxes
    updatedTextBoxes[index].isSelected = true;
    setTextBoxes(updatedTextBoxes);
    setActiveTextBoxId(updatedTextBoxes[index].id);
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

  const handleTextBoxDragStart = (index, e) => {
    const lastTextBox = textBoxes[index];
    setIsMoving(true);
    // Store initial offset to ensure drag follows cursor correctly
    cursorRef.current = {
      x: e.clientX - lastTextBox.x,
      y: e.clientY - lastTextBox.y,
    };
  };

  const handleTextBoxDragEnd = (index, e) => {
    setIsMoving(false);
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index].isPlaced = true; // Text box is placed
    setTextBoxes(updatedTextBoxes);
    cancelAnimationFrame(dragRequestRef.current);
  };

  const handleTextBoxDrag = (index, e) => {
    if (isMoving) {
      const updatedTextBoxes = [...textBoxes];
      updatedTextBoxes[index] = {
        ...updatedTextBoxes[index],
        x: e.clientX - cursorRef.current.x,
        y: e.clientY - cursorRef.current.y,
      };
      setTextBoxes(updatedTextBoxes);
      dragRequestRef.current = requestAnimationFrame(() => handleTextBoxDrag(index, e));
    }
  };

  const handleResizeStart = (index, e) => {
    setIsResizing(true);
    cursorRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: textBoxes[index].width,
        height: textBoxes[index].height,
    };
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    cancelAnimationFrame(dragRequestRef.current);
  };

  const handleResize = (index, e) => {
    if (isResizing) {
        const updatedTextBoxes = [...textBoxes];
        const deltaX = e.clientX - cursorRef.current.x;
        const deltaY = e.clientY - cursorRef.current.y;
        updatedTextBoxes[index] = {
            ...updatedTextBoxes[index],
            width: cursorRef.current.width + deltaX,
            height: cursorRef.current.height + deltaY,
        };
        setTextBoxes(updatedTextBoxes);
        dragRequestRef.current = requestAnimationFrame(() => handleResize(index, e));
    }
  };

  const handleRotateStart = (index, e) => {
    setIsRotating(true);
    const textBox = textBoxes[index];
    const rect = e.target.getBoundingClientRect();
    cursorRef.current = {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        intialAngle: Math.atan2(e.clientY - cursorRef.current.centerY, e.clientX - cursorRef.current.centerX),
    };
  };

  const handleRotateEnd = () => {
    setIsRotating(false);
    cancelAnimationFrame(dragRequestRef.current);
  };

  const handleRotate = (index, e) => {
    if (isRotating) {
        const updatedTextBoxes = [...textBoxes];
        const angle = Math.atan2(e.clientY - cursorRef.current.centerY, e.clientX - cursorRef.current.centerX);
        const deltaAngle = angle - cursorRef.current.initialAngle;
        updatedTextBoxes[index] = {
            ...updatedTextBoxes[index],
            rotation: (updatedTextBoxes[index].rotation + deltaAngle * (180 / Math.PI)) % 360,
        };
        setTextBoxes(updatedTextBoxes);
        dragRequestRef.current = requestAnimationFrame(() => handleRotate(index , e));
    }
  };

  useEffect(() => {
    socket.on('addTextBox', (textBox) => {
      setTextBoxes((previousTextBoxes) => [...previousTextBoxes, textBox]);
    });

    socket.on('updateTextBox', (updatedTextBox) => {
      setTextBoxes(prev => prev.map(tb =>
        tb.id === updatedTextBox.id ? updatedTextBox : tb
      ));
    });
  }, []);

// Replace the useEffect for canvas initialization
useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  // Handle high-DPI displays
  const scale = window.devicePixelRatio || 1;
  const width = window.innerWidth - 200; // Account for sidebar
  const height = window.innerHeight;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;

  const updateCanvasSize = () => {
    const newWidth = window.innerWidth - 200;
    canvas.style.width = `${newWidth}px`;
    canvas.width = newWidth * scale;
    canvas.height = window.innerHeight * scale;
    ctx.scale(scale, scale);
  };

  window.addEventListener('resize', updateCanvasSize);
  return () => window.removeEventListener('resize', updateCanvasSize);
}, []);

  return (
    <div className="whiteboard-container">
      <Cursors cursors={remoteCursors} />
      <Users users={users} />
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
            onChange={handleRGBColorChange}
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
          <button onClick={handleTextModeToggle}>Textbox</button>
        </div>
      </div>

      <div className="canvas-container" onClick={addTextBox}
         style={{ 
          marginRight: '200px', 
          width: 'calc(100% - 200px)'
        }}
      >
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={stopDrawing}
        />

        {textBoxes.map((textBox, index) => (
          <div
            key={textBox.id}
            className={`text-box ${textBox.isSelected ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              left: textBox.x,
              top: textBox.y,
              width: textBox.width,
              height: textBox.height,
              transform: `rotate(${textBox.rotation}deg)`,
              backgroundColor: 'transparent',
              color: 'black',
              textAlign: 'center',
              lineHeight: `${textBox.height}px`,
              cursor: 'move',
              border: textBox.isSelected ? '2px dotted black' : 'none',
            }}
            onClick={(e) => handleTextBoxClick(index, e)}
            onMouseDown={(e) => handleTextBoxDragStart(index, e)}
            onMouseMove={(e) => handleTextBoxDrag(index, e)}
            onMouseUp={(e) => handleTextBoxDragEnd(index, e)}
          >
            {textBox.isSelected ? (
            <>
                <input
                    type="text"
                    value={textBox.text}
                    onChange={(e) => handleTextChangeInBox(e, index)}
                    autoFocus
                    style = {{ backgroundColor: 'transparent', border: 'none', outline: 'none'}}
                />
                <div
                    className="rotate-icon"
                    onMouseDown={(e) => handleRotateStart(index, e)}
                    onMouseMove={(e) => handleRotate(index, e)}
                    onMouseUp={handleRotateEnd}
                >
                    ↻
                </div>
                <div
                    className="resize-handle"
                    onMouseDown={(e) => handleResizeStart(index, e)}
                    onMouseMove={(e) => handleResize(index, e)}
                    onMouseUp={handleResizeEnd}
                />
              </>
            ) : (
              textBox.text
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Whiteboard;