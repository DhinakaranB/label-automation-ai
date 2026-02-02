let newTemplateFile = null;
let oldTemplateFile = null;
let outputFilename = null;
let comparisonData = null;
let oldTemplateText = '';
let newTemplateText = '';
let currentPage = 1;
let totalPages = 1;
let oldPdfDoc = null;
let newPdfDoc = null;
let currentZoom = 1.5;
let isProcessing = false;

document.addEventListener('DOMContentLoaded', function() {
    const newTemplateInput = document.getElementById('newTemplate');
    const oldTemplateInput = document.getElementById('oldTemplate');
    const compareBtn = document.getElementById('compareBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadFormat = document.getElementById('downloadFormat');
    
    // Set PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    newTemplateInput.addEventListener('change', function(e) {
        handleFileSelect(e, 'new');
    });
    
    oldTemplateInput.addEventListener('change', function(e) {
        handleFileSelect(e, 'old');
    });
    
    compareBtn.addEventListener('click', compareFiles);
    downloadBtn.addEventListener('click', downloadFile);
    downloadFormat.addEventListener('change', function() {
        downloadBtn.disabled = !this.value;
    });
});

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    const area = document.getElementById(type === 'new' ? 'newTemplateArea' : 'oldTemplateArea');
    const info = document.getElementById(type === 'new' ? 'newFileInfo' : 'oldFileInfo');
    
    if (file && file.type === 'application/pdf') {
        if (type === 'new') {
            newTemplateFile = file;
        } else {
            oldTemplateFile = file;
        }
        
        area.classList.add('active');
        info.style.display = 'block';
        info.innerHTML = `<strong>${file.name}</strong><br>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        
        checkFilesReady();
    } else {
        alert('Please select a PDF file');
        event.target.value = '';
    }
}

function checkFilesReady() {
    const compareBtn = document.getElementById('compareBtn');
    if (newTemplateFile && oldTemplateFile) {
        compareBtn.disabled = false;
    }
}

function compareFiles() {
    if (!newTemplateFile || !oldTemplateFile || isProcessing) {
        return;
    }
    
    isProcessing = true;
    
    const formData = new FormData();
    formData.append('new_template', newTemplateFile);
    formData.append('old_template', oldTemplateFile);
    
    showLoading(true);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        isProcessing = false;
        
        if (data.success) {
            displayResults(data);
            outputFilename = data.output_file;
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        showLoading(false);
        isProcessing = false;
        alert('Error processing files: ' + error.message);
    });
}

function displayResults(data) {
    const resultSection = document.getElementById('resultSection');
    const downloadOptions = document.getElementById('downloadOptions');
    
    // Reset state for consistent rendering
    resetPdfState();
    
    comparisonData = data.comparison;
    oldTemplateText = data.old_text || '';
    newTemplateText = data.new_text || '';
    
    // Small delay to ensure canvas recreation is complete
    setTimeout(() => {
        loadPDFs();
    }, 100);
    
    resultSection.style.display = 'block';
    downloadOptions.style.display = 'flex';
}

function downloadFile() {
    const format = document.getElementById('downloadFormat').value;
    if (outputFilename && format) {
        window.location.href = `/download/${outputFilename}?format=${format}`;
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'flex' : 'none';
}

function resetPdfState() {
    currentPage = 1;
    totalPages = 1;
    oldPdfDoc = null;
    newPdfDoc = null;
    currentZoom = 1.5;
    
    const newCanvas = document.getElementById('newPdfCanvas');
    const oldCanvas = document.getElementById('oldPdfCanvas');
    
    if (newCanvas) {
        const ctx = newCanvas.getContext('2d');
        ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
        newCanvas.width = 0;
        newCanvas.height = 0;
    }
    
    if (oldCanvas) {
        const ctx = oldCanvas.getContext('2d');
        ctx.clearRect(0, 0, oldCanvas.width, oldCanvas.height);
        oldCanvas.width = 0;
        oldCanvas.height = 0;
    }
}

function loadPDFs() {
    if (oldTemplateFile && newTemplateFile) {
        const newFileReader = new FileReader();
        const oldFileReader = new FileReader();
        
        newFileReader.onload = function(e) {
            pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {
                newPdfDoc = pdf;
                totalPages = Math.max(pdf.numPages, totalPages);
                renderPage(currentPage);
            });
        };
        
        oldFileReader.onload = function(e) {
            pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {
                oldPdfDoc = pdf;
                totalPages = Math.max(pdf.numPages, totalPages);
                renderPage(currentPage);
            });
        };
        
        newFileReader.readAsArrayBuffer(newTemplateFile);
        oldFileReader.readAsArrayBuffer(oldTemplateFile);
    }
}

function renderPage(pageNum) {
    if (newPdfDoc && pageNum <= newPdfDoc.numPages) {
        newPdfDoc.getPage(pageNum).then(function(page) {
            const canvas = document.getElementById('newPdfCanvas');
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: currentZoom});
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxWidth = '100%';
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            page.render(renderContext);
        });
    }
    
    if (oldPdfDoc && pageNum <= oldPdfDoc.numPages) {
        oldPdfDoc.getPage(pageNum).then(function(page) {
            const canvas = document.getElementById('oldPdfCanvas');
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: currentZoom});
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxWidth = '100%';
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            page.render(renderContext);
        });
    }
    
    updatePageInfo();
}

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderPage(currentPage);
    }
}

function zoomIn() {
    if (currentZoom < 3.0) {
        currentZoom += 0.25;
        renderPage(currentPage);
        updateZoomInfo();
    }
}

function zoomOut() {
    if (currentZoom > 0.5) {
        currentZoom -= 0.25;
        renderPage(currentPage);
        updateZoomInfo();
    }
}

function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

function setZoom(zoomLevel) {
    currentZoom = zoomLevel;
    renderPage(currentPage);
    updateZoomInfo();
}

function updateZoomInfo() {
    const zoomInfo = document.getElementById('zoomInfo');
    const zoomSelect = document.getElementById('zoomSelect');
    if (zoomInfo) {
        zoomInfo.textContent = `${Math.round(currentZoom * 100)}%`;
    }
    if (zoomSelect) {
        zoomSelect.value = currentZoom;
    }
}