
  import { tileset_url } from './data.js';
  
  let token = "<your_access_token>";
  
  Cesium.Ion.defaultAccessToken = token;
  
  const viewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    imageryProvider: true,
    
    geocoder: true,
    homeButton: true,
    sceneModePicker: true,
    baseLayerPicker: true,
    navigationHelpButton: true,

    timeline: true,
    animation: true,
    fullscreenButton: true,
    vrButton: true,
  });
  
  
  viewer.scene.globe.show = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
  viewer.scene.sun = new Cesium.Sun();
  viewer.scene.moon = new Cesium.Moon();
  
  Cesium.Cesium3DTileset.fromUrl(tileset_url) //tileset_url from data.js
  .then((ts) => {
    viewer.scene.primitives.add(ts);
    viewer.zoomTo(ts);
  })
  .catch((error) => {
    console.error("Failed to load tileset:", error);
  });

