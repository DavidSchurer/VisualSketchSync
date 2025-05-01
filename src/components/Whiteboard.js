import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { socket } from './socket';
import { auth, db } from '../firebase';
import Cursors from './Cursors';
import Users from './Users';
import Header from './Header';
import Notes from './Notes';
import './Whiteboard.css';
import { collection, addDoc, Timestamp, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';

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
  const [showNotes, setShowNotes] = useState(false);

  // Autosave States
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveMessage, setAutosaveMessage] = useState('');
  
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

  // Notes state
  const [notes, setNotes] = useState([]);

  // Get the whiteboard ID from the URL and load data - done separately from canvas init
  useEffect(() => {
    const urlParts = window.location.pathname.split('/');
    const id = urlParts[urlParts.length - 1];
    
    if (id && id !== 'whiteboard') {
      setCurrentWhiteboardId(id);
      loadWhiteboard(id);
    }
  }, []);
  
  // Function to load whiteboard data
  const loadWhiteboard = async (id) => {
    try {
      const whiteboardRef = doc(db, 'whiteboards', id);
      const whiteboardSnapshot = await getDoc(whiteboardRef);
      
      if (whiteboardSnapshot.exists()) {
        const data = whiteboardSnapshot.data();
        setWhiteboardName(data.name || '');
        setNewWhiteboardName(data.name || '');
        
        // First ensure canvas is at default state
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Reset position and zoom before loading data
          setCanvasPosition({ x: 0, y: 0 });
          setZoomLevel(100);
        }
        
        // Load all elements after canvas reset
        if (data.textBoxes) {
          setTextBoxes(data.textBoxes);
        }
        
        if (data.shapes) {
          setShapes(data.shapes);
        }
        
        // Load image data if it exists
        if (data.imageData && canvasRef.current) {
          const img = new Image();
          img.onload = () => {
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              // Only after everything is loaded, restore the position and zoom
              if (data.canvasPosition) {
                // Use requestAnimationFrame to ensure UI has updated
                requestAnimationFrame(() => {
                  setCanvasPosition(data.canvasPosition);
                });
              }
              
              if (data.zoomLevel) {
                // Use requestAnimationFrame to ensure UI has updated
                requestAnimationFrame(() => {
                  setZoomLevel(data.zoomLevel);
                });
              }
            }
          };
          img.src = data.imageData;
        } else {
          // If no image but we have position/zoom data, restore those
          if (data.canvasPosition) {
            requestAnimationFrame(() => {
              setCanvasPosition(data.canvasPosition);
            });
          }
          
          if (data.zoomLevel) {
            requestAnimationFrame(() => {
              setZoomLevel(data.zoomLevel);
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching whiteboard data:", error);
    }
  };

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
      // Get the whiteboard ID from the URL
      const urlParts = window.location.pathname.split('/');
      const whiteboardId = urlParts[urlParts.length - 1];
      
      // Join with email and whiteboard ID to track users per whiteboard
      socket.emit('join', { email: persistedEmail, whiteboardId });
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
    
    ctx.beginPath();
    ctx.moveTo(data.lastX, data.lastY);
    ctx.lineTo(data.x, data.y);
    
    // Set line styles
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (data.color === 'eraser') {
      // Use compositing to erase
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    } else {
      // Regular drawing
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = data.color;
    }
    
    // Draw the line
    ctx.stroke();
    
    // Reset composite operation to default after drawing
    ctx.globalCompositeOperation = 'source-over';
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
    // Adjust for differences in zoom and canvas position between users
    let adjustedCursor = { ...data };
    
    if (data.zoomLevel && data.canvasPosition) {
      // Calculate relative position adjustments if needed
      // This ensures cursor appears in relatively the same position for all users
      const zoomRatio = zoomLevel / data.zoomLevel;
      
      // For simplicity, we'll just use the raw cursor position for now
      // In a more advanced implementation, you could calculate the true position
      // based on the zoom differences and canvas positions
    }
    
    setRemoteCursors(prev => ({
      ...prev,
      [data.email]: adjustedCursor
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
    const userEmail = auth.currentUser?.email || localStorage.getItem('currentUserEmail');
    if (userEmail && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Get the whiteboard ID from the URL or state
      const whiteboardId = currentWhiteboardId || window.location.pathname.split('/').pop();
      
      socket.emit('cursorMove', {
        email: userEmail,
        x,
        y,
        whiteboardId,
        zoomLevel,
        canvasPosition
      });
    }
  };

  // Canvas functions
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Use window dimensions to determine canvas size
    const width = window.innerWidth - 200; // Account for sidebar
    const height = window.innerHeight - 60; // Account for header
    
    // Set canvas dimensions (both style and actual dimensions)
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width;
    canvas.height = height;
    
    // Set initial state
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Keep old content
    const oldContent = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Update canvas dimensions
    const width = window.innerWidth - 200;
    const height = window.innerHeight - 60;
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width;
    canvas.height = height;
    
    // Restore content
    ctx.putImageData(oldContent, 0, 0);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Adjust for current canvas transformation (zoom and pan)
    const zoomFactor = zoomLevel / 100;
    
    // More precise calculation without any offsets to align exactly with cursor
    const x = (e.clientX - rect.left) / zoomFactor - canvasPosition.x / zoomFactor;
    const y = (e.clientY - rect.top) / zoomFactor - canvasPosition.y / zoomFactor;
    
    return { x, y };
  };

  // Drawing functions
  const startDrawing = (e) => {
    if (isTextMode) return;
    
    isDrawing.current = true;
    
    if (isNavigationMode) {
      // When in navigation mode, store the initial mouse position
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      return;
    }
    
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
      
      // Update the last position
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      return;
    }
    
    if (isTextMode) return;
    
    const { x, y } = getMousePos(e);
    const ctx = canvasRef.current.getContext('2d');
    
    // Begin the path for drawing
    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x, y);
    
    // Set line styles
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (isEraserActive) {
      // Use compositing to erase
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    } else {
      // Regular drawing
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    
    // Draw the line
    ctx.stroke();
    
    // Reset composite operation to default after drawing
    ctx.globalCompositeOperation = 'source-over';
    
    // Get the whiteboard ID from the URL or state
    const whiteboardId = currentWhiteboardId || window.location.pathname.split('/').pop();
    
    // Emit the draw event with whiteboardId
    socket.emit('draw', {
      lastX: lastX.current,
      lastY: lastY.current,
      x,
      y,
      color: isEraserActive ? 'eraser' : color,
      size,
      scale: zoomLevel / 100,
      whiteboardId
    });

    // Trigger autosave
    autosave();
    
    // Update last position
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
    const { x, y } = getMousePos(e);
    
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
    
    // Get the whiteboard ID from the URL or state
    const whiteboardId = currentWhiteboardId || window.location.pathname.split('/').pop();
    
    socket.emit('addTextBox', {
      ...newTextBox,
      whiteboardId
    });

    // Trigger autosave
    autosave();
  };

  const addNewShape = (e) => {
    const { x, y } = getMousePos(e);

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

    // Trigger autosave
    autosave();
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
    if (isNavigationMode) return;
    
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes.forEach((box, i) => {
      box.isSelected = i === index;
    });
    
    setTextBoxes(updatedTextBoxes);
    setActiveTextBoxId(index);
    
    // Get the whiteboard ID from the URL or state
    const whiteboardId = currentWhiteboardId || window.location.pathname.split('/').pop();
    
    // Emit the updateTextBox event with whiteboardId
    socket.emit('updateTextBox', { 
      ...updatedTextBoxes[index], 
      index, 
      whiteboardId 
    });
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
    try {
      // First capture the current state of the canvas
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      
      const imageData = currentCanvas.toDataURL();
      
      // Store the exact current state of all components
      const drawingData = {
        imageData: imageData,
        textBoxes: textBoxes,
        shapes: shapes,
        canvasPosition: canvasPosition,
        zoomLevel: zoomLevel,
        timestamp: Timestamp.now()
      };
      
      // If we're updating an existing whiteboard
      if (currentWhiteboardId) {
        const whiteboardRef = doc(db, 'whiteboards', currentWhiteboardId);
        
        // Update name if it was changed
        if (newWhiteboardName && newWhiteboardName.trim() !== whiteboardName) {
          drawingData.name = newWhiteboardName.trim();
          setWhiteboardName(newWhiteboardName.trim());
        }
        
        await updateDoc(whiteboardRef, drawingData);
        
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setShowSavePopup(false);
        }, 2000);
      } else {
        // Creating a new whiteboard
        if (newWhiteboardName.trim()) {
          drawingData.name = newWhiteboardName.trim();
          setWhiteboardName(newWhiteboardName.trim());
          
          drawingData.createdBy = auth.currentUser.email;

          const docRef = await addDoc(collection(db, 'whiteboards'), drawingData);
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

  // Autosave function
  const autosave = async () => {
    setIsAutosaving(true);
    setAutosaveMessage('Autosaving...');

    try {
      // Capture current state of canvas
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;

      const imageData = currentCanvas.toDataURL();

      // Store the current state of all components
      const drawingData = {
        imageData: imageData,
        textBoxes: textBoxes,
        shapes: shapes,
        canvasPosition: canvasPosition,
        zoomLevel: zoomLevel,
        timestamp: Timestamp.now()
      };

      // Update the existing whiteborad
      if (currentWhiteboardId) {
          const whiteboardRef = doc(db, 'whiteboards', currentWhiteboardId);
          await updateDoc(whiteboardRef, drawingData);
      }

      setAutosaveMessage('Autosave complete! ✅');
    } catch (error) {
      console.error("Error during autosave:", error);
      setAutosaveMessage('Autosave failed! ❌');
    } finally {
      // Reset autosave status after a delay
      setTimeout(() => {
        setIsAutosaving(false);
        setAutosaveMessage('');
      }, 2000); // Show message for 2 seconds
    }
  };

  const toggleNotes = () => {
    setShowNotes(!showNotes);
  };

  // Fetch notes from Firestore
  useEffect(() => {
    if (currentWhiteboardId) {
      const notesRef = collection(db, 'whiteboards', currentWhiteboardId, 'notes');
      const unsubscribe = onSnapshot(notesRef, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotes(notesData);
      });

      return () => unsubscribe(); // Cleanup subscription on unmount
    }
  }, [currentWhiteboardId]);

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
          
          <div 
            className={`eraser-tool ${isEraserActive ? 'active' : ''}`} 
            onClick={toggleEraser}
          >
            <span role="img" aria-label="eraser">🧽</span>
            <span>Eraser {isEraserActive ? '(Active)' : ''}</span>
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

            <button 
              className="tool-button" 
              onClick={toggleNotes}
            >
              <span role="img" aria-label="notes">📝</span>
              Notes
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

        {/* Canvas area - update styling for better transform handling */}
        <div 
          className="canvas-container" 
          onClick={handleCanvasClick}
          onMouseMove={handleCursorMove}
          style={{ 
            marginRight: '200px',
            width: 'calc(100% - 200px)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div 
            className="canvas-transform-container"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoomLevel / 100})`,
              transformOrigin: '0 0',
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
                    position: 'absolute',
                    left: textBox.x,
                    top: textBox.y,
                    width: textBox.width,
                    height: textBox.height,
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

      {/* Autosave Notification */}
      {isAutosaving && (
        <div className="autosave-notification">
          <div className="loading-icon">🔄</div>
          <span>{autosaveMessage}</span>
        </div>
      )}

      {/* Render Notes UI if showNotes is true */}
      {showNotes && (
        <Notes onClose={() => setShowNotes(false)} whiteboardId={currentWhiteboardId} />
      )}

      {/* Render notes */}
      <div className="notes-container">
        {notes.map(note => (
          <div key={note.id} style={{ fontSize: note.fontSize, fontFamily: note.fontFamily }}>
            {note.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Whiteboard;