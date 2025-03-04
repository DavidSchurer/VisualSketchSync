import React, { useState, useRef, useEffect } from 'react';
import './Whiteboard.css';

const Whiteboard = () => {
  const [color, setColor] = useState('black');
  const [size, setSize] = useState(4);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);
  const [currentText, setCurrentText] = useState('Textbox');
  const [activeTextBoxId, setActiveTextBoxId] = useState(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const canvasRect = useRef(null);

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
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x + 4, y); // Shift drawing 4px to the right
    ctx.stroke();

    lastX.current = x + 4; // Shift drawing 4px to the right
    lastY.current = y;
  };

  const handleColorChange = (newColor) => {
    setColor(newColor);
  };

  const handleSizeChange = (e) => {
    setSize(e.target.value);
  };

  const handleTextModeToggle = () => {
    setIsTextMode(!isTextMode);
  };

  const addTextBox = (e) => {
    if (!isTextMode) return;
    const { x, y } = getMousePos(e);
    const newTextBox = {
      id: Date.now(),
      x: x + 4, // Shift textbox 4px to the right
      y,
      width: 200,
      height: 40,
      text: currentText,
      rotation: 0,
      isEditing: false,
    };
    setTextBoxes((prevTextBoxes) => [...prevTextBoxes, newTextBox]);
    setIsTextMode(false);
  };

  const handleTextChange = (e) => {
    setCurrentText(e.target.value);
  };

  const handleTextBoxDoubleClick = (index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = { ...updatedTextBoxes[index], isEditing: true };
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

  const handleTextBoxDrag = (index, e) => {
    const { x, y } = getMousePos(e);
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = {
      ...updatedTextBoxes[index],
      x: x + 4, // Shift textbox 4px to the right
      y,
    };
    setTextBoxes(updatedTextBoxes);
  };

  const handleTextRotate = (index) => {
    const updatedTextBoxes = [...textBoxes];
    updatedTextBoxes[index] = {
      ...updatedTextBoxes[index],
      rotation: updatedTextBoxes[index].rotation + 14,
    };
    setTextBoxes(updatedTextBoxes);
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
      <div className="toolbar">
        <div className="colors">
          {['black', 'grey', 'blue', 'red', 'green'].map((colorOption) => (
            <div
              key={colorOption}
              className="color-option"
              style={{ backgroundColor: colorOption }}
              onClick={() => handleColorChange(colorOption)}
            />
          ))}
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
            className="text-box"
            style={{
              position: 'absolute',
              left: textBox.x,
              top: textBox.y,
              width: textBox.width,
              height: textBox.height,
              transform: `rotate(${textBox.rotation}deg)`,
              backgroundColor: 'black',
              color: 'white',
              textAlign: 'center',
              lineHeight: `${textBox.height}px`,
              cursor: 'move',
            }}
            onMouseDown={(e) => handleTextBoxDrag(index, e)}
            onDoubleClick={() => handleTextBoxDoubleClick(index)}
          >
            {textBox.isEditing ? (
              <input
                type="text"
                value={textBox.text}
                onChange={(e) => handleTextChangeInBox(e, index)}
                autoFocus
              />
            ) : (
              textBox.text
            )}
            <button
              className="rotate-btn"
              onClick={() => handleTextRotate(index)}
            >
              ↻
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Whiteboard;