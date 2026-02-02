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
    if (!newTemplateFile || !oldTemplateFile) {
        alert('Please select both files');
        return;
    }
    
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
        
        if (data.success) {
            displayResults(data);
            outputFilename = data.output_file;
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        showLoading(false);
        alert('Error processing files: ' + error.message);
    });
}

function displayResults(data) {
    const resultSection = document.getElementById('resultSection');
    const downloadOptions = document.getElementById('downloadOptions');
    
    comparisonData = data.comparison;
    oldTemplateText = data.old_text || '';
    newTemplateText = data.new_text || '';
    
    // Load PDFs for side-by-side view
    loadPDFs();
    
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
            const viewport = page.getViewport({scale: 0.8});
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            
            page.render({canvasContext: context, viewport: viewport});
        });
    }
    
    if (oldPdfDoc && pageNum <= oldPdfDoc.numPages) {
        oldPdfDoc.getPage(pageNum).then(function(page) {
            const canvas = document.getElementById('oldPdfCanvas');
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: 0.8});
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            
            page.render({canvasContext: context, viewport: viewport});
        });
    }
    
    document.getElementById('pageInfo').textContent = `Page ${pageNum} of ${totalPages}`;
    document.getElementById('prevPage').disabled = pageNum <= 1;
    document.getElementById('nextPage').disabled = pageNum >= totalPages;
}

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderPage(currentPage);
    }
}