
  import { tileset_url } from './data.js';
  
  let tileset;
  
  let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Y2NlMzI0MC0zZWRkLTRhYWUtOTAxOC0zNDZjZjM4NGU4YWUiLCJpZCI6NzQ2MDYsImlhdCI6MTYzNzkwODE4NH0.e4dMa869gUTesmgVtX_1OYjAi5ScvHrkXyL-LDJqrz4"
  Cesium.Ion.defaultAccessToken = token;
  
  const viewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    imageryProvider: true,
    baseLayerPicker: true, 
    timeline: true,
    animation: true,
  });
  
  
  viewer.scene.globe.show = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
  viewer.scene.sun = new Cesium.Sun();
  viewer.scene.moon = new Cesium.Moon();
  
  Cesium.Cesium3DTileset.fromUrl(tileset_url) //tileset_url from data.js
  .then((ts) => {
    tileset = ts;
    viewer.scene.primitives.add(tileset);
    viewer.zoomTo(tileset);
  })
  .catch((error) => {
    console.error("Failed to load tileset:", error);
  });

