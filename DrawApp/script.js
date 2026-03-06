const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const toolSelect = document.getElementById('toolSelect');
const brushSize = document.getElementById('brushSize');
const clearButton = document.getElementById('clearCanvas');
const saveButton = document.getElementById('saveDrawing');
const clearGalleryButton = document.getElementById('clearGallery');
const gallery = document.getElementById('gallery');
const canvasWidthInput = document.getElementById('canvasWidth');
const canvasHeightInput = document.getElementById('canvasHeight');
const resizeButton = document.getElementById('resizeCanvas');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let startX = 0;
let startY = 0;
let snapshot;

// Set initial canvas background to white
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

toolSelect.addEventListener('change', changeTool);
brushSize.addEventListener('input', changeBrushSize);
colorPicker.addEventListener('change', changeColor);
clearButton.addEventListener('click', clearCanvas);
saveButton.addEventListener('click', saveDrawing);
clearGalleryButton.addEventListener('click', clearGallery);
resizeButton.addEventListener('click', resizeCanvas);

// Load gallery on page load
loadGallery();
updateCanvasInputs();

function updateCanvasInputs() {
    canvasWidthInput.value = canvas.width;
    canvasHeightInput.value = canvas.height;
}

function startDrawing(e) {
    if (toolSelect.value === 'fill') {
        fillArea(e.offsetX, e.offsetY, colorPicker.value);
    } else if (toolSelect.value === 'rectangle') {
        isDrawing = true;
        startX = e.offsetX;
        startY = e.offsetY;
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }
}

function draw(e) {
    if (!isDrawing) return;
    if (toolSelect.value === 'rectangle') {
        ctx.putImageData(snapshot, 0, 0);
        const width = e.offsetX - startX;
        const height = e.offsetY - startY;
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = brushSize.value;
        ctx.strokeRect(startX, startY, width, height);
    } else {
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = toolSelect.value === 'eraser' ? 'white' : colorPicker.value;
        ctx.lineWidth = brushSize.value;
        ctx.lineCap = 'round';
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }
}

function stopDrawing() {
    isDrawing = false;
}

function changeTool() {
    // Tool change is handled in draw function
}

function changeBrushSize() {
    // Size is used in draw function
}

function changeColor() {
    // Color is used in draw function
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function saveDrawing() {
    const dataURL = canvas.toDataURL('image/png');
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    savedDrawings.push(dataURL);
    localStorage.setItem('paintDrawings', JSON.stringify(savedDrawings));
    loadGallery();
}

function loadGallery() {
    gallery.innerHTML = '';
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    savedDrawings.forEach((drawing, index) => {
        const container = document.createElement('div');
        container.classList.add('gallery-item-container');
        
        const img = document.createElement('img');
        img.src = drawing;
        img.classList.add('gallery-item');
        img.addEventListener('click', () => loadDrawing(drawing));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => deleteDrawing(index));
        
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download';
        downloadBtn.classList.add('download-btn');
        downloadBtn.addEventListener('click', () => downloadDrawing(drawing, index));
        
        container.appendChild(img);
        container.appendChild(deleteBtn);
        container.appendChild(downloadBtn);
        gallery.appendChild(container);
    });
}

function loadDrawing(dataURL) {
    const img = new Image();
    img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataURL;
}

function deleteDrawing(index) {
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    savedDrawings.splice(index, 1);
    localStorage.setItem('paintDrawings', JSON.stringify(savedDrawings));
    loadGallery();
}

function downloadDrawing(dataURL, index) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `drawing_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function fillArea(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const startPos = (y * canvas.width + x) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    const fillR = parseInt(fillColor.slice(1, 3), 16);
    const fillG = parseInt(fillColor.slice(3, 5), 16);
    const fillB = parseInt(fillColor.slice(5, 7), 16);
    const fillA = 255;

    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

    const stack = [[x, y]];
    while (stack.length) {
        const [cx, cy] = stack.pop();
        const pos = (cy * canvas.width + cx) * 4;
        if (cx < 0 || cx >= canvas.width || cy < 0 || cy >= canvas.height) continue;
        if (data[pos] !== startR || data[pos + 1] !== startG || data[pos + 2] !== startB || data[pos + 3] !== startA) continue;
        data[pos] = fillR;
        data[pos + 1] = fillG;
        data[pos + 2] = fillB;
        data[pos + 3] = fillA;
        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
}

function clearGallery() {
    localStorage.removeItem('paintDrawings');
    loadGallery();
}

function resizeCanvas() {
    const newWidth = parseInt(canvasWidthInput.value);
    const newHeight = parseInt(canvasHeightInput.value);
    if (newWidth >= 100 && newHeight >= 100 && newWidth <= 2000 && newHeight <= 2000) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        updateCanvasInputs();
    } else {
        alert('Please enter valid dimensions (100-2000 pixels).');
    }
}

function loadGallery() {
    gallery.innerHTML = '';
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    
    savedDrawings.forEach((drawing, index) => {
        const container = document.createElement('div');
        container.classList.add('gallery-item-container');

        // Drawing Title
        const title = document.createElement('div');
        title.textContent = drawing.name || `Drawing ${index + 1}`;
        title.classList.add('drawing-title');

        // Drawing Price
        const priceDisplay = document.createElement('div');
        priceDisplay.textContent = drawing.price ? `${drawing.currency || '$'}${drawing.price}` : '';
        priceDisplay.classList.add('drawing-price');

        // Drawing Image
        const img = document.createElement('img');
        img.src = drawing.dataURL;
        img.classList.add('gallery-item');
        img.addEventListener('click', () => loadDrawing(drawing.dataURL));

        // Buttons
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => deleteDrawing(index));

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download';
        downloadBtn.classList.add('download-btn');
        downloadBtn.addEventListener('click', () => downloadDrawing(drawing.dataURL, index));

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.classList.add('rename-btn');
        renameBtn.addEventListener('click', () => renameDrawing(index));

        const priceBtn = document.createElement('button');
        priceBtn.textContent = 'Set Price';
        priceBtn.classList.add('price-btn');
        priceBtn.addEventListener('click', () => setPrice(index));

        // Append elements
        container.appendChild(title);
        container.appendChild(priceDisplay);
        container.appendChild(img);
        container.appendChild(deleteBtn);
        container.appendChild(downloadBtn);
        container.appendChild(renameBtn);
        container.appendChild(priceBtn);

        gallery.appendChild(container);
    });
}

// Save drawing as object with name and price
function saveDrawing() {
    const dataURL = canvas.toDataURL('image/png');
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    savedDrawings.push({
        dataURL,
        name: `Drawing ${savedDrawings.length + 1}`,
        price: null,
        currency: '$'
    });
    localStorage.setItem('paintDrawings', JSON.stringify(savedDrawings));
    loadGallery();
}

function renameDrawing(index) {
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    const newName = prompt('Enter new name for this drawing:', savedDrawings[index].name);
    if (newName) {
        savedDrawings[index].name = newName;
        localStorage.setItem('paintDrawings', JSON.stringify(savedDrawings));
        loadGallery();
    }
}

function setPrice(index) {
    const savedDrawings = JSON.parse(localStorage.getItem('paintDrawings') || '[]');
    const newPrice = prompt('Enter price for this drawing (numbers only):', savedDrawings[index].price || '');
    const currency = prompt('Enter currency symbol (e.g., $, €, £):', savedDrawings[index].currency || '$');
    if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
        savedDrawings[index].price = parseFloat(newPrice).toFixed(2);
        savedDrawings[index].currency = currency || '$';
        localStorage.setItem('paintDrawings', JSON.stringify(savedDrawings));
        loadGallery();
    }
}