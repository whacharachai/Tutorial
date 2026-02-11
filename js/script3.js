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
  imageryProvider: false,
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
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function(e) {
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

function getCamData(camData){
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

  // Reset the input so onchange will fire next time even if the same file is chosen
  input.value = '';
}