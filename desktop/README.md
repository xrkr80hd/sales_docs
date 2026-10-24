# Walker Browser companion — experimental source

This companion is separate from the NEXTDOX website. The website's normal Chrome iframe does **not** gain universal popup containment merely by deploying this folder.

The companion loads NEXTDOX as its shell and uses native browser views for selected tools and their child windows. A restricted preload bridge provides bounds updates, return navigation, and in-pane website confirmations without exposing Node APIs to external sites. Sessions are partitioned by NEXTDOX account. HTTP/HTTPS and blank child windows are supported; external executable protocols are not opened.

## Current validation status

The web application, browser cache tests, and standard regression tests are checked independently. The companion's native integration test currently crashes under the available Linux headless runtime. Its popup, opener, POST-login, and synchronous dialog behavior is **not verified**. No Windows/macOS installer has been built. DriveCentric, DealerCONNECT, Express OMV and Outlook real sign-ins have not been tested. Do not label the companion production-ready or describe popup containment as fixed.

To develop on a desktop with Node installed, run `npm ci` and `npm start` from this directory. `npm test` runs the synthetic native integration test. `WALKER_APP_URL` can point to an authorized local development server; its origin becomes the only trusted app-shell origin. Browser security and renderer sandboxing stay enabled in the companion source. Headless test flags used in the container are not production launch settings.
