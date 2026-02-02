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
    
    resetPdfState();
    
    comparisonData = data.comparison;
    oldTemplateText = data.old_text || '';
    newTemplateText = data.new_text || '';
    
    setTimeout(() => {
        loadPDFs();
    }, 200);
    
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
    
    // Force absolute positioning
    const comparisonPanels = document.querySelector('.pdf-comparison-panels');
    if (comparisonPanels) {
        comparisonPanels.style.position = 'relative';
        comparisonPanels.style.width = '100%';
        comparisonPanels.style.height = '800px';
    }
    
    const panels = document.querySelectorAll('.pdf-panel');
    panels.forEach((panel, index) => {
        panel.style.position = 'absolute';
        panel.style.width = 'calc(50% - 10px)';
        panel.style.height = '100%';
        panel.style.left = index === 0 ? '0' : '50%';
        panel.style.top = '0';
        if (index === 1) {
            panel.style.marginLeft = '10px';
        }
    });
    
    const canvases = document.querySelectorAll('.pdf-canvas');
    canvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.maxWidth = '100%';
    });
}

function loadPDFs() {
    if (oldTemplateFile && newTemplateFile) {
        const newFileReader = new FileReader();
        const oldFileReader = new FileReader();
        
        let loadedCount = 0;
        
        newFileReader.onload = function(e) {
            pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {
                newPdfDoc = pdf;
                totalPages = Math.max(pdf.numPages, totalPages);
                loadedCount++;
                if (loadedCount === 2) {
                    renderPage(currentPage);
                }
            });
        };
        
        oldFileReader.onload = function(e) {
            pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {
                oldPdfDoc = pdf;
                totalPages = Math.max(pdf.numPages, totalPages);
                loadedCount++;
                if (loadedCount === 2) {
                    renderPage(currentPage);
                }
            });
        };
        
        newFileReader.readAsArrayBuffer(newTemplateFile);
        oldFileReader.readAsArrayBuffer(oldTemplateFile);
    }
}

function renderPage(pageNum) {
    const renderPromises = [];
    
    if (oldPdfDoc && pageNum <= oldPdfDoc.numPages) {
        const oldPromise = oldPdfDoc.getPage(pageNum).then(function(page) {
            const canvas = document.getElementById('oldPdfCanvas');
            if (!canvas) return;
            
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: currentZoom});
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxWidth = '100%';
            
            return page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        });
        renderPromises.push(oldPromise);
    }
    
    if (newPdfDoc && pageNum <= newPdfDoc.numPages) {
        const newPromise = newPdfDoc.getPage(pageNum).then(function(page) {
            const canvas = document.getElementById('newPdfCanvas');
            if (!canvas) return;
            
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: currentZoom});
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxWidth = '100%';
            
            return page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        });
        renderPromises.push(newPromise);
    }
    
    Promise.all(renderPromises).then(() => {
        updatePageInfo();
        enforceAlignment();
    });
}

function enforceAlignment() {
    const panels = document.querySelectorAll('.pdf-panel');
    panels.forEach((panel, index) => {
        panel.style.position = 'absolute';
        panel.style.width = 'calc(50% - 10px)';
        panel.style.height = '100%';
        panel.style.left = index === 0 ? '0' : '50%';
        panel.style.top = '0';
        if (index === 1) {
            panel.style.marginLeft = '10px';
        }
    });
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
        if (newPdfDoc || oldPdfDoc) {
            renderPage(currentPage);
        }
        updateZoomInfo();
    }
}

function zoomOut() {
    if (currentZoom > 0.5) {
        currentZoom -= 0.25;
        if (newPdfDoc || oldPdfDoc) {
            renderPage(currentPage);
        }
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
    if (newPdfDoc || oldPdfDoc) {
        renderPage(currentPage);
    }
    updateZoomInfo();
}

function updateZoomInfo() {
    const zoomSelect = document.getElementById('zoomSelect');
    if (zoomSelect) {
        zoomSelect.value = currentZoom;
    }
}

function toggleGrid() {
    const canvases = document.querySelectorAll('.pdf-canvas');
    const toggleBtn = document.getElementById('gridToggle');
    
    canvases.forEach(canvas => {
        if (canvas.classList.contains('grid-on')) {
            canvas.classList.remove('grid-on');
        } else {
            canvas.classList.add('grid-on');
        }
    });
    
    const isGridOn = document.querySelector('.pdf-canvas.grid-on');
    if (toggleBtn) {
        toggleBtn.textContent = isGridOn ? 'Grid Off' : 'Grid On';
    }
}

// Make functions globally accessible
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.setZoom = setZoom;
window.changePage = changePage;
window.toggleGrid = toggleGrid;