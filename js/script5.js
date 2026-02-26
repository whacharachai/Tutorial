const tileset_url = "../../3DData/bbt/tileset.json";

const DefaultView =
{
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

//cesium Toolbar Home Button
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function (e) {
    e.cancel = true;
    setCameraView(DefaultView, true, 3);
});

const toolbar = document.querySelector(".cesium-viewer-toolbar");

// Create save button
const btnsave = document.createElement("button");

btnsave.className = "cesium-button ToolbarBtn";
btnsave.innerHTML = `<i class="bi bi-save2-fill"></i>`;
toolbar.appendChild(btnsave);

btnsave.addEventListener("click", () => {
    saveCameraView();
});

// Create load button
const input = document.createElement("input");
input.type = "file";
input.className = "cesium-toolbar-input";
toolbar.appendChild(input);
input.addEventListener("change", () => {
    handleCameraFile(input);
});

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

function saveCameraView() {
    const camera = viewer.camera;

    const camData = {
        lon: Cesium.Math.toDegrees(camera.positionCartographic.longitude),
        lat: Cesium.Math.toDegrees(camera.positionCartographic.latitude),
        height: camera.positionCartographic.height,
        direction: {
            x: camera.direction.x,
            y: camera.direction.y,
            z: camera.direction.z
        },
        up: {
            x: camera.up.x,
            y: camera.up.y,
            z: camera.up.z
        }
    };

    const json = JSON.stringify(camData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cameraView.json";
    a.click();
    URL.revokeObjectURL(url);
}

function loadCameraFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const camData = JSON.parse(e.target.result);
        viewer.camera.flyTo({
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
            },
            duration: 5
        });
    };
    reader.readAsText(file);
}

function handleCameraFile(input) {
    const file = input.files[0];
    if (!file) return;
    loadCameraFromFile(file);
    input.value = ''; // Reset the input so onchange will fire next time even if the same file is chosen
}

let msgTimeoutId = null;

function showMessage(text, timeout = 3000) {
    const msgDiv = document.getElementById("Msg");
    msgDiv.innerText = text;
    msgDiv.style.display = "block";

    if (msgTimeoutId) {
        clearTimeout(msgTimeoutId);
    }

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

let mode = 'NONE'; // 'PICK', 'DIST', 'AREA'
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
let coordHandler = null;
let pickingCoords = false;

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

    mode = 'NONE';
}

function pickCoordinate() {
    resetMode();
    mode = 'PICK';

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


// ----------------------------------------------------------------------------------
// MEASUREMENT FEATURE
// ----------------------------------------------------------------------------------

var activeShapePoints = [];
var activeShape;
var floatingPoint;

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

function clearMeasurements() {
    resetMode();
    viewer.entities.removeAll();
    showMessage("All measurements cleared.");
}

function createPoint(worldPosition) {
    var point = viewer.entities.add({
        position: worldPosition,
        point: {
            color: Cesium.Color.YELLOW,
            pixelSize: 10,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
    return point;
}

function drawShape(positionData) {
    var shape;
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
    }
    return shape;
}


function setupInputHandlers() {
    // Clear any existing action
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    handler.setInputAction(function (event) {
        // Pick the position on the globe/tileset
        // Use pickPosition to get the correct height on 3D tiles
        var earthPosition = viewer.scene.pickPosition(event.position);

        if (Cesium.defined(earthPosition)) {
            if (activeShapePoints.length === 0) {
                floatingPoint = createPoint(earthPosition);
                activeShapePoints.push(earthPosition);

                var dynamicPositions = new Cesium.CallbackProperty(function () {
                    if (mode === 'AREA') {
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
        terminateShape();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function terminateShape() {
    // If we were drawing, remove the handlers and finalize coordinates
    // Check if we have an active shape

    if (activeShapePoints.length > 0) {
        activeShapePoints.pop(); // Remove floating point

        // Re-draw as static entity
        drawShape(activeShapePoints);

        // Calculate
        if (mode === 'DIST') {
            let dist = 0;
            for (let i = 0; i < activeShapePoints.length - 1; i++) {
                dist += Cesium.Cartesian3.distance(activeShapePoints[i], activeShapePoints[i + 1]);
            }
            showMessage(`Total Distance: ${dist.toFixed(2)} meters`, 0); // 0 = no timeout

            // Add label at the last point
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

        } else if (mode === 'AREA') {
            // Simple area approximation for small non-curved polygons
            // Or projection to 2D
            const area = computePolygonArea(activeShapePoints);
            showMessage(`Approx Area: ${area.toFixed(2)} sq meters`, 0);

            // Add label at center (average of points)
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

        // Cleanup dynamics
        viewer.entities.remove(activeShape);
        viewer.entities.remove(floatingPoint);
        activeShape = undefined;
        floatingPoint = undefined;
        activeShapePoints = [];
    }

    // Disable handlers
    resetMode();
}

// Simple area calculation via projection to local tangent plane
function computePolygonArea(positions) {
    if (positions.length < 3) return 0;

    // Create a tangent plane from the points
    const tangentPlane = Cesium.EllipsoidTangentPlane.fromPoints(positions, Cesium.Ellipsoid.WGS84);

    // Project points onto the 2D plane
    const flatPositions = tangentPlane.projectPointsOntoPlane(positions);

    // flatPositions is an array of Cartesian2

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
