import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getSamplesByCategory,
  getSample,
  storeSample,
  deleteCategory,
  getStorageStats
} from '../../utils/sampleStorage.js';
import { getAllSoundSetManifests } from '../../data/soundSets.js';
import { withBase } from '../../utils/baseUrl.js';

const STARTER_FAMILY_ORDER = ['piano', 'strings', 'brass', 'reed', 'chromatic percussion'];

const createDecoderContext = () => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not available');
  }
  return new AudioContextCtor();
};

const closeDecoderContext = async (ctx) => {
  if (!ctx || typeof ctx.close !== 'function') return;
  try {
    await ctx.close();
  } catch {
    // Ignore close errors from already-closed contexts.
  }
};

const buildStarterCatalog = () => {
  const manifests = getAllSoundSetManifests();
  const uniqueByPath = new Map();

  manifests.forEach((soundSet) => {
    (soundSet.instruments || []).forEach((instrument) => {
      if (!instrument.samplePath) return;
      if (uniqueByPath.has(instrument.samplePath)) return;

      const family = (instrument.families || [])[0] || 'other';
      uniqueByPath.set(instrument.samplePath, {
        id: `starter-${soundSet.id}-${instrument.id}`,
        name: instrument.label || instrument.id,
        family,
        sourceUrl: withBase(`samples/${instrument.samplePath}`),
        mimeType: 'audio/wav'
      });
    });
  });

  const items = [...uniqueByPath.values()];
  items.sort((a, b) => {
    const familyRankA = STARTER_FAMILY_ORDER.indexOf(a.family);
    const familyRankB = STARTER_FAMILY_ORDER.indexOf(b.family);
    const normalizedRankA = familyRankA === -1 ? 999 : familyRankA;
    const normalizedRankB = familyRankB === -1 ? 999 : familyRankB;
    if (normalizedRankA !== normalizedRankB) return normalizedRankA - normalizedRankB;
    return a.name.localeCompare(b.name);
  });

  return items;
};

const selectFeaturedStarterItems = (items, maxTotal = 16, maxPerFamily = 4) => {
  const grouped = new Map();
  items.forEach((item) => {
    if (!grouped.has(item.family)) {
      grouped.set(item.family, []);
    }
    grouped.get(item.family).push(item);
  });

  const featured = [];
  const consumeFamily = (family) => {
    const familyItems = grouped.get(family) || [];
    for (let i = 0; i < familyItems.length && i < maxPerFamily && featured.length < maxTotal; i += 1) {
      featured.push(familyItems[i]);
    }
    grouped.delete(family);
  };

  STARTER_FAMILY_ORDER.forEach(consumeFamily);

  if (featured.length < maxTotal) {
    const leftovers = [...grouped.values()].flat();
    leftovers.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of leftovers) {
      if (featured.length >= maxTotal) break;
      featured.push(item);
    }
  }

  return featured;
};

/**
 * Samples browser tab - import and browse local samples
 */
const SamplesTab = ({ onSampleSelect, activeSampleId }) => {
  const [samples, setSamples] = useState({});
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [starterFamilyFilter, setStarterFamilyFilter] = useState('all');
  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const starterCatalog = useMemo(() => buildStarterCatalog(), []);
  const featuredStarterCatalog = useMemo(
    () => selectFeaturedStarterItems(starterCatalog),
    [starterCatalog]
  );
  const starterFamilies = useMemo(() => {
    const present = new Set(starterCatalog.map((item) => item.family));
    const ordered = STARTER_FAMILY_ORDER.filter((family) => present.has(family));
    const extras = [...present].filter((family) => !STARTER_FAMILY_ORDER.includes(family)).sort((a, b) => a.localeCompare(b));
    return ['all', ...ordered, ...extras];
  }, [starterCatalog]);
  const filteredStarterCatalog = useMemo(() => {
    return featuredStarterCatalog.filter((item) => {
      if (starterFamilyFilter !== 'all' && item.family !== starterFamilyFilter) {
        return false;
      }
      return true;
    });
  }, [featuredStarterCatalog, starterFamilyFilter]);

  // Load samples on mount
  useEffect(() => {
    loadSamples();
  }, []);

  const loadSamples = async () => {
    try {
      setLoading(true);
      const grouped = await getSamplesByCategory();
      setSamples(grouped);

      const storageStats = await getStorageStats();
      setStats(storageStats);
    } catch (err) {
      console.error('Failed to load samples:', err);
      setError('Failed to load samples');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Handle folder import via file input with webkitdirectory
  const handleFolderImport = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImporting(true);
    setError(null);

    let decoderCtx = null;
    try {
      // Filter for audio files
      const audioFiles = files.filter(f =>
        f.type.startsWith('audio/') ||
        /\.(wav|mp3|ogg|flac|aiff|m4a)$/i.test(f.name)
      );

      if (audioFiles.length === 0) {
        setError('No audio files found in selection');
        return;
      }

      decoderCtx = createDecoderContext();

      // Extract category from folder path
      const getCategoryFromPath = (file) => {
        const path = file.webkitRelativePath || file.name;
        const parts = path.split('/');
        // Use parent folder as category, or root folder
        if (parts.length >= 2) {
          return parts[parts.length - 2];
        }
        return 'Imported';
      };

      // Process files in batches to avoid memory issues
      const batchSize = 5;

      for (let i = 0; i < audioFiles.length; i += batchSize) {
        const batch = audioFiles.slice(i, i + batchSize);

        for (const file of batch) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await decoderCtx.decodeAudioData(arrayBuffer.slice(0));

            await storeSample({
              name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
              category: getCategoryFromPath(file),
              audioData: arrayBuffer,
              mimeType: file.type || 'audio/wav',
              duration: audioBuffer.duration,
              sampleRate: audioBuffer.sampleRate,
              channels: audioBuffer.numberOfChannels,
              sourcePath: file.webkitRelativePath || file.name
            });
          } catch (err) {
            console.warn(`Failed to import ${file.name}:`, err);
          }
        }
      }

      // Reload samples list
      await loadSamples();

      // Expand newly imported categories
      const newCategories = [...new Set(audioFiles.map(getCategoryFromPath))];
      setExpandedCategories(prev => new Set([...prev, ...newCategories]));

    } catch (err) {
      console.error('Import failed:', err);
      setError('Failed to import samples');
    } finally {
      setImporting(false);
      await closeDecoderContext(decoderCtx);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  }, []);

  // Handle single file import
  const handleFileImport = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    let decoderCtx = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      decoderCtx = createDecoderContext();
      const audioBuffer = await decoderCtx.decodeAudioData(arrayBuffer.slice(0));

      await storeSample({
        name: file.name.replace(/\.[^/.]+$/, ''),
        category: 'Imported',
        audioData: arrayBuffer,
        mimeType: file.type || 'audio/wav',
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      });

      await loadSamples();
      setExpandedCategories(prev => new Set([...prev, 'Imported']));

    } catch (err) {
      console.error('Import failed:', err);
      setError('Failed to import sample');
    } finally {
      setImporting(false);
      await closeDecoderContext(decoderCtx);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  // Handle sample selection
  const handleSelectSample = useCallback(async (sample) => {
    try {
      const fullSample = await getSample(sample.id);
      if (fullSample && onSampleSelect) {
        onSampleSelect(fullSample);
      }
    } catch (err) {
      console.error('Failed to load sample:', err);
      setError('Failed to load sample');
    }
  }, [onSampleSelect]);

  const handleSelectStarterSample = useCallback((starterSample) => {
    if (!starterSample || !onSampleSelect) return;
    onSampleSelect(starterSample);
  }, [onSampleSelect]);

  // Handle category deletion
  const handleDeleteCategory = useCallback(async (e, category) => {
    e.stopPropagation();
    if (!confirm(`Delete all samples in "${category}"?`)) return;

    try {
      await deleteCategory(category);
      await loadSamples();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categories = Object.keys(samples).sort();

  return (
    <div className="samples-tab">
      {/* Import Section */}
      <div className="samples-tab__section">
        <h3 className="samples-tab__heading">Import</h3>

        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderImport}
          style={{ display: 'none' }}
          id="folder-import"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileImport}
          style={{ display: 'none' }}
          id="file-import"
        />

        <div className="samples-tab__import-btns">
          <label
            htmlFor="folder-import"
            className={`samples-tab__import-btn ${importing ? 'samples-tab__import-btn--loading' : ''}`}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
            {importing ? 'Importing...' : 'Import Folder'}
          </label>

          <label
            htmlFor="file-import"
            className={`samples-tab__import-btn samples-tab__import-btn--secondary ${importing ? 'samples-tab__import-btn--loading' : ''}`}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
            File
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="samples-tab__error">{error}</div>
      )}

      {/* Storage Stats */}
      {stats && stats.count > 0 && (
        <div className="samples-tab__stats">
          {stats.count} samples ({stats.totalSizeMB} MB)
        </div>
      )}

      {/* Starter pack quick access */}
      <div className="samples-tab__section">
        <h3 className="samples-tab__heading">Starter Pack</h3>
        <div className="samples-tab__starter-controls">
          <div className="samples-tab__starter-families">
            {starterFamilies.map((family) => (
              <button
                key={family}
                type="button"
                className={`samples-tab__starter-family-btn ${starterFamilyFilter === family ? 'samples-tab__starter-family-btn--active' : ''}`}
                onClick={() => setStarterFamilyFilter(family)}
              >
                {family}
              </button>
            ))}
          </div>
        </div>
        <div className="samples-tab__starter-grid">
          {filteredStarterCatalog.map((starterSample) => (
            <button
              key={starterSample.id}
              type="button"
              className={`samples-tab__starter-btn ${activeSampleId === starterSample.id ? 'samples-tab__starter-btn--active' : ''}`}
              onClick={() => handleSelectStarterSample(starterSample)}
            >
              <span className="samples-tab__starter-name">{starterSample.name}</span>
              <span className="samples-tab__starter-family">{starterSample.family}</span>
            </button>
          ))}
        </div>
        {filteredStarterCatalog.length === 0 && (
          <div className="samples-tab__starter-empty">
            No starter samples match this filter.
          </div>
        )}
      </div>

      {/* Samples List */}
      <div className="samples-tab__section">
        <h3 className="samples-tab__heading">Library</h3>

        {loading ? (
          <div className="samples-tab__loading">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="samples-tab__empty">
            No samples yet. Import a folder to get started.
          </div>
        ) : (
          <div className="samples-tab__categories">
            {categories.map(category => (
              <div key={category} className="samples-tab__category">
                <div className="samples-tab__category-row">
                  <button
                    type="button"
                    className={`samples-tab__category-header ${expandedCategories.has(category) ? 'samples-tab__category-header--expanded' : ''}`}
                    onClick={() => toggleCategory(category)}
                  >
                    <svg
                      className="samples-tab__category-chevron"
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="currentColor"
                    >
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                    <span className="samples-tab__category-name">{category}</span>
                    <span className="samples-tab__category-count">{samples[category].length}</span>
                  </button>
                  <button
                    type="button"
                    className="samples-tab__category-delete"
                    onClick={(e) => handleDeleteCategory(e, category)}
                    title={`Delete ${category} category`}
                    aria-label={`Delete ${category} category`}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>

                {expandedCategories.has(category) && (
                  <ul className="samples-tab__list">
                    {samples[category].map(sample => (
                      <li key={sample.id} className="samples-tab__item">
                        <button
                          type="button"
                          className={`samples-tab__sample-btn ${activeSampleId === sample.id ? 'samples-tab__sample-btn--active' : ''}`}
                          onClick={() => handleSelectSample(sample)}
                        >
                          <span className="samples-tab__sample-name">{sample.name}</span>
                          <span className="samples-tab__sample-meta">
                            {formatDuration(sample.duration)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SamplesTab;
