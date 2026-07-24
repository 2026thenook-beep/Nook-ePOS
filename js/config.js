(function () {
  'use strict';
  var RELEASE = window.NOOK_RELEASE || {};
  window.NOOK_CONFIG = {
    appName: RELEASE.appName || 'The Nook ePOS',
    appVersion: RELEASE.appVersion || 'unknown',
    frontendVersion: RELEASE.appVersion || 'unknown',
    backendVersion: RELEASE.appVersion || 'unknown',
    databaseVersion: RELEASE.databaseVersion || 'unknown',

    // Paste the deployed Google Apps Script Web App URL here after deployment,
    // or enter it in the Settings screen on each device.
    scriptUrl: 'PASTE_YOUR_DEPLOYED_GOOGLE_SCRIPT_WEB_APP_URL_HERE',

    // Live changes must be confirmed by Google Sheets before they are treated as saved.
    strictServerPersistence: true,

    // Keep false for live use. Enable only for deliberate browser-only testing.
    allowLocalTestMode: false
  };
})();
