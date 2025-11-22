import type { CEP_Config } from "vite-cep-plugin";
import { version } from "./package.json";

const config: CEP_Config = {
  version,
  id: "com.selgy.audiostop",
  displayName: "AudioStop",
  symlink: "local",
  port: 3000,
  servePort: 5000,
  startingDebugPort: 9090,
  extensionManifestVersion: 6.0,
  requiredRuntimeVersion: 9.0,
  hosts: [{ name: "PPRO", version: "[0.0,99.9]" }],
  type: "Panel",
  iconDarkNormal: "./src/assets/light-icon.png",
  iconNormal: "./src/assets/dark-icon.png",
  iconDarkNormalRollOver: "./src/assets/light-icon.png",
  iconNormalRollOver: "./src/assets/dark-icon.png",
  parameters: [
    "--v=0",
    "--enable-nodejs",
    "--mixed-context",
    "--allow-file-access",
    "--disable-web-security",
    "--allow-file-access-from-files",
  ] as unknown as CEP_Config["parameters"],
  width: 400,
  height: 600,

  panels: [
    {
      mainPath: "./main/index.html",
      name: "main",
      id: "com.selgy.audiostop.main",
      panelDisplayName: "AudioStop",
      autoVisible: true,
      width: 400,
      height: 600,
      minWidth: 350,
      minHeight: 400,
      maxWidth: 800,
      maxHeight: 1000,
      type: "Modeless",
    },
    {
      mainPath: "./background/index.html",
      name: "background",
      id: "com.selgy.audiostop.background",
      autoVisible: false,
      type: "Custom",
      startOnEvents: ["com.adobe.csxs.events.ApplicationInitialized", "applicationActive"],
      height: 1,
    },
  ],
  build: {
    jsxBin: "off",
    sourceMap: true,
  },
  zxp: {
    country: "FR",
    province: "CA",
    org: "Selgy",
    password: "audiostop2024",
    tsa: "http://timestamp.digicert.com/",
    sourceMap: false,
    jsxBin: "off",
  },
  installModules: [],
  copyAssets: ["./js", "./jsx", "./exec", "./js/lib", "./list_audio_apps.py"],
  copyZipAssets: [],
};

export default config;
