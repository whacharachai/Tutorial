const tileset_url = "../../3DData/bbt/tileset.json";

const DefaultView = {
    "lon": 100.42237456034034,
    "lat": 13.917356782012034,
    "height": 116.19021246881962,
    "direction": {
        "x": 0.9660070315670954,
        "y": -0.2548663823103791,
        "z": 0.043284432893922094
    },
    "up": {
        "x": 0.2329437813342674,
        "y": 0.9307709452897157,
        "z": 0.28178474433897627
    }
}

const viewer = new Cesium.Viewer("cesiumContainer", {
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    geocoder: false,
    fullscreenButton: false,
    vrButton: false,
    imageryProvider: false,
    selectionIndicator: false,
    infoBox: false,
    timeline: false,
    animation: false,
});

viewer.cesiumWidget.creditContainer.style.display = 'none';
viewer.scene.globe.show = false;

Cesium.Cesium3DTileset.fromUrl(tileset_url)
    .then((ts) => {
        viewer.scene.primitives.add(ts);
        setCameraView(DefaultView, false);
    })
    .catch((error) => {
        console.error("Failed to load tileset:", error);
    });

viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function (e) {
    e.cancel = true;
    setCameraView(DefaultView, true, 3);
});

// ----------------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------------

function getCamData(camData) {
    return {
        destination: Cesium.Cartesian3.fromDegrees(
            camData.lon,
            camData.lat,
            camData.height
        ),
        orientation: {
            direction: new Cesium.Cartesian3(
                camData.direction.x,
                camData.direction.y,
                camData.direction.z
            ),
            up: new Cesium.Cartesian3(
                camData.up.x,
                camData.up.y,
                camData.up.z
            )
        }
    };
}

function setCameraView(camData, flight = false, duration = 3) {
    const camOptions = getCamData(camData);
    if (flight) {
        camOptions.duration = duration;
        viewer.camera.flyTo(camOptions);
    } else {
        viewer.camera.setView(camOptions);
    }
}

let msgTimeoutId = null;
function showMessage(text, timeout = 3000) {
    const msgDiv = document.getElementById("Msg");
    msgDiv.innerText = text;
    msgDiv.style.display = "block";

    if (msgTimeoutId) clearTimeout(msgTimeoutId);

    if (timeout > 0) {
        msgTimeoutId = setTimeout(() => {
            msgDiv.style.display = "none";
            msgTimeoutId = null;
        }, timeout);
    }
}

// ----------------------------------------------------------------------------------
// GLOBAL STATE & HANDLERS
// ----------------------------------------------------------------------------------

let mode = 'NONE'; // 'PICK', 'DIST', 'AREA', 'DRAW'
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
let coordHandler = null; // Specific handler for pick coordinate
let pickingCoords = false;

let activeShapePoints = [];
let activeShape;
let floatingPoint;

var savedPolygons = []; // Stores the data { name, height, positions[] }


// ----------------------------------------------------------------------------------
// MODE TRIGGERS
// ----------------------------------------------------------------------------------

function resetMode() {
    // 1. Reset generic drawing/measuring handler
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 2. Reset Coordinate Picker
    if (coordHandler) {
        coordHandler.destroy();
        coordHandler = null;
    }
    pickingCoords = false;

    // 3. Cleanup Active Shapes (if unfinished)
    if (activeShape) {
        viewer.entities.remove(activeShape);
        activeShape = undefined;
    }
    if (floatingPoint) {
        viewer.entities.remove(floatingPoint);
        floatingPoint = undefined;
    }
    activeShapePoints = [];

    // 4. Close Modal if open
    closeModal();

    mode = 'NONE';
}

function pickCoordinate() {
    // This function originally used a self-contained handler. We can keep it that way for simplicity.
    resetMode();
    mode = 'PICK';

    if (pickingCoords) {
        // Toggle off (handled by resetMode, but let's be explicit for UI feedback)
        showMessage("Pick a Point disabled");
        return;
    }

    // enable mode
    coordHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    coordHandler.setInputAction(function (movement) {
        const pickedPosition = viewer.scene.pickPosition(movement.position);

        if (Cesium.defined(pickedPosition)) {
            const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pickedPosition);
            const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
            const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

            showMessage(`Coordinate Lat: ${lat}, Lon: ${lon} ...`, 5000);

            // Turn off after one pick
            resetMode();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    pickingCoords = true;
    showMessage("Click a point...");
}

function measureDistance() {
    resetMode();
    mode = 'DIST';
    showMessage("Distance Mode: Left click to add points, Right click to finish.");
    setupInputHandlers();
}

function measureArea() {
    resetMode();
    mode = 'AREA';
    showMessage("Area Mode: Left click to add points, Right click to finish.");
    setupInputHandlers();
}

function startDrawing() {
    resetMode();
    mode = 'DRAW';
    showMessage("Draw Polygon: Left click to add points, Right click to finish.");
    setupInputHandlers();
}

function clearMeasurements() {
    // We want to clear "Temporary" things (Dist, Area) but NOT saved polygons.
    // Since we don't track them separately by ID in this simple version, and `savedPolygons` holds the source of truth for "saved" stuff:
    // We remove ALL entities, then re-add the "saved" ones.

    resetMode();
    viewer.entities.removeAll();
    refreshEntities(); // Restores saved polygons
    showMessage("Measurements cleared.");
}

function clearAllData() {
    resetMode();
    savedPolygons = [];
    viewer.entities.removeAll();
    showMessage("All data reset.");
}


// ----------------------------------------------------------------------------------
// DRAWING LOGIC (SHARED)
// ----------------------------------------------------------------------------------

function createPoint(worldPosition) {
    return viewer.entities.add({
        position: worldPosition,
        point: {
            color: Cesium.Color.YELLOW,
            pixelSize: 10,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
}

function drawShape(positionData) {
    let shape;
    if (mode === 'DIST') {
        shape = viewer.entities.add({
            polyline: {
                positions: positionData,
                clampToGround: true,
                width: 3,
                material: Cesium.Color.ORANGE
            }
        });
    } else if (mode === 'AREA') {
        shape = viewer.entities.add({
            polygon: {
                hierarchy: positionData,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE.withAlpha(0.5))
            }
        });
    } else if (mode === 'DRAW') {
        // Cyan polygon for "Saved" style
        shape = viewer.entities.add({
            polygon: {
                hierarchy: positionData,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.5)),
                perPositionHeight: true
            }
        });
    }
    return shape;
}

function setupInputHandlers() {
    handler.setInputAction(function (event) {
        var earthPosition = viewer.scene.pickPosition(event.position);

        if (Cesium.defined(earthPosition)) {
            if (activeShapePoints.length === 0) {
                floatingPoint = createPoint(earthPosition);
                activeShapePoints.push(earthPosition);

                var dynamicPositions = new Cesium.CallbackProperty(function () {
                    if (mode === 'AREA' || mode === 'DRAW') {
                        return new Cesium.PolygonHierarchy(activeShapePoints);
                    }
                    return activeShapePoints;
                }, false);

                activeShape = drawShape(dynamicPositions);
            }
            activeShapePoints.push(earthPosition);
            createPoint(earthPosition);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(function (event) {
        if (Cesium.defined(floatingPoint)) {
            var newPosition = viewer.scene.pickPosition(event.endPosition);
            if (Cesium.defined(newPosition)) {
                floatingPoint.position.setValue(newPosition);
                activeShapePoints.pop();
                activeShapePoints.push(newPosition);
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(function (event) {
        finishAction();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function finishAction() {
    // Remove handlers to stop drawing
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    if (activeShapePoints.length > 0) {
        activeShapePoints.pop(); // Remove floating point

        // Logic branches
        if (mode === 'DIST') {
            finishDistance();
        } else if (mode === 'AREA') {
            finishArea();
        } else if (mode === 'DRAW') {
            finishExtrudedPolygon();
        }
    }

    // Cleanup dynamic shapes
    // For Measurements: We usually want to keep the result static.
    // For Drawing: We remove dynamic and replace with Saved one after Modal.
    // Let's standardize: Remove dynamic, draw static.

    if (mode === 'DRAW') {
        // Keep activeShapePoints for the modal, but clear visual if needed (or keep until confirm)
        // For now, let's keep the visual active until the modal confirms or cancels.
    } else {
        // For measurements, replace dynamic with static result
        viewer.entities.remove(activeShape);
        viewer.entities.remove(floatingPoint);

        // Re-draw static
        activeShape = drawShape(activeShapePoints);
        activeShape = undefined; // decouple
        floatingPoint = undefined;
        activeShapePoints = [];

        mode = 'NONE';
    }
}

// ----------------------------------------------------------------------------------
// MEASUREMENT FINISHERS
// ----------------------------------------------------------------------------------

function finishDistance() {
    let dist = 0;
    for (let i = 0; i < activeShapePoints.length - 1; i++) {
        dist += Cesium.Cartesian3.distance(activeShapePoints[i], activeShapePoints[i + 1]);
    }
    showMessage(`Total Distance: ${dist.toFixed(2)} meters`, 0);

    viewer.entities.add({
        position: activeShapePoints[activeShapePoints.length - 1],
        label: {
            text: `${dist.toFixed(2)}m`,
            font: '14pt monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -2),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });
}

function finishArea() {
    const area = computePolygonArea(activeShapePoints);
    showMessage(`Approx Area: ${area.toFixed(2)} sq meters`, 0);

    let center = Cesium.BoundingSphere.fromPoints(activeShapePoints).center;

    // Reduce height to bring label closer to the surface
    let cartoCenter = Cesium.Cartographic.fromCartesian(center);
    cartoCenter.height -= 23; // Subtract 23 meters from the center height
    center = Cesium.Cartographic.toCartesian(cartoCenter);

    viewer.entities.add({
        position: center,
        label: {
            text: `${area.toFixed(2)}m²`,
            font: '14pt monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            pixelOffset: new Cesium.Cartesian2(0, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });
}

// Simple area calculation via projection to local tangent plane
function computePolygonArea(positions) {
    if (positions.length < 3) return 0;

    const tangentPlane = Cesium.EllipsoidTangentPlane.fromPoints(positions, Cesium.Ellipsoid.WGS84);
    const flatPositions = tangentPlane.projectPointsOntoPlane(positions);

    let area = 0;
    for (let i = 0; i < flatPositions.length; i++) {
        let j = (i + 1) % flatPositions.length;
        let p1 = flatPositions[i];
        let p2 = flatPositions[j];
        area += p1.x * p2.y;
        area -= p2.x * p1.y;
    }

    area /= 2;
    return Math.abs(area);
}

// ----------------------------------------------------------------------------------
// EXTRUDED POLYGON FINISHERS & MODAL
// ----------------------------------------------------------------------------------

function finishExtrudedPolygon() {
    // Open Modal to get Name and Height
    openModal();
}

function openModal() {
    document.getElementById("polyName").value = "";
    document.getElementById("polyHeight").value = "";
    document.getElementById("inputModal").style.display = "block";
}

function closeModal() {
    document.getElementById("inputModal").style.display = "none";
}

function cancelInput() {
    closeModal();
    // Cancelled, so remove the temporary shape and points
    if (activeShape) viewer.entities.remove(activeShape);
    if (floatingPoint) viewer.entities.remove(floatingPoint);

    showMessage("Drawing cancelled.");
    activeShape = undefined;
    floatingPoint = undefined;
    activeShapePoints = [];
    mode = 'NONE';
}

function confirmInput() {
    const name = document.getElementById("polyName").value || "Untitled";
    const heightStr = document.getElementById("polyHeight").value || "0";
    const height = parseFloat(heightStr);

    closeModal();

    // Remove dynamic shape
    if (activeShape) viewer.entities.remove(activeShape);
    if (floatingPoint) viewer.entities.remove(floatingPoint);

    // Add to saved list
    const positionsSimple = activeShapePoints.map(p => {
        const c = Cesium.Ellipsoid.WGS84.cartesianToCartographic(p);
        return {
            lon: Cesium.Math.toDegrees(c.longitude),
            lat: Cesium.Math.toDegrees(c.latitude),
            height: c.height // ground height
        };
    });

    savedPolygons.push({
        name: name,
        extrudedHeight: height,
        positions: positionsSimple
    });

    activeShape = undefined;
    floatingPoint = undefined;
    activeShapePoints = []; // consume points

    mode = 'NONE';

    refreshEntities();
}

function refreshEntities() {
    // We only want to refresh the "Saved" polygons. 
    // BUT we also share the viewer entities. 
    // This function assumes we cleared entities or want to re-draw ALL saved polygons.

    savedPolygons.forEach(poly => {
        const positions = poly.positions.map(p => {
            return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height);
        });

        // Calculate max height for extrusion
        let maxBaseHeight = -Number.MAX_VALUE;
        poly.positions.forEach(p => {
            if (p.height > maxBaseHeight) maxBaseHeight = p.height;
        });

        // Extrude to absolute height (base + input height)
        const absoluteExtrudedHeight = maxBaseHeight + poly.extrudedHeight;

        const center = Cesium.BoundingSphere.fromPoints(positions).center;
        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(center);
        const labelPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, absoluteExtrudedHeight + 2);

        // Polygon
        viewer.entities.add({
            polygon: {
                hierarchy: positions,
                material: Cesium.Color.CYAN.withAlpha(0.6),
                perPositionHeight: true,
                extrudedHeight: absoluteExtrudedHeight,
                outline: true,
                outlineColor: Cesium.Color.BLACK
            }
        });

        // Label
        viewer.entities.add({
            position: labelPos,
            label: {
                // Show the relative height in the label
                text: `${poly.name}\n(${poly.extrudedHeight}m)`,
                font: '14pt sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -5),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference: Cesium.HeightReference.NONE
            }
        });
    });
}


// ----------------------------------------------------------------------------------
// SAVE / LOAD
// ----------------------------------------------------------------------------------

function savePolygons() {
    if (savedPolygons.length === 0) {
        showMessage("No polygons to save.");
        return;
    }
    const json = JSON.stringify(savedPolygons, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "polygons.json";
    a.click();
    URL.revokeObjectURL(url);
    showMessage("Polygons saved to polygons.json");
}

function loadPolygons(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                savedPolygons = data;

                // When loading, we probably want to clear old entries?
                // Or append? Let's replace for consistency with 'active file'.
                // If user wants append, they'd need more complex UI.

                resetMode();
                viewer.entities.removeAll();
                refreshEntities();

                showMessage(`Loaded ${data.length} polygons.`);
            } else {
                showMessage("Invalid file format.");
            }
        } catch (err) {
            console.error(err);
            showMessage("Error parsing JSON.");
        }
    };
    reader.readAsText(file);
    input.value = ''; // reset
}
