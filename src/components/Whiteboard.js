import React, { useState, useRef, useEffect } from 'react';
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
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const canvasRect = useRef(null);
  const dragRequestRef = useRef(null);

  const handleRGBColorChange = (e) => {
    setColor(e.target.value);
  };

  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };

  const toggleEraser = () => {
    setIsEraserActive(!isEraserActive);
  };

  // Function to get accurate mouse coordinates relative to the canvas
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; // Adjust for canvas scaling
    const scaleY = canvas.height / rect.height; // Adjust for canvas scaling
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
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

  const draw = (e) => {
    if (!isDrawing.current || isTextMode) return;
    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = isEraserActive ? 'white' : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x + 4, y); // Shift drawing 4px to the right
    ctx.stroke();

    lastX.current = x + 4; // Shift drawing 4px to the right
    lastY.current = y;
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
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvasRect.current = canvas.getBoundingClientRect();

    const updateCanvasRect = () => {
      canvasRect.current = canvas.getBoundingClientRect();
    };

    window.addEventListener('resize', updateCanvasRect);
    window.addEventListener('scroll', updateCanvasRect);

    return () => {
      window.removeEventListener('resize', updateCanvasRect);
      window.removeEventListener('scroll', updateCanvasRect);
    };
  }, []);

  return (
    <div className="whiteboard-container">
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

      <div className="canvas-container" onClick={addTextBox}>
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