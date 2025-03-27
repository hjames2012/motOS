        let historyStack = [];
        let currentIndex = -1;
        let allFiles = []; // Store all files for search functionality
        let currentDirHandle = null; // Store the current directory handle
        let currentFileHandle = null; // Store the current file handle for renaming and deleting
        let clickTimeout; // Timeout variable to differentiate between single and double clicks

        document.getElementById('select-directory').addEventListener('click', async () => {
            try {
                const dirHandle = await window.showDirectoryPicker();
                if (dirHandle) {
                    currentDirHandle = dirHandle; // Update current directory handle
                    await listFiles(dirHandle);
                    await saveDirectoryHandle(dirHandle);
                    // Reset history stack and add the new directory
                    historyStack = [dirHandle];
                    currentIndex = 0;
                    updateNavigationButtons();
                }
            } catch (error) {
                console.error('Error selecting directory:', error);
                alert('Failed to select directory. Please check console for details.');
            }
        });

        document.getElementById('back-button').addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                const previousDir = historyStack[currentIndex];
                listFiles(previousDir);
                updateNavigationButtons();
            }
        });

        document.getElementById('forward-button').addEventListener('click', () => {
            if (currentIndex < historyStack.length - 1) {
                currentIndex++;
                const nextDir = historyStack[currentIndex];
                listFiles(nextDir);
                updateNavigationButtons();
            }
        });

        document.getElementById('search-input').addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            filterFiles(searchTerm);
        });

        document.addEventListener('DOMContentLoaded', async () => {
            const dirHandle = await getDirectoryHandle();
            if (dirHandle) {
                currentDirHandle = dirHandle; // Update current directory handle
                await listFiles(dirHandle);
                // Initialize history stack
                historyStack.push(dirHandle);
                currentIndex = 0;
                updateNavigationButtons();
            }
        });

        async function saveDirectoryHandle(handle) {
            const idb = await openDB();
            const tx = idb.transaction('dirs', 'readwrite');
            tx.store.put(handle, 'directory');
            await tx.done;
        }

        async function getDirectoryHandle() {
            const idb = await openDB();
            const tx = idb.transaction('dirs', 'readonly');
            const handle = await tx.store.get('directory');
            await tx.done;
            return handle;
        }

        async function openDB() {
            return idb.openDB('file-explorer-db', 1, {
                upgrade(db) {
                    db.createObjectStore('dirs');
                }
            });
        }

        async function listFiles(dirHandle) {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = '';
            allFiles = []; // Reset all files

            for await (const entry of dirHandle.values()) {
                allFiles.push(entry); // Store file for search functionality

                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                
                // Determine the icon based on entry type
                let iconSrc;
                let imagePreview = '';
                if (entry.kind === 'directory') {
                    iconSrc = 'https://github.com/blueedgetechno/win11React/blob/master/public/img/icon/explorer.png?raw=true'; // Folder icon
                } else if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
                    iconSrc = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Notepad%2C_Icon_1.svg/1200px-Notepad%2C_Icon_1.svg.png'; // Notepad icon for text files
                } else if (entry.kind === 'file' && (entry.name.endsWith('.mp3') || entry.name.endsWith('.wav') || entry.name.endsWith('.ogg') || entry.name.endsWith('.mp4') || entry.name.endsWith('.mkv'))) {
                    iconSrc = 'https://static.wikia.nocookie.net/windows/images/1/11/Windows_Media_Player_%28Windows_11%29_Icon.png'; // Icon for audio and video files
                } else if (entry.kind === 'file' && (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg'))) {
                    // Create a URL for the image file to display as a preview
                    const file = await entry.getFile();
                    const imageUrl = URL.createObjectURL(file);
                    imagePreview = `<img src="${imageUrl}" alt="${entry.name}" style="width: 100%; height: auto; border-radius: 10px;">`; // Image preview
                } else if (entry.kind === 'file' && entry.name.endsWith('.zip')) {
                    iconSrc = 'https://www.elevenforum.com/data/attachments/36/36064-44909c91577273a0fa6f62a5f73156a5.jpg'; // Icon for zip files
                } else {
                    iconSrc = 'https://via.placeholder.com/50?text=FILE'; // Generic file icon
                }

                fileItem.innerHTML = `
                    ${imagePreview || `<img src="${iconSrc}" alt="${entry.kind}">`}
                    <span>${entry.name}</span>
                `;
                
                // Handle single-click for showing rename and delete buttons
                fileItem.onclick = (event) => {
                    event.stopPropagation(); // Prevent click event from bubbling up
                    clearTimeout(clickTimeout); // Clear any existing timeout
                    currentFileHandle = entry; // Store the current file handle
                    document.getElementById('rename-button').style.display = 'inline-block'; // Show rename button
                    document.getElementById('delete-button').style.display = 'inline-block'; // Show delete button
                };

                // Handle double-click for opening files or folders
                fileItem.ondblclick = async () => {
                    clearTimeout(clickTimeout); // Clear the single-click timeout
                    if (entry.kind === 'directory') {
                        historyStack = historyStack.slice(0, currentIndex + 1); // Remove forward history
                        historyStack.push(entry);
                        currentIndex++;
                        await listFiles(entry); // Open the directory
                        updateNavigationButtons();
                    } else {
                        openFile(entry); // Open the file
                    }
                };

                fileList.appendChild(fileItem);
            }
        }

        // Handle rename button click
        document.getElementById('rename-button').onclick = (event) => {
            event.stopPropagation(); // Prevent click event from bubbling up
            if (currentFileHandle) {
                document.getElementById('file-name-rename').innerText = currentFileHandle.name; // Show the file name in the modal
                document.getElementById('new-file-name').value = currentFileHandle.name;
                document.getElementById('rename-modal').style.display = 'flex'; // Show the modal
            }
        };

        // Handle delete button click
        document.getElementById('delete-button').onclick = (event) => {
            event.stopPropagation(); // Prevent click event from bubbling up
            if (currentFileHandle) {
                document.getElementById('file-name-delete').innerText = currentFileHandle.name; // Show the file name in the modal
                document.getElementById('delete-modal').style.display = 'flex'; // Show the modal
            }
        };

        // Handle rename confirmation
        document.getElementById('confirm-rename').onclick = async () => {
            const newName = document.getElementById('new-file-name').value;
            if (currentFileHandle) {
                await currentFileHandle.move(newName); // Rename the file
                await listFiles(currentFileHandle.parent); // Refresh the file list
            }
            document.getElementById('rename-modal').style.display = 'none';
        };

        // Handle cancel rename
        document.getElementById('cancel-rename').onclick = () => {
            document.getElementById('rename-modal').style.display = 'none';
        };

        // Handle delete confirmation
        document.getElementById('confirm-delete').onclick = async () => {
            if (currentFileHandle) {
                await currentFileHandle.remove(); // Delete the file
                await listFiles(currentFileHandle.parent); // Refresh the file list without needing to reselect the directory
            }
            document.getElementById('delete-modal').style.display = 'none';
        };

        // Handle cancel delete
        document.getElementById('cancel-delete').onclick = () => {
            document.getElementById('delete-modal').style.display = 'none';
        };

        // Deselect file and hide buttons when clicking outside
        window.onclick = (event) => {
            const renameModal = document.getElementById('rename-modal');
            const deleteModal = document.getElementById('delete-modal');
            if (event.target !== renameModal && !renameModal.contains(event.target)) {
                renameModal.style.display = 'none';
            }
            if (event.target !== deleteModal && !deleteModal.contains(event.target)) {
                deleteModal.style.display = 'none';
            }
            // Deselect file and hide buttons if clicking outside the file list
            const fileList = document.getElementById('file-list');
            if (!fileList.contains(event.target)) {
                currentFileHandle = null; // Clear the current file handle
                document.getElementById('rename-button').style.display = 'none'; // Hide rename button
                document.getElementById('delete-button').style.display = 'none'; // Hide delete button
            }
        };

        function filterFiles(searchTerm) {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = ''; // Clear current file list

            const filteredFiles = allFiles.filter(file => file.name.toLowerCase().includes(searchTerm));
            for (const entry of filteredFiles) {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';

                // Determine the icon based on entry type
                let iconSrc;
                let imagePreview = '';
                if (entry.kind === 'directory') {
                    iconSrc = 'https://github.com/blueedgetechno/win11React/blob/master/public/img/icon/explorer.png?raw=true'; // Folder icon
                } else if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
                    iconSrc = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Notepad%2C_Icon_1.svg/1200px-Notepad%2C_Icon_1.svg.png'; // Notepad icon for text files
                } else if (entry.kind === 'file' && (entry.name.endsWith('.mp3') || entry.name.endsWith('.wav') || entry.name.endsWith('.ogg') || entry.name.endsWith('.mp4') || entry.name.endsWith('.mkv'))) {
                    iconSrc = 'https://static.wikia.nocookie.net/windows/images/1/11/Windows_Media_Player_%28Windows_11%29_Icon.png'; // Icon for audio and video files
                } else if (entry.kind === 'file' && (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg'))) {
                    // No image preview in the filter function
                    iconSrc = 'https://via.placeholder.com/50?text=FILE'; // Placeholder for image files in the filter
                } else if (entry.kind === 'file' && entry.name.endsWith('.zip')) {
                    iconSrc = 'https://www.elevenforum.com/data/attachments/36/36064-44909c91577273a0fa6f62a5f73156a5.jpg'; // Icon for zip files
                } else {
                    iconSrc = 'https://via.placeholder.com/50?text=FILE'; // Generic file icon
                }

                fileItem.innerHTML = `
                    ${imagePreview || `<img src="${iconSrc}" alt="${entry.kind}">`}
                    <span>${entry.name}</span>
                `;
                fileItem.ondblclick = async () => {
                    if (entry.kind === 'directory') {
                        // Update history stack
                        historyStack = historyStack.slice(0, currentIndex + 1); // Remove forward history
                        historyStack.push(entry);
                        currentIndex++;
                        await listFiles(entry);
                        updateNavigationButtons();
                    } else {
                        openFile(entry);
                    }
                };
                fileList.appendChild(fileItem);
            }
        }

        async function openFile(fileHandle) {
            if (fileHandle.kind === 'file') {
                const file = await fileHandle.getFile();
                const content = await file.text();
                alert(`File contents of ${file.name}:\n${content}`);
            }
        }

        function updateNavigationButtons() {
            document.getElementById('back-button').disabled = currentIndex <= 0;
            document.getElementById('forward-button').disabled = currentIndex >= historyStack.length - 1;
        }
