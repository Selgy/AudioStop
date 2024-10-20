import { CEP_Config } from "vite-cep-plugin";
import { version } from "./package.json";


const config: CEP_Config = {
  version,
  id: "com.AudioStop.cep",
  displayName: "Audio Stop",
  symlink: "local",
  port: 3000,
  servePort: 5000,
  startingDebugPort: 8880,
  extensionManifestVersion: 6.0,
  requiredRuntimeVersion: 9.0,
  hosts: [
    { name: "PPRO", version: "[0.0,99.9]" }
  ],
  type: "Panel",
  iconDarkNormal: "./src/assets/light-icon.png",
  iconNormal: "./src/assets/dark-icon.png",
  iconDarkNormalRollOver: "./src/assets/light-icon.png",
  iconNormalRollOver: "./src/assets/dark-icon.png",
  parameters: ["--v=0", "--enable-nodejs", "--mixed-context"],
  width: 500,
  height: 550,

  panels: [
    {
      mainPath: "./main/index.html",
      name: "main",
      panelDisplayName: "Audio Stop",
      autoVisible: false, 
      type: "Custom", 
      startOnEvents: ["com.adobe.csxs.events.ApplicationInitialized", "applicationActive"], 
      height: 1, 
    }


  ],
  build: {
    jsxBin: "off",
    sourceMap: true,
  },
  zxp: {
    country: "US",
    province: "CA",
    org: "MyCompany",
    password: "mypassword",
    tsa: "http://timestamp.digicert.com/",
    sourceMap: false,
    jsxBin: "off",
  },
  installModules: [],
  copyAssets: [
    "./dist/audio_control_server.exe",
    "./dist/icon.ico",
    "./js",
    "./jsx",
  ],
  copyZipAssets: [],
};
export default config;
