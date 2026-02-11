const tileset_url = "../../3DData/bbt/tileset.json";

const DefaultView = {
  lon: 100.42529919805114,
  lat: 13.917106463573209,
  height: 47.18035966062251,
  direction: {
    x: 0.4857370203215632,
    y: -0.08211129403234468,
    z: -0.8702397844740628
  },
  up: {
    x: 0.005975644632311373,
    y: 0.9958667592008702,
    z: -0.09062940797547127
  }
};


const viewer = new Cesium.Viewer("cesiumContainer", {
  imageryProvider: false, //have to be definded unless will error without token
  baseLayerPicker: false, //Must be false if no imageryProvider
  
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  baseLayerPicker: false,
  navigationHelpButton: false,

  timeline: false,
  animation: false,
  fullscreenButton: true,
  vrButton: false,
 
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
  setCameraView(DefaultView, true, 5);
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

  function toggleWidget(name, checkbox) {
    const btn = document.querySelector(".cesium-sceneModePicker-button3D, .cesium-sceneModePicker-button2D, .cesium-sceneModePicker-buttonColumbusView");
    if (checkbox.checked) {
      btn.style.visibility = "visible";
    } else {
       btn.style.visibility = "hidden";
    }
  }

