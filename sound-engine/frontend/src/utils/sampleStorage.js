/**
 * IndexedDB storage for audio samples
 * Allows samples to persist in the browser
 */

const DB_NAME = 'vangelis-samples';
const DB_VERSION = 1;
const STORE_NAME = 'samples';

let dbPromise = null;

/**
 * Open or create the IndexedDB database
 */
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('addedAt', 'addedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Generate a unique ID for a sample
 */
function generateId() {
  return `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store a sample in IndexedDB
 * @param {Object} sampleData - Sample metadata and audio data
 * @returns {Promise<Object>} Stored sample with ID
 */
export async function storeSample(sampleData) {
  const db = await openDB();

  const sample = {
    id: generateId(),
    name: sampleData.name,
    category: sampleData.category || 'Uncategorized',
    audioData: sampleData.audioData, // ArrayBuffer
    mimeType: sampleData.mimeType || 'audio/wav',
    duration: sampleData.duration,
    sampleRate: sampleData.sampleRate,
    channels: sampleData.channels,
    addedAt: Date.now(),
    sourcePath: sampleData.sourcePath || null // Original file path for reference
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(sample);

    request.onsuccess = () => resolve(sample);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store multiple samples at once
 * @param {Array} samples - Array of sample data
 * @returns {Promise<Array>} Stored samples
 */
export async function storeSamples(samples) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const stored = [];

    samples.forEach(sampleData => {
      const sample = {
        id: generateId(),
        name: sampleData.name,
        category: sampleData.category || 'Uncategorized',
        audioData: sampleData.audioData,
        mimeType: sampleData.mimeType || 'audio/wav',
        duration: sampleData.duration,
        sampleRate: sampleData.sampleRate,
        channels: sampleData.channels,
        addedAt: Date.now(),
        sourcePath: sampleData.sourcePath || null
      };

      store.add(sample);
      stored.push(sample);
    });

    tx.oncomplete = () => resolve(stored);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all samples from IndexedDB
 * @returns {Promise<Array>} All stored samples (without audio data for performance)
 */
export async function getAllSamples() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Return metadata only for listing (exclude heavy audioData)
      const samples = request.result.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        duration: s.duration,
        sampleRate: s.sampleRate,
        channels: s.channels,
        addedAt: s.addedAt,
        sourcePath: s.sourcePath
      }));
      resolve(samples);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get samples grouped by category
 * @returns {Promise<Object>} Samples grouped by category
 */
export async function getSamplesByCategory() {
  const samples = await getAllSamples();

  return samples.reduce((acc, sample) => {
    const cat = sample.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(sample);
    return acc;
  }, {});
}

/**
 * Get a single sample with its audio data
 * @param {string} id - Sample ID
 * @returns {Promise<Object|null>} Sample with audio data
 */
export async function getSample(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a sample from IndexedDB
 * @param {string} id - Sample ID
 */
export async function deleteSample(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all samples in a category
 * @param {string} category - Category name
 */
export async function deleteCategory(category) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('category');
    const request = index.openCursor(IDBKeyRange.only(category));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all samples from IndexedDB
 */
export async function clearAllSamples() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get storage usage statistics
 * @returns {Promise<Object>} Storage stats
 */
export async function getStorageStats() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const samples = request.result;
      let totalSize = 0;

      samples.forEach(s => {
        if (s.audioData) {
          totalSize += s.audioData.byteLength || 0;
        }
      });

      resolve({
        count: samples.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      });
    };
    request.onerror = () => reject(request.error);
  });
}
