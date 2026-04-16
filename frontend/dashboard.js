const API_URL_FILES = 'http://localhost:5000/api/files';
const token = localStorage.getItem('token') || sessionStorage.getItem('token');
const username = localStorage.getItem('username') || sessionStorage.getItem('username');

let allFiles = []; // Master list
let filteredFiles = []; // Processed (sorted/searched) list
let currentPage = 1;
const itemsPerPage = 5;
let fileToDelete = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Set UI Details
    document.getElementById('usernameDisplay').innerText = username || 'User';
    document.getElementById('profileAvatar').src = `https://ui-avatars.com/api/?name=${username || 'U'}&background=4F46E5&color=fff`;

    // Sidebar Toggle Mobile
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('show');
    });

    // Listeners for functionality
    setupDragAndDrop();
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('sortSelect').addEventListener('change', handleSort);
    document.getElementById('confirmDeleteBtn').addEventListener('click', executeDelete);
    
    // Fetch initial data
    fetchFiles();
});

// UI Navigation
window.switchTab = function(sectionId, element) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('d-none'));
    document.getElementById(sectionId).classList.remove('d-none');
    
    document.querySelectorAll('.nav-link-custom').forEach(nav => nav.classList.remove('active'));
    element.classList.add('active');
    
    // Close sidebar on mobile
    if(window.innerWidth <= 768) {
       document.getElementById('sidebar').classList.remove('show');
    }

    // Refresh Files if tab switched back to files
    if(sectionId === 'filesSection') fetchFiles();
};

/* ============================
   FILE FETCH & DISPLAY LOGIC
============================ */
async function fetchFiles() {
    showLoader(true);
    try {
        const response = await fetch(API_URL_FILES, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if(response.status === 401 || response.status === 403) {
            logout();
            return;
        }

        const data = await response.json();
        if(!response.ok) throw new Error(data.message);

        allFiles = data;
        processFiles(); 
        updateDashboardStats();

    } catch (err) {
        showToast(err.message || 'Error fetching files.', 'bg-danger');
    } finally {
        showLoader(false);
    }
}

function processFiles() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const sort = document.getElementById('sortSelect').value;

    // Search
    filteredFiles = allFiles.filter(file => file.originalName.toLowerCase().includes(query));

    // Sort
    filteredFiles.sort((a, b) => {
        switch(sort) {
            case 'date-desc': return new Date(b.createdAt) - new Date(a.createdAt);
            case 'date-asc': return new Date(a.createdAt) - new Date(b.createdAt);
            case 'name-asc': return a.originalName.localeCompare(b.originalName);
            case 'name-desc': return b.originalName.localeCompare(a.originalName);
            case 'size-desc': return b.size - a.size;
            case 'size-asc': return a.size - b.size;
            default: return 0;
        }
    });

    renderTable();
    renderPagination();
}

function renderTable() {
    const tbody = document.getElementById('filesTableBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '';

    if (filteredFiles.length === 0) {
        emptyState.classList.remove('d-none');
        return;
    } else {
        emptyState.classList.add('d-none');
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filteredFiles.slice(startIndex, startIndex + itemsPerPage);

    paginatedItems.forEach(file => {
        const tr = document.createElement('tr');
        
        // Icon logic based on mimeType
        let iconHtml = '<i class="bi bi-file-earmark rounded p-2 bg-light text-secondary"></i>';
        if (file.mimeType.includes('image')) iconHtml = '<i class="bi bi-file-earmark-image rounded p-2 bg-primary bg-opacity-10 text-primary"></i>';
        if (file.mimeType.includes('pdf')) iconHtml = '<i class="bi bi-file-earmark-pdf rounded p-2 bg-danger bg-opacity-10 text-danger"></i>';

        const sizeFormatted = formatBytes(file.size);
        const dateFormatted = new Date(file.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        tr.innerHTML = `
            <td>
              <div class="d-flex align-items-center gap-3">
                 ${iconHtml}
                 <span class="fw-semibold text-truncate" style="max-width: 200px;">${file.originalName}</span>
              </div>
            </td>
            <td><span class="badge bg-light text-dark border">${file.mimeType.split('/')[1].toUpperCase()}</span></td>
            <td class="text-muted small">${sizeFormatted}</td>
            <td class="text-muted small">${dateFormatted}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-light text-primary me-1" onclick="downloadFile('${file._id}', '${file.originalName}')" title="Download"><i class="bi bi-download"></i></button>
                <button class="btn btn-sm btn-light text-danger" onclick="promptDelete('${file._id}', '${file.originalName}')" title="Delete"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* ============================
   STATISTICS & PAGINATION
============================ */
function updateDashboardStats() {
    document.getElementById('statTotalFiles').innerText = allFiles.length;
    
    const totalStorage = allFiles.reduce((acc, file) => acc + file.size, 0);
    document.getElementById('statTotalStorage').innerText = formatBytes(totalStorage);

    if (allFiles.length > 0) {
        document.getElementById('statRecentUpload').innerText = allFiles[0].originalName; // Assuming default sort is latest first
    } else {
        document.getElementById('statRecentUpload').innerText = 'None';
    }
}

function renderPagination() {
    const ul = document.getElementById('paginationControls');
    ul.innerHTML = '';
    const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="changePage(${i}, event)">${i}</a>`;
        ul.appendChild(li);
    }
}

window.changePage = function(page, event) {
    event.preventDefault();
    currentPage = page;
    renderTable();
    renderPagination();
}

function handleSearch() {
    currentPage = 1;
    processFiles();
}

function handleSort() {
    currentPage = 1;
    processFiles();
}

/* ============================
   UPLOAD LOGIC (DRAG & DROP)
============================ */
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if(files.length) uploadFile(files[0]);
    }, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFileSelect(e) {
    if(this.files.length) uploadFile(this.files[0]);
}

function uploadFile(file) {
    // Client-side validations
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
        return showToast('Invalid file type! Only JPG, PNG, PDF allowed.', 'bg-danger');
    }
    if (file.size > 5 * 1024 * 1024) {
        return showToast('File too large! Max size is 5MB.', 'bg-danger');
    }

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL_FILES}/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    // UI Updates
    const progContainer = document.getElementById('uploadProgressContainer');
    const progBar = document.getElementById('uploadProgressBar');
    progContainer.classList.remove('d-none');
    progBar.style.width = '0%';
    progBar.innerText = '0%';

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progBar.style.width = percentComplete + '%';
            progBar.innerText = percentComplete + '%';
        }
    };

    xhr.onload = function() {
        if (xhr.status === 201) {
            showToast('File uploaded successfully!', 'bg-success');
            setTimeout(() => {
                progContainer.classList.add('d-none');
                 document.getElementById('fileInput').value = '';
                 fetchFiles(); // update system
                 // optional: switch automatically to My Files
                 // document.querySelector('a[href="#filesSection"]').click();
            }, 1000);
        } else {
            const res = JSON.parse(xhr.responseText);
            showToast(res.message || 'Error uploading file.', 'bg-danger');
            progContainer.classList.add('d-none');
        }
    };

    xhr.onerror = function() {
        showToast('Network error during upload.', 'bg-danger');
        progContainer.classList.add('d-none');
    };

    xhr.send(formData);
}

/* ============================
   DOWNLOAD & DELETE LOGIC
============================ */
window.downloadFile = function(id, filename) {
    fetch(`${API_URL_FILES}/download/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        if(!response.ok) throw new Error('Download failed');
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(err => {
        showToast('Error downloading file', 'bg-danger');
    });
}

window.promptDelete = function(id, filename) {
    fileToDelete = id;
    document.getElementById('deleteFileName').innerText = filename;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

async function executeDelete() {
    if(!fileToDelete) return;

    // Use Bootstrap instance to close
    const modalEl = document.getElementById('deleteModal');
    const modalInst = bootstrap.Modal.getInstance(modalEl);
    
    try {
        const res = await fetch(`${API_URL_FILES}/${fileToDelete}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message);
        }

        showToast('File deleted successfully', 'bg-success');
        modalInst.hide();
        fetchFiles(); // refresh
    } catch(err) {
        showToast(err.message || 'Error deleting file', 'bg-danger');
    }
}

/* ============================
   UTILITIES
============================ */
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function showLoader(show) {
    document.getElementById('loader').style.display = show ? 'block' : 'none';
}

function showToast(message, colorClass = 'bg-primary') {
    const toastEl = document.getElementById('appToast');
    const toastBody = document.getElementById('toastMessage');
    
    // Reset background classes
    toastEl.classList.remove('bg-primary', 'bg-success', 'bg-danger', 'text-bg-primary');
    toastEl.classList.add(colorClass, 'text-white');
    
    toastBody.innerText = message;
    
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
}
