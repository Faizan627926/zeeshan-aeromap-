/**
 * AeroMap Application Controller
 * High-Fidelity Front-End Mapping, Navigation, & Simulation Core
 * Powered by Leaflet.js
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if Leaflet L is loaded from CDN. If not, render a professional error diagnostic block!
  if (typeof L === 'undefined') {
    console.error("Leaflet is not defined! Make sure you are connected to the internet to load the mapping CDN libraries.");
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; font-family: sans-serif; background: #0f172a; color: #f8fafc; border-radius: 24px;">
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; color: #ef4444; margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #fff;">Mapping Engine Failed to Load</h2>
          <p style="font-size: 14px; max-width: 440px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px;">
            AeroMap requires the <b>Leaflet.js</b> mapping library from the unpkg CDN. Please verify your internet connection or check if a firewall/adblocker is blocking <code>unpkg.com</code>.
          </p>
          <button onclick="window.location.reload()" style="background: #14b8a6; color: #0f172a; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: background 0.2s;">
            Retry Connection
          </button>
        </div>
      `;
    }
    return;
  }

  // Safe Lucide icon creation wrapper
  function safeCreateIcons(options) {
    if (typeof lucide !== 'undefined') {
      try {
        if (options) {
          lucide.createIcons(options);
        } else {
          lucide.createIcons();
        }
      } catch (err) {
        console.error("Lucide icon generation failed:", err);
      }
    }
  }

  // --------------------------------------------------
  // 1. Initial State & Configuration Variables
  // --------------------------------------------------
  const state = {
    theme: 'dark',
    mapStyle: 'dark',
    metricUnit: 'metric', // 'metric' (km) or 'imperial' (miles)
    trafficEnabled: true,
    voiceVolume: 0.8,
    
    // Geolocation state
    liveLocation: null,
    liveMarker: null,
    isTracking: false,
    speed: 0,
    heading: 0,
    
    // Active Map Tools
    is3dMode: false,
    isMeasureMode: false,
    measurePoints: [],
    measureLines: null,
    measureMarkers: [],
    
    // Pin Drop state
    customPins: [], // [{id, lat, lng, title, notes, color, marker}]
    
    // Search state
    recentSearches: [],
    activeSearchMarker: null,
    
    // Route & Navigation state
    routeStartLatLng: null,
    routeEndLatLng: null,
    routeStartName: '',
    routeEndName: '',
    transitMode: 'driving', // 'driving', 'bicycling', 'walking'
    activeRouteLines: [], // Array of Leaflet Polylines (green, yellow, red segments)
    routeData: null,
    
    // Simulating State
    isSimulating: false,
    simInterval: null,
    simCarMarker: null,
    simPathPoints: [],
    simCurrentIndex: 0,
    simInstructions: []
  };

  // Define highly professional, watermark-free premium map tile layers (no API key friction)
  const tileProviders = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    })
  };

  // Load Saved Searches & Pins from LocalStorage
  try {
    state.recentSearches = JSON.parse(localStorage.getItem('aeromap_recent')) || [];
    state.customPins = JSON.parse(localStorage.getItem('aeromap_pins')) || [];
  } catch (e) {
    console.error("LocalStorage load error", e);
  }

  // --------------------------------------------------
  // 2. DOM Elements Selection Cache
  // --------------------------------------------------
  const el = {
    // Sidebar Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    sidebarPanel: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    
    // Search UI
    searchInput: document.getElementById('search-input'),
    voiceSearchBtn: document.getElementById('voice-search-btn'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    searchSuggestions: document.getElementById('search-suggestions'),
    recentSearchesList: document.getElementById('recent-searches-list'),
    clearRecentBtn: document.getElementById('clear-recent-btn'),
    shortcutChips: document.querySelectorAll('.shortcut-chip'),
    
    // Navigation UI
    routeStartInput: document.getElementById('route-start'),
    routeEndInput: document.getElementById('route-end'),
    setStartLiveBtn: document.getElementById('set-start-live'),
    startSuggestions: document.getElementById('start-suggestions'),
    endSuggestions: document.getElementById('end-suggestions'),
    swapRouteBtn: document.getElementById('swap-route-btn'),
    transitButtons: document.querySelectorAll('.mode-btn'),
    emptyRoutePrompt: document.getElementById('empty-route-prompt'),
    routeInfoPanel: document.getElementById('route-info-panel'),
    routeETA: document.getElementById('route-eta'),
    routeArrivalTime: document.getElementById('route-arrival-time'),
    routeDistance: document.getElementById('route-distance'),
    routeTrafficBadge: document.getElementById('route-traffic-badge'),
    altTimeFast: document.getElementById('alt-time-fast'),
    altTimeEco: document.getElementById('alt-time-eco'),
    startNavBtn: document.getElementById('start-nav-btn'),
    directionsContainer: document.getElementById('directions-container'),
    directionsList: document.getElementById('directions-list'),
    
    // Favorites UI
    savedPlacesList: document.getElementById('saved-places-list'),
    favoritesCount: document.getElementById('favorites-count'),
    
    // Settings UI
    themeDarkBtn: document.getElementById('theme-dark-btn'),
    themeLightBtn: document.getElementById('theme-light-btn'),
    tileChoiceButtons: document.querySelectorAll('.tile-choice-btn'),
    settingsTrafficToggle: document.getElementById('settings-traffic-toggle'),
    settingsVoiceVolume: document.getElementById('settings-voice-volume'),
    metricButtons: document.querySelectorAll('.metric-btn'),
    
    // HUD & Overlays
    mapViewWrapper: document.querySelector('.map-view-wrapper'),
    map3dBtn: document.getElementById('map-3d-btn'),
    mapMeasureBtn: document.getElementById('map-measure-btn'),
    mapLocationBtn: document.getElementById('map-location-btn'),
    zoomInBtn: document.getElementById('zoom-in-btn'),
    zoomOutBtn: document.getElementById('zoom-out-btn'),
    liveTimeDisplay: document.getElementById('live-time-display'),
    
    // Distance HUD
    measureHud: document.getElementById('measure-hud'),
    closeMeasureBtn: document.getElementById('close-measure-btn'),
    measureTotalVal: document.getElementById('measure-total-val'),
    measurePointsCount: document.getElementById('measure-points-count'),
    resetMeasureBtn: document.getElementById('reset-measure-btn'),
    
    // Navigation HUD
    navigationHud: document.getElementById('navigation-hud'),
    navCompassArrow: document.getElementById('nav-compass-arrow'),
    navCurrentManeuver: document.getElementById('nav-current-maneuver-instruction'),
    navNextStepDist: document.getElementById('nav-next-step-distance'),
    navLiveSpeed: document.getElementById('nav-live-speed'),
    navProgressFill: document.getElementById('nav-progress-fill'),
    navHudTimeRem: document.getElementById('nav-hud-time-rem'),
    navHudDistRem: document.getElementById('nav-hud-dist-rem'),
    stopNavSimBtn: document.getElementById('stop-nav-simulation-btn'),
    
    // Custom Pin Modal
    pinModal: document.getElementById('pin-modal-backdrop'),
    closePinModal: document.getElementById('close-pin-modal'),
    cancelPinModal: document.getElementById('cancel-pin-modal'),
    savePinModal: document.getElementById('save-pin-modal'),
    pinTitle: document.getElementById('pin-title'),
    pinNotes: document.getElementById('pin-notes'),
    pinColorDots: document.querySelectorAll('.color-dot'),
    pinLat: document.getElementById('pin-lat'),
    pinLng: document.getElementById('pin-lng')
  };

  // --------------------------------------------------
  // 3. Initialize Leaflet Map Engine
  // --------------------------------------------------
  // Start centered on Paris, a beautiful dense city for routing & 3D tilts
  const defaultCenter = [48.8566, 2.3522]; 
  const map = L.map('map', {
    center: defaultCenter,
    zoom: 13,
    zoomControl: false, // Hidden to use premium HUD buttons
    attributionControl: true
  });

  // Load default dark tile style
  tileProviders.dark.addTo(map);

  // Trigger icons rendering
  safeCreateIcons();

  // Update clock hud
  setInterval(() => {
    const time = new Date().toLocaleTimeString();
    el.liveTimeDisplay.textContent = time;
  }, 1000);

  // --------------------------------------------------
  // 4. Tab Navigation System
  // --------------------------------------------------
  el.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Toggle button states
      el.tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle panes
      el.tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabName}`) {
          pane.classList.add('active');
        }
      });
    });
  });

  // Collapsing / Expanding Sidebar Panel
  el.sidebarToggle.addEventListener('click', () => {
    el.sidebarPanel.classList.toggle('collapsed');
    
    // Create or toggle floating trigger when collapsed
    let trigger = document.getElementById('sidebar-expand-trigger');
    if (el.sidebarPanel.classList.contains('collapsed')) {
      if (!trigger) {
        trigger = document.createElement('button');
        trigger.id = 'sidebar-expand-trigger';
        trigger.className = 'sidebar-floating-trigger';
        trigger.title = 'Expand Dashboard';
        trigger.innerHTML = '<i data-lucide="chevron-right"></i>';
        document.querySelector('.app-container').appendChild(trigger);
        safeCreateIcons({ attrs: { id: 'sidebar-expand-trigger' } });
        
        trigger.addEventListener('click', () => {
          el.sidebarPanel.classList.remove('collapsed');
          trigger.remove();
        });
      }
    } else {
      if (trigger) trigger.remove();
    }
  });

  // --------------------------------------------------
  // 5. Theme and Settings Handlers
  // --------------------------------------------------
  // Theme selection
  el.themeDarkBtn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    el.themeDarkBtn.classList.add('active');
    el.themeLightBtn.classList.remove('active');
    state.theme = 'dark';
  });

  el.themeLightBtn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    el.themeLightBtn.classList.add('active');
    el.themeDarkBtn.classList.remove('active');
    state.theme = 'light';
  });

  // Map Tile layer switching
  el.tileChoiceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const styleName = btn.dataset.style;
      
      // Switch active layer
      Object.keys(tileProviders).forEach(key => {
        map.removeLayer(tileProviders[key]);
      });
      tileProviders[styleName].addTo(map);
      
      // Update active btn
      el.tileChoiceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mapStyle = styleName;
    });
  });

  // Settings: Traffic Toggle
  el.settingsTrafficToggle.addEventListener('checkbox', (e) => {
    // Note: Leaflet checkboxes are inputs
  });
  el.settingsTrafficToggle.addEventListener('change', (e) => {
    state.trafficEnabled = e.target.checked;
    // Re-render route if active to show traffic colors vs flat blue
    if (state.routeData) {
      drawRouteSegments(state.routeData.pathPoints);
    }
  });

  // Settings: Voice volume control
  el.settingsVoiceVolume.addEventListener('input', (e) => {
    state.voiceVolume = parseFloat(e.target.value);
    // Visual volume feedback icon
    const volumeIcon = document.getElementById('volume-icon');
    if (state.voiceVolume === 0) {
      volumeIcon.setAttribute('data-lucide', 'volume-x');
    } else if (state.voiceVolume < 0.5) {
      volumeIcon.setAttribute('data-lucide', 'volume-1');
    } else {
      volumeIcon.setAttribute('data-lucide', 'volume-2');
    }
    lucide.createIcons();
  });

  // Settings: Metric choice (KM vs Miles)
  el.metricButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      state.metricUnit = btn.dataset.unit;
      el.metricButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update UI units dynamically
      if (state.routeData) {
        updateRouteDetailsUI();
      }
      if (state.isMeasureMode && state.measurePoints.length > 1) {
        updateMeasureHUD();
      }
    });
  });

  // --------------------------------------------------
  // 6. Map Zoom & Standard Floating HUD Controls
  // --------------------------------------------------
  el.zoomInBtn.addEventListener('click', () => map.zoomIn());
  el.zoomOutBtn.addEventListener('click', () => map.zoomOut());

  // 3D Perspective Tilt Button
  el.map3dBtn.addEventListener('click', () => {
    state.is3dMode = !state.is3dMode;
    el.mapViewWrapper.classList.toggle('map-3d', state.is3dMode);
    el.map3dBtn.classList.toggle('active', state.is3dMode);
    
    // Invalide size so Leaflet recalculates correctly under tilted conditions
    setTimeout(() => map.invalidateSize(), 850);
  });

  // Live Location Tracker Button
  el.mapLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert("HTML5 Geolocation is not supported by your browser.");
      return;
    }

    el.mapLocationBtn.classList.add('active');
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        state.liveLocation = [lat, lng];
        
        // Mock speedometer speed and compass heading if not provided
        state.speed = pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : Math.floor(Math.random() * 30) + 20; 
        state.heading = pos.coords.heading !== null ? pos.coords.heading : Math.floor(Math.random() * 360);

        // Center map
        map.flyTo(state.liveLocation, 15, { duration: 1.5 });

        // Draw / update marker
        if (state.liveMarker) {
          state.liveMarker.setLatLng(state.liveLocation);
        } else {
          // Custom glowing CSS pulsing indicator
          const pulseIcon = L.divIcon({
            className: 'pulse-marker-wrapper',
            html: '<div class="pulse-marker"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          state.liveMarker = L.marker(state.liveLocation, { icon: pulseIcon }).addTo(map);
        }

        // Auto fill starting point in routing if empty
        if (!el.routeStartInput.value) {
          state.routeStartLatLng = L.latLng(lat, lng);
          state.routeStartName = "Current Location";
          el.routeStartInput.value = "Current Location";
        }
        
        el.mapLocationBtn.classList.remove('active');
      },
      (err) => {
        console.error("GPS Error: ", err);
        // Fallback for simulation purposes: teleports to central Paris and mocks GPS coordinate
        state.liveLocation = [48.8584, 2.2945]; // Eiffel Tower coordinates
        state.speed = 42;
        state.heading = 120;
        
        map.flyTo(state.liveLocation, 15);
        
        if (state.liveMarker) {
          state.liveMarker.setLatLng(state.liveLocation);
        } else {
          const pulseIcon = L.divIcon({
            className: 'pulse-marker-wrapper',
            html: '<div class="pulse-marker"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          state.liveMarker = L.marker(state.liveLocation, { icon: pulseIcon }).addTo(map);
        }
        
        if (!el.routeStartInput.value) {
          state.routeStartLatLng = L.latLng(state.liveLocation[0], state.liveLocation[1]);
          state.routeStartName = "Current Location (Simulated)";
          el.routeStartInput.value = "Current Location (Simulated)";
        }
        
        el.mapLocationBtn.classList.remove('active');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });

  // Set Routing start node to Live Location instantly
  el.setStartLiveBtn.addEventListener('click', () => {
    el.mapLocationBtn.click();
  });

  // --------------------------------------------------
  // 7. Distance Measurement HUD Tool
  // --------------------------------------------------
  el.mapMeasureBtn.addEventListener('click', () => {
    state.isMeasureMode = !state.isMeasureMode;
    el.mapMeasureBtn.classList.toggle('active', state.isMeasureMode);
    
    if (state.isMeasureMode) {
      // Toggle visual styling to show crosshair
      document.getElementById('map').style.cursor = 'crosshair';
      el.measureHud.style.display = 'flex';
      
      // Stop routing clicks or navigation while measuring
      cancelNavigationSimulation();
    } else {
      resetMeasureTool();
    }
  });

  el.closeMeasureBtn.addEventListener('click', () => {
    resetMeasureTool();
  });

  el.resetMeasureBtn.addEventListener('click', () => {
    clearMeasureLayer();
    updateMeasureHUD();
  });

  // Map Click Listener to record coordinates in Measure Mode
  map.on('click', (e) => {
    if (!state.isMeasureMode) return;
    
    const latlng = e.latlng;
    state.measurePoints.push(latlng);
    
    // Place a small modern marker
    const marker = L.circleMarker(latlng, {
      radius: 6,
      fillColor: '#14b8a6',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(map);
    
    state.measureMarkers.push(marker);
    
    // Draw / append polyline
    if (state.measurePoints.length > 1) {
      if (state.measureLines) {
        state.measureLines.addLatLng(latlng);
      } else {
        state.measureLines = L.polyline(state.measurePoints, {
          color: '#14b8a6',
          weight: 3,
          dashArray: '6, 6',
          opacity: 0.9
        }).addTo(map);
      }
    }
    
    updateMeasureHUD();
  });

  function updateMeasureHUD() {
    el.measurePointsCount.textContent = state.measurePoints.length;
    
    let totalDistMeters = 0;
    for (let i = 1; i < state.measurePoints.length; i++) {
      totalDistMeters += map.distance(state.measurePoints[i-1], state.measurePoints[i]);
    }
    
    // Translate unit
    if (state.metricUnit === 'metric') {
      const km = (totalDistMeters / 1000).toFixed(2);
      el.measureTotalVal.textContent = `${km} km`;
    } else {
      const miles = (totalDistMeters / 1609.34).toFixed(2);
      el.measureTotalVal.textContent = `${miles} miles`;
    }
  }

  function clearMeasureLayer() {
    state.measurePoints = [];
    state.measureMarkers.forEach(m => map.removeLayer(m));
    state.measureMarkers = [];
    if (state.measureLines) {
      map.removeLayer(state.measureLines);
      state.measureLines = null;
    }
  }

  function resetMeasureTool() {
    state.isMeasureMode = false;
    el.mapMeasureBtn.classList.remove('active');
    document.getElementById('map').style.cursor = '';
    el.measureHud.style.display = 'none';
    clearMeasureLayer();
  }

  // --------------------------------------------------
  // 8. Custom Pin Placement & Favorites local storage
  // --------------------------------------------------
  // Long press / right click on map triggers dropping a custom pin
  map.on('contextmenu', (e) => {
    // Ignore context menu if measuring
    if (state.isMeasureMode) return;
    
    const latlng = e.latlng;
    
    // Setup modal input coordinate values
    el.pinLat.value = latlng.lat;
    el.pinLng.value = latlng.lng;
    
    // Reset modal fields
    el.pinTitle.value = '';
    el.pinNotes.value = '';
    
    // Open pin Modal dialog
    el.pinModal.style.display = 'flex';
  });

  // Modal Actions
  el.closePinModal.addEventListener('click', () => el.pinModal.style.display = 'none');
  el.cancelPinModal.addEventListener('click', () => el.pinModal.style.display = 'none');

  // Color picker dot themes selection in modal
  el.pinColorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      el.pinColorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  el.savePinModal.addEventListener('click', () => {
    const lat = parseFloat(el.pinLat.value);
    const lng = parseFloat(el.pinLng.value);
    const title = el.pinTitle.value.trim() || `Dropped Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    const notes = el.pinNotes.value.trim() || 'No description notes.';
    
    // Grab selected active color accent
    const activeColorBtn = document.querySelector('.color-dot.active');
    const color = activeColorBtn ? activeColorBtn.dataset.color : '#14b8a6';
    
    const pinId = Date.now().toString();
    const pin = { id: pinId, lat, lng, title, notes, color };
    
    // Render this pin as L.marker with custom styled SVG markup
    renderPinOnMap(pin);
    
    // Add to favorites list
    state.customPins.push(pin);
    localStorage.setItem('aeromap_pins', JSON.stringify(state.customPins));
    
    renderFavoritesUI();
    
    // Close modal
    el.pinModal.style.display = 'none';
  });

  // Render a custom neon 3D hover pin using SVG and L.divIcon
  function renderPinOnMap(pin) {
    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <svg class="pin-body-svg" viewBox="0 0 32 48" width="32" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.1634 0 0 7.1634 0 16C0 28 16 48 16 48C16 48 32 28 32 16C32 7.1634 24.8366 0 16 0ZM16 24C11.5817 24 8 20.4183 8 16C8 11.5817 11.5817 8 16 8C20.4183 8 24 11.5817 24 16C24 20.4183 20.4183 24 16 24Z" fill="${pin.color}"/>
          <circle cx="16" cy="16" r="5" fill="#FFFFFF"/>
        </svg>
        <div class="pin-shadow"></div>
      `,
      iconSize: [32, 48],
      iconAnchor: [16, 48]
    });

    const marker = L.marker([pin.lat, pin.lng], { icon: customIcon }).addTo(map);
    
    // Formulate a beautiful glassmorphic Leaflet marker popup
    const popupContent = `
      <div class="custom-popup-content">
        <h4>${pin.title}</h4>
        <p>${pin.notes}</p>
        <span class="popup-coords">${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}</span>
        <div class="popup-actions">
          <button class="popup-act-btn route" data-id="${pin.id}" id="pop-route-${pin.id}">
            <i data-lucide="navigation"></i> Route
          </button>
          <button class="popup-act-btn del" data-id="${pin.id}" id="pop-del-${pin.id}">
            <i data-lucide="trash-2"></i> Delete
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { minWidth: 200 });
    
    // Hook actions when popup opens
    marker.on('popupopen', () => {
      safeCreateIcons();
      
      const routeBtn = document.getElementById(`pop-route-${pin.id}`);
      const delBtn = document.getElementById(`pop-del-${pin.id}`);
      
      if (routeBtn) {
        routeBtn.addEventListener('click', () => {
          // Set destination to this pin
          state.routeEndLatLng = L.latLng(pin.lat, pin.lng);
          state.routeEndName = pin.title;
          el.routeEndInput.value = pin.title;
          marker.closePopup();
          
          // Switch to navigation tab
          document.getElementById('tab-nav-btn').click();
          calculateRoute();
        });
      }
      
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          map.removeLayer(marker);
          deletePin(pin.id);
        });
      }
    });

    // Save map references to live list
    pin.marker = marker;
  }

  function deletePin(pinId) {
    state.customPins = state.customPins.filter(pin => {
      if (pin.id === pinId) {
        if (pin.marker) map.removeLayer(pin.marker);
        return false;
      }
      return true;
    });
    localStorage.setItem('aeromap_pins', JSON.stringify(state.customPins));
    renderFavoritesUI();
  }

  // Populate Favorites Sidebar Layout
  function renderFavoritesUI() {
    el.favoritesCount.textContent = `${state.customPins.length} items`;
    
    if (state.customPins.length === 0) {
      el.savedPlacesList.innerHTML = `
        <div class="empty-state">
          <i data-lucide="bookmark" class="state-icon"></i>
          <p>No saved places yet. Dropping map pins allows you to label and save your favorite locations.</p>
        </div>
      `;
      safeCreateIcons();
      return;
    }
    
    el.savedPlacesList.innerHTML = '';
    state.customPins.forEach(pin => {
      const card = document.createElement('div');
      card.className = 'saved-place-item';
      card.innerHTML = `
        <div class="place-left">
          <div class="place-icon-container" style="background-color: ${pin.color};">
            <i data-lucide="map-pin"></i>
          </div>
          <div class="place-meta">
            <span class="place-title">${pin.title}</span>
            <span class="place-notes">${pin.notes}</span>
            <span class="place-coord">${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}</span>
          </div>
        </div>
        <div class="place-actions">
          <button class="place-btn nav-to" title="Route to Location">
            <i data-lucide="navigation"></i>
          </button>
          <button class="place-btn del" title="Delete Saved Pin">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
      
      // Fly to when clicked
      card.addEventListener('click', (event) => {
        // Skip clicking if delete/route buttons are targeted
        if (event.target.closest('.place-btn')) return;
        map.flyTo([pin.lat, pin.lng], 15);
        if (pin.marker) pin.marker.openPopup();
      });
      
      // Navigate to btn action
      card.querySelector('.nav-to').addEventListener('click', () => {
        state.routeEndLatLng = L.latLng(pin.lat, pin.lng);
        state.routeEndName = pin.title;
        el.routeEndInput.value = pin.title;
        document.getElementById('tab-nav-btn').click();
        calculateRoute();
      });
      
      // Delete button action
      card.querySelector('.del').addEventListener('click', () => {
        deletePin(pin.id);
      });
      
      el.savedPlacesList.appendChild(card);
    });
    
    safeCreateIcons();
  }

  // Populate loaded custom pins on initial app load
  state.customPins.forEach(pin => renderPinOnMap(pin));
  renderFavoritesUI();


  // --------------------------------------------------
  // 9. Search Engine using Leaflet Geocoder Plugin
  //    Works perfectly from file:// protocol (no CORS issues)
  // --------------------------------------------------

  // Initialize the Leaflet Control Geocoder (Nominatim) - works from file://
  let geocoder = null;
  if (typeof L.Control !== 'undefined' && typeof L.Control.Geocoder !== 'undefined') {
    geocoder = L.Control.Geocoder.nominatim({
      geocodingQueryParams: { limit: 6, addressdetails: 1 }
    });
  }

  let debounceTimeout = null;

  function doSearch(query) {
    if (!query || query.trim().length < 2) return;

    const box = el.searchSuggestions;
    box.innerHTML = '<div class="suggestion-item" style="color:hsl(var(--text-muted));cursor:default;"><i data-lucide="loader"></i><span class="s-name">Searching...</span></div>';
    box.style.display = 'block';
    safeCreateIcons();

    if (!geocoder) {
      // Fallback: direct XHR to Nominatim (bypasses fetch CORS issues in some browsers)
      const xhr = new XMLHttpRequest();
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(query);
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.onload = function () {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            renderXHRResults(data, box);
          } catch (e) { showSearchError(box); }
        } else { showSearchError(box); }
      };
      xhr.onerror = function () { showSearchError(box); };
      xhr.send();
      return;
    }

    geocoder.geocode(query, function (results) {
      box.innerHTML = '';
      if (!results || results.length === 0) {
        showSearchError(box);
        return;
      }
      box.style.display = 'block';
      results.forEach(function (result) {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = '<i data-lucide="map-pin"></i><span class="s-name" title="' + result.name + '">' + result.name + '</span>';
        item.addEventListener('click', function () {
          el.searchInput.value = result.name;
          el.clearSearchBtn.style.display = 'flex';
          box.style.display = 'none';
          addRecentSearch(result.name, result.center.lat, result.center.lng);
          map.flyTo([result.center.lat, result.center.lng], 14, { duration: 1.5 });
          if (state.activeSearchMarker) map.removeLayer(state.activeSearchMarker);
          state.activeSearchMarker = L.marker([result.center.lat, result.center.lng])
            .addTo(map)
            .bindPopup('<b>' + result.name + '</b>')
            .openPopup();
        });
        box.appendChild(item);
      });
      safeCreateIcons();
    });
  }

  function renderXHRResults(data, box) {
    box.innerHTML = '';
    if (!data || data.length === 0) { showSearchError(box); return; }
    box.style.display = 'block';
    data.forEach(function (item) {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const name = item.display_name;
      const el_item = document.createElement('div');
      el_item.className = 'suggestion-item';
      el_item.innerHTML = '<i data-lucide="map-pin"></i><span class="s-name" title="' + name + '">' + name + '</span>';
      el_item.addEventListener('click', function () {
        el.searchInput.value = name;
        el.clearSearchBtn.style.display = 'flex';
        box.style.display = 'none';
        addRecentSearch(name, lat, lng);
        map.flyTo([lat, lng], 14, { duration: 1.5 });
        if (state.activeSearchMarker) map.removeLayer(state.activeSearchMarker);
        state.activeSearchMarker = L.marker([lat, lng]).addTo(map).bindPopup('<b>' + name + '</b>').openPopup();
      });
      box.appendChild(el_item);
    });
    safeCreateIcons();
  }

  function showSearchError(box) {
    box.innerHTML = '<div class="suggestion-item" style="color:hsl(var(--text-muted));cursor:default;font-size:12px;"><i data-lucide="alert-circle"></i><span class="s-name">No results found. Try a different name.</span></div>';
    box.style.display = 'block';
    safeCreateIcons();
  }

  // Search Input: live typing with debounce
  el.searchInput.addEventListener('input', function () {
    const query = el.searchInput.value.trim();
    el.clearSearchBtn.style.display = query.length > 0 ? 'flex' : 'none';
    if (query.length === 0) { el.searchSuggestions.style.display = 'none'; return; }
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(function () { doSearch(query); }, 400);
  });

  // Enter key triggers search immediately
  el.searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimeout);
      doSearch(el.searchInput.value.trim());
    }
  });

  // Search GO button click
  document.getElementById('search-go-btn').addEventListener('click', function () {
    clearTimeout(debounceTimeout);
    doSearch(el.searchInput.value.trim());
  });

  // Clear search button
  el.clearSearchBtn.addEventListener('click', function () {
    el.searchInput.value = '';
    el.clearSearchBtn.style.display = 'none';
    el.searchSuggestions.style.display = 'none';
    if (state.activeSearchMarker) {
      map.removeLayer(state.activeSearchMarker);
      state.activeSearchMarker = null;
    }
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', function (e) {
    if (!el.searchInput.contains(e.target) && !el.searchSuggestions.contains(e.target)) {
      el.searchSuggestions.style.display = 'none';
    }
  });

  // Routing inputs also use geocoder
  function setupRoutingAutocomplete(inputField, suggestionsBox, onSelectCallback) {
    let t = null;
    inputField.addEventListener('input', function () {
      const q = inputField.value.trim();
      if (q.length < 2) { suggestionsBox.style.display = 'none'; return; }
      clearTimeout(t);
      t = setTimeout(function () {
        if (!geocoder) return;
        geocoder.geocode(q, function (results) {
          suggestionsBox.innerHTML = '';
          if (!results || results.length === 0) { suggestionsBox.style.display = 'none'; return; }
          suggestionsBox.style.display = 'block';
          results.forEach(function (result) {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = '<i data-lucide="map-pin"></i><span class="s-name">' + result.name + '</span>';
            item.addEventListener('click', function () {
              onSelectCallback(result.center.lat, result.center.lng, result.name);
              suggestionsBox.style.display = 'none';
            });
            suggestionsBox.appendChild(item);
          });
          safeCreateIcons();
        });
      }, 350);
    });
    inputField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(t);
        const q = inputField.value.trim();
        if (!geocoder || !q) return;
        geocoder.geocode(q, function (results) {
          if (results && results.length > 0) {
            onSelectCallback(results[0].center.lat, results[0].center.lng, results[0].name);
            suggestionsBox.style.display = 'none';
          }
        });
      }
    });
  }


  // Autocomplete querying routine with Nominatim & Open-Meteo resilient fallback
  function fetchSuggestions(query, suggestionsBox, onSelectCallback) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    
    // We will attempt Nominatim first. If it fails (due to 403, 429, or network blocks),
    // we fallback automatically to the high-performance, keyless Open-Meteo Geocoding API!
    fetch(nominatimUrl, {
      headers: { 'Accept-Language': 'en' }
    })
      .then(res => {
        if (!res.ok) throw new Error("Nominatim blocked or rate-limited");
        return res.json();
      })
      .then(data => {
        if (!data || data.length === 0) {
          // Attempt Open-Meteo fallback even if Nominatim returns empty
          fetchOpenMeteoFallback(query, suggestionsBox, onSelectCallback);
          return;
        }
        renderSuggestionsData(data, suggestionsBox, onSelectCallback, 'nominatim');
      })
      .catch(err => {
        console.warn("Nominatim failed, falling back to Open-Meteo Geocoder:", err);
        fetchOpenMeteoFallback(query, suggestionsBox, onSelectCallback);
      });
  }

  function fetchOpenMeteoFallback(query, suggestionsBox, onSelectCallback) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!data.results || data.results.length === 0) {
          suggestionsBox.style.display = 'none';
          return;
        }
        renderSuggestionsData(data.results, suggestionsBox, onSelectCallback, 'open-meteo');
      })
      .catch(err => {
        console.error("All geocoding options failed:", err);
        suggestionsBox.style.display = 'none';
      });
  }

  function renderSuggestionsData(items, suggestionsBox, onSelectCallback, provider) {
    suggestionsBox.innerHTML = '';
    suggestionsBox.style.display = 'block';
    
    items.forEach(item => {
      let lat, lng, displayName;
      
      if (provider === 'nominatim') {
        lat = parseFloat(item.lat);
        lng = parseFloat(item.lon);
        displayName = item.display_name;
      } else {
        // Open-Meteo
        lat = item.latitude;
        lng = item.longitude;
        displayName = `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}${item.country ? ', ' + item.country : ''}`;
      }
      
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.innerHTML = `
        <i data-lucide="map-pin"></i>
        <span class="s-name" title="${displayName}">${displayName}</span>
      `;
      
      suggestionItem.addEventListener('click', () => {
        onSelectCallback(lat, lng, displayName);
      });
      
      suggestionsBox.appendChild(suggestionItem);
    });
    
    safeCreateIcons();
  }

  // Voice Search Input capture using HTML5 Web Speech
  el.voiceSearchBtn.addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support the Web Speech Recognition API. Try Google Chrome.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      el.voiceSearchBtn.classList.add('listening');
      el.searchInput.placeholder = "Listening for location...";
    };
    
    recognition.onspeechend = () => {
      recognition.stop();
      el.voiceSearchBtn.classList.remove('listening');
      el.searchInput.placeholder = "Search address, landmark, city...";
    };
    
    recognition.onerror = (e) => {
      console.error("Speech Recog Error: ", e);
      el.voiceSearchBtn.classList.remove('listening');
      el.searchInput.placeholder = "Search address, landmark, city...";
    };
    
    recognition.onresult = (e) => {
      const textResult = e.results[0][0].transcript;
      el.searchInput.value = textResult;
      el.searchInput.dispatchEvent(new Event('input')); // Trigger query dropdown fetch
    };
    
    recognition.start();
  });

  // Quick chips search buttons query
  el.shortcutChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      el.searchInput.value = query;
      el.searchInput.dispatchEvent(new Event('input'));
    });
  });

  // Recent Searches management
  function addRecentSearch(name, lat, lng) {
    // Check if query exists
    state.recentSearches = state.recentSearches.filter(item => item.name !== name);
    state.recentSearches.unshift({ name, lat, lng });
    
    // Cap at 6
    if (state.recentSearches.length > 6) state.recentSearches.pop();
    
    localStorage.setItem('aeromap_recent', JSON.stringify(state.recentSearches));
    renderRecentUI();
  }

  function renderRecentUI() {
    if (state.recentSearches.length === 0) {
      el.recentSearchesList.innerHTML = '<li class="empty-state">No recent searches</li>';
      return;
    }
    
    el.recentSearchesList.innerHTML = '';
    state.recentSearches.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'recent-item';
      li.innerHTML = `
        <div class="recent-info">
          <i data-lucide="history"></i>
          <span title="${item.name}">${item.name}</span>
        </div>
        <button class="delete-recent-btn" data-index="${idx}" title="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      `;
      
      // Click recent searches to teleports
      li.addEventListener('click', (event) => {
        if (event.target.closest('.delete-recent-btn')) return;
        el.searchInput.value = item.name;
        el.clearSearchBtn.style.display = 'flex';
        
        map.flyTo([item.lat, item.lng], 14);
        if (state.activeSearchMarker) map.removeLayer(state.activeSearchMarker);
        state.activeSearchMarker = L.marker([item.lat, item.lng]).addTo(map).bindPopup(`<b>${item.name}</b>`).openPopup();
      });
      
      // Delete single recent
      li.querySelector('.delete-recent-btn').addEventListener('click', () => {
        state.recentSearches.splice(idx, 1);
        localStorage.setItem('aeromap_recent', JSON.stringify(state.recentSearches));
        renderRecentUI();
      });
      
      el.recentSearchesList.appendChild(li);
    });
    
    safeCreateIcons();
  }

  el.clearRecentBtn.addEventListener('click', () => {
    state.recentSearches = [];
    localStorage.removeItem('aeromap_recent');
    renderRecentUI();
  });

  // Render recent lists on initial load
  renderRecentUI();

  // --------------------------------------------------
  // 10. Auto Routing Fields & Calculations
  // --------------------------------------------------
  // Setup Autocomplete dropdown handlers on Routing sidebar inputs
  setupRoutingAutocomplete(el.routeStartInput, el.startSuggestions, (lat, lng, name) => {
    state.routeStartLatLng = L.latLng(lat, lng);
    state.routeStartName = name;
    el.routeStartInput.value = name;
    el.startSuggestions.style.display = 'none';
    calculateRoute();
  });

  setupRoutingAutocomplete(el.routeEndInput, el.endSuggestions, (lat, lng, name) => {
    state.routeEndLatLng = L.latLng(lat, lng);
    state.routeEndName = name;
    el.routeEndInput.value = name;
    el.endSuggestions.style.display = 'none';
    calculateRoute();
  });

  function setupRoutingAutocomplete(inputField, suggestionsBox, onSelectCallback) {
    let inputTimeout = null;
    inputField.addEventListener('input', () => {
      const query = inputField.value.trim();
      if (query.length < 3) {
        suggestionsBox.style.display = 'none';
        return;
      }
      
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        fetchSuggestions(query, suggestionsBox, onSelectCallback);
      }, 350);
    });
  }

  // Swap Start & Destination Coordinates
  el.swapRouteBtn.addEventListener('click', () => {
    const tempName = el.routeStartInput.value;
    const tempLatLng = state.routeStartLatLng;
    
    el.routeStartInput.value = el.routeEndInput.value;
    state.routeStartLatLng = state.routeEndLatLng;
    state.routeStartName = state.routeEndName;
    
    el.routeEndInput.value = tempName;
    state.routeEndLatLng = tempLatLng;
    state.routeEndName = tempName;
    
    calculateRoute();
  });

  // Transit Modes Toggle click handler
  el.transitButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      state.transitMode = btn.dataset.mode;
      el.transitButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      calculateRoute();
    });
  });

  // Clear existing calculated routing vector overlays
  function clearRouteOverlay() {
    state.activeRouteLines.forEach(line => map.removeLayer(line));
    state.activeRouteLines = [];
    state.routeData = null;
  }

  // CORE ROUTING ENGINE: Calculates realistic multi-point curves, traffic splits, and turns
  function calculateRoute() {
    if (!state.routeStartLatLng || !state.routeEndLatLng) {
      el.routeInfoPanel.style.display = 'none';
      el.directionsContainer.style.display = 'none';
      el.emptyRoutePrompt.style.display = 'flex';
      clearRouteOverlay();
      return;
    }
    
    clearRouteOverlay();
    cancelNavigationSimulation();
    
    const start = state.routeStartLatLng;
    const end = state.routeEndLatLng;
    
    // Fly map viewport to bound both start & end coordinates beautifully
    const bounds = L.latLngBounds(start, end);
    map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    
    // Core routing simulator: Generates natural street segments rather than straight lines
    const routePoints = generateBendedRoutePoints(start, end);
    state.simPathPoints = routePoints; // Save for navigator vehicle animator
    
    // Calculate total route distance in meters
    let totalDistMeters = 0;
    for (let i = 1; i < routePoints.length; i++) {
      totalDistMeters += routePoints[i-1].distanceTo(routePoints[i]);
    }
    
    // Split the route into visual segmented traffic zones (Green, Yellow, Red)
    drawRouteSegments(routePoints);
    
    // Generate text navigation instruction cards
    const navigationSteps = generateTextManeuvers(routePoints);
    state.simInstructions = navigationSteps;
    
    // Calculate transit speed and ETA
    let baseSpeedKmh = 50; // default Driving
    if (state.transitMode === 'bicycling') baseSpeedKmh = 18;
    if (state.transitMode === 'walking') baseSpeedKmh = 5;
    
    const baseDurationHrs = (totalDistMeters / 1000) / baseSpeedKmh;
    let durationMinutes = Math.round(baseDurationHrs * 60);
    if (durationMinutes < 1) durationMinutes = 1;
    
    // Apply traffic density delays to Driving routes
    let trafficScoreStr = "Fast Movement";
    let trafficPillColorClass = "badge-green";
    
    if (state.transitMode === 'driving' && state.trafficEnabled) {
      // Calculate delay based on Red and Yellow route segments
      // Mocked traffic density multiplier
      const trafficDelayMultiplier = 1.25; 
      durationMinutes = Math.round(durationMinutes * trafficDelayMultiplier);
      trafficScoreStr = "Moderate Traffic";
      trafficPillColorClass = "badge-yellow";
      
      // Let 1 in 3 routes simulate congested red traffic
      if (totalDistMeters % 3 === 0) {
        durationMinutes = Math.round(durationMinutes * 1.4);
        trafficScoreStr = "Heavy Congestion";
        trafficPillColorClass = "badge-red";
      }
    }
    
    state.routeData = {
      distanceMeters: totalDistMeters,
      durationMinutes: durationMinutes,
      trafficScore: trafficScoreStr,
      trafficClass: trafficPillColorClass,
      steps: navigationSteps,
      pathPoints: routePoints
    };
    
    // Unhide panels & update UI details
    el.emptyRoutePrompt.style.display = 'none';
    el.routeInfoPanel.style.display = 'flex';
    el.directionsContainer.style.display = 'block';
    
    updateRouteDetailsUI();
    renderDirectionsUI(navigationSteps);
  }

  // Generates 8-15 natural-looking bended street points between points to simulate actual roads
  function generateBendedRoutePoints(start, end) {
    const points = [start];
    
    // Calculate total differences
    const dLat = end.lat - start.lat;
    const dLng = end.lng - start.lng;
    
    // We will place 5 intermediate bended coordinates
    const stepsCount = 7;
    for (let i = 1; i < stepsCount; i++) {
      const ratio = i / stepsCount;
      
      // Linear point coordinates
      let pLat = start.lat + dLat * ratio;
      let pLng = start.lng + dLng * ratio;
      
      // Add custom curves/bends perpendicular to path vector
      // Alternates curve patterns based on index to simulate city street blocks
      const perpendicularOffset = 0.05 * Math.sin(ratio * Math.PI) * (i % 2 === 0 ? 0.08 : -0.06);
      pLat += perpendicularOffset * (dLng > 0 ? 1 : -1);
      pLng += perpendicularOffset * (dLat > 0 ? -1 : 1);
      
      points.push(L.latLng(pLat, pLng));
    }
    
    points.push(end);
    return points;
  }

  // Draws colored polyline paths on map reflecting Green, Yellow, Red traffic conditions
  function drawRouteSegments(points) {
    // First clear old lines
    state.activeRouteLines.forEach(line => map.removeLayer(line));
    state.activeRouteLines = [];
    
    // If traffic overlay settings are disabled, draw a single uniform glow-indigo polyline
    if (!state.trafficEnabled) {
      const basicLine = L.polyline(points, {
        color: '#6366f1',
        weight: 6,
        opacity: 0.95
      }).addTo(map);
      
      state.activeRouteLines.push(basicLine);
      return;
    }
    
    // Slice route points into separate colored Polylines simulating live traffic
    for (let i = 1; i < points.length; i++) {
      const segment = [points[i-1], points[i]];
      
      // Decide segment color (simulating traffic patterns)
      let segmentColor = '#10b981'; // Flowing green default
      
      if (state.transitMode === 'driving') {
        const hash = (segment[0].lat + segment[0].lng).toFixed(4);
        const codeChar = hash.charAt(hash.length - 1);
        
        if (codeChar === '9' || codeChar === '4') {
          segmentColor = '#ef4444'; // Heavy traffic Congestion (Red)
        } else if (codeChar === '7' || codeChar === '2' || codeChar === '8') {
          segmentColor = '#f59e0b'; // Moderate Traffic delay (Yellow)
        }
      }
      
      const poly = L.polyline(segment, {
        color: segmentColor,
        weight: 6.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      
      state.activeRouteLines.push(poly);
    }
  }

  // Generates real text driving turn-by-turn guidance lists
  function generateTextManeuvers(points) {
    const turnTypes = ['left', 'right', 'roundabout', 'straight'];
    const streetNames = ['Grand Avenue', 'Rue de Rivoli', 'Boulevard Saint-Germain', 'Aero Expressway', 'Pine Street', 'Sunset Boulevard'];
    
    const steps = [];
    
    steps.push({
      instruction: `Head out toward ${streetNames[0]}`,
      distance: '150 m',
      icon: 'arrow-up',
      rawText: 'Head out toward Grand Avenue'
    });
    
    for (let i = 1; i < points.length - 1; i++) {
      const turn = turnTypes[i % turnTypes.length];
      const street = streetNames[(i + 2) % streetNames.length];
      
      // Distance estimation for each segment
      const dist = points[i].distanceTo(points[i+1]);
      let distStr = `${Math.round(dist)} m`;
      if (dist > 1000) distStr = `${(dist / 1000).toFixed(1)} km`;
      
      let instructionText = '';
      let lucideIcon = 'arrow-up';
      
      if (turn === 'left') {
        instructionText = `Turn left onto ${street}`;
        lucideIcon = 'corner-up-left';
      } else if (turn === 'right') {
        instructionText = `Turn right onto ${street}`;
        lucideIcon = 'corner-up-right';
      } else if (turn === 'roundabout') {
        instructionText = `At the roundabout, take the 2nd exit toward ${street}`;
        lucideIcon = 'rotate-cw';
      } else {
        instructionText = `Continue straight on ${street}`;
        lucideIcon = 'arrow-up';
      }
      
      steps.push({
        instruction: instructionText,
        distance: distStr,
        icon: lucideIcon,
        rawText: instructionText // Used by Speech Narrator
      });
    }
    
    steps.push({
      instruction: 'Arrived at your destination',
      distance: '0 m',
      icon: 'map-pin',
      rawText: 'Arrived at your destination. Welcome.'
    });
    
    return steps;
  }

  // Updates Routing calculation box details UI
  function updateRouteDetailsUI() {
    const data = state.routeData;
    if (!data) return;
    
    el.routeETA.textContent = `${data.durationMinutes} min`;
    
    // Translate distance formatting
    if (state.metricUnit === 'metric') {
      const km = (data.distanceMeters / 1000).toFixed(1);
      el.routeDistance.textContent = `${km} km`;
    } else {
      const miles = (data.distanceMeters / 1609.34).toFixed(1);
      el.routeDistance.textContent = `${miles} miles`;
    }
    
    // Arrival Time calculation
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + data.durationMinutes * 60000);
    const options = { hour: '2-digit', minute: '2-digit' };
    el.routeArrivalTime.textContent = `Arrival: ${arrivalTime.toLocaleTimeString([], options)}`;
    
    // Traffic Status Pill Badge
    el.routeTrafficBadge.className = `traffic-status-pill ${data.trafficClass}`;
    el.routeTrafficBadge.textContent = data.trafficScore;
    
    // Alternative routes dynamic ETAs
    el.altTimeFast.textContent = `${data.durationMinutes} min`;
    el.altTimeEco.textContent = `${Math.round(data.durationMinutes * 1.15)} min`;
  }

  // Render Turn-by-Turn cards list
  function renderDirectionsUI(steps) {
    el.directionsList.innerHTML = '';
    steps.forEach(step => {
      const card = document.createElement('div');
      card.className = 'turn-card';
      card.innerHTML = `
        <div class="turn-icon-orb">
          <i data-lucide="${step.icon}"></i>
        </div>
        <div class="turn-details">
          <span class="turn-instruction">${step.instruction}</span>
          <span class="turn-dist">${step.distance}</span>
        </div>
      `;
      el.directionsList.appendChild(card);
    });
    
    safeCreateIcons();
  }

  // --------------------------------------------------
  // 11. Animated GPS Turn Navigation & Text-To-Speech
  // --------------------------------------------------
  el.startNavBtn.addEventListener('click', () => {
    startNavigationSimulation();
  });

  el.stopNavSimBtn.addEventListener('click', () => {
    cancelNavigationSimulation();
  });

  // SPEECH NARRATOR UTILITY: Plays spoken guidance commands
  function speakDirectionText(text) {
    if ('speechSynthesis' in window && state.voiceVolume > 0) {
      // Cancel previous speak streams
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = state.voiceVolume;
      utterance.rate = 1.0; // standard pacing
      
      // Let speech complete smoothly
      window.speechSynthesis.speak(utterance);
    }
  }

  function startNavigationSimulation() {
    if (!state.routeData || state.simPathPoints.length < 2) return;
    
    // Setup initial simulator states
    state.isSimulating = true;
    state.simCurrentIndex = 0;
    
    // Force Map 3D Perspective Tilt on start (WOW effect)
    state.is3dMode = true;
    el.mapViewWrapper.classList.add('map-3d');
    el.map3dBtn.classList.add('active');
    
    // Collapse sidebar panel out of focus
    el.sidebarPanel.classList.add('collapsed');
    // Hide default floating expand trigger to clean HUD
    const trigger = document.getElementById('sidebar-expand-trigger');
    if (trigger) trigger.remove();
    
    // Open floating Navigation HUD Card overlay
    el.navigationHud.style.display = 'flex';
    
    // Setup animated vehicle marker
    const startLoc = state.simPathPoints[0];
    const carIcon = L.divIcon({
      className: 'navigation-car-wrapper',
      html: `
        <svg viewBox="0 0 36 36" width="36" height="36" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <circle cx="18" cy="18" r="15" fill="#6366f1" fill-opacity="0.2" stroke="#6366f1" stroke-width="2"/>
          <path d="M18 6L28 28L18 22L8 28L18 6Z" fill="#14b8a6" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    
    if (state.simCarMarker) map.removeLayer(state.simCarMarker);
    state.simCarMarker = L.marker(startLoc, { icon: carIcon }).addTo(map);
    
    // Trigger initial TTS spoken command
    speakDirectionText(`Start Navigation. ${state.simInstructions[0].rawText}`);
    
    // Simulator animation interval ticking (runs every 650ms)
    clearInterval(state.simInterval);
    state.simInterval = setInterval(() => {
      simTickStep();
    }, 650);
  }

  function simTickStep() {
    const points = state.simPathPoints;
    const totalPoints = points.length;
    
    if (state.simCurrentIndex >= totalPoints - 1) {
      // Arrived at destination endpoint!
      speakDirectionText("You have arrived at your destination. Navigation ended.");
      setTimeout(() => {
        cancelNavigationSimulation();
      }, 2500);
      return;
    }
    
    // Progress index step
    state.simCurrentIndex++;
    const currentLoc = points[state.simCurrentIndex];
    const prevLoc = points[state.simCurrentIndex - 1];
    
    // Update marker placement
    state.simCarMarker.setLatLng(currentLoc);
    
    // Calculate rotation heading (degrees) towards next coordinate
    const headingDegrees = calculateBearing(prevLoc.lat, prevLoc.lng, currentLoc.lat, currentLoc.lng);
    state.heading = headingDegrees;
    
    // Fly Map to keep vehicle centered, and rotate map compass to match heading in 3D Mode!
    map.setView(currentLoc, 16);
    
    // Animate compass rotation arrow inside bottom HUD card
    el.navCompassArrow.style.transform = `rotate(${headingDegrees}deg)`;
    
    // Update speedometer values dynamically based on simulated traffic segments
    // Red segments slows speed, green speeds up
    let targetSpeed = 52; // Default driving
    
    if (state.transitMode === 'bicycling') {
      targetSpeed = 16 + Math.floor(Math.random() * 4);
    } else if (state.transitMode === 'walking') {
      targetSpeed = 5;
    } else {
      // Driving - Check active segment colors
      const mapLineIdx = Math.min(state.simCurrentIndex - 1, state.activeRouteLines.length - 1);
      const segmentLine = state.activeRouteLines[mapLineIdx];
      
      if (segmentLine) {
        const segColor = segmentLine.options.color;
        if (segColor === '#ef4444') {
          targetSpeed = 12 + Math.floor(Math.random() * 6); // slow traffic (red)
        } else if (segColor === '#f59e0b') {
          targetSpeed = 28 + Math.floor(Math.random() * 8); // moderate (yellow)
        } else {
          targetSpeed = 55 + Math.floor(Math.random() * 15); // flowing (green)
        }
      }
    }
    
    el.navLiveSpeed.textContent = targetSpeed;
    
    // Calculate active percentage completion
    const percentDone = Math.round((state.simCurrentIndex / (totalPoints - 1)) * 100);
    el.navProgressFill.style.width = `${percentDone}%`;
    
    // Match current steps indexes with instructions maneuver listings
    const totalSteps = state.simInstructions.length;
    const stepRatioIdx = Math.min(Math.floor((state.simCurrentIndex / totalPoints) * totalSteps), totalSteps - 1);
    const activeStep = state.simInstructions[stepRatioIdx];
    
    el.navCurrentManeuver.textContent = activeStep.instruction;
    el.navNextStepDist.textContent = activeStep.distance === '0 m' ? 'Arriving' : `In ${activeStep.distance}`;
    
    // Check if new turn instruction has transitioned, trigger Audio TTS Speak
    // To prevent speaking the same instruction multiple times, track the instruction text
    const lastSpokenText = state.simCarMarker.options.title || '';
    if (lastSpokenText !== activeStep.rawText) {
      speakDirectionText(activeStep.rawText);
      state.simCarMarker.options.title = activeStep.rawText; // temporary holder
    }
    
    // Recalculate remaining statistics values
    const remainingRatio = 1 - (state.simCurrentIndex / (totalPoints - 1));
    const timeRemaining = Math.max(1, Math.round(state.routeData.durationMinutes * remainingRatio));
    
    if (state.metricUnit === 'metric') {
      const distRemaining = ((state.routeData.distanceMeters / 1000) * remainingRatio).toFixed(1);
      el.navHudDistRem.textContent = `${distRemaining} km`;
    } else {
      const distRemaining = ((state.routeData.distanceMeters / 1609.34) * remainingRatio).toFixed(1);
      el.navHudDistRem.textContent = `${distRemaining} miles`;
    }
    
    el.navHudTimeRem.textContent = `${timeRemaining} min remaining`;
    
    // Calculate simulated dynamic ETA clock updates
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + timeRemaining * 60000);
    const options = { hour: '2-digit', minute: '2-digit' };
    el.navHudDistRem.textContent += ` | ETA: ${arrivalTime.toLocaleTimeString([], options)}`;
  }

  // Bearing calculation helper: Returns heading degrees between coordinates (0-360)
  function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;
    return Math.round(brng);
  }

  function cancelNavigationSimulation() {
    state.isSimulating = false;
    clearInterval(state.simInterval);
    
    // Clear speaking synth streams
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    
    // Remove simulated car
    if (state.simCarMarker) {
      map.removeLayer(state.simCarMarker);
      state.simCarMarker = null;
    }
    
    // Hide Navigation HUD Panel
    el.navigationHud.style.display = 'none';
    
    // Re-expand Sidebar panel
    el.sidebarPanel.classList.remove('collapsed');
    
    // Reset map tilts
    state.is3dMode = false;
    el.mapViewWrapper.classList.remove('map-3d');
    el.map3dBtn.classList.remove('active');
    
    // Repan view to route bounds
    if (state.routeStartLatLng && state.routeEndLatLng) {
      const bounds = L.latLngBounds(state.routeStartLatLng, state.routeEndLatLng);
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
    }
  }

});
