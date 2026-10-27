# Solanum website

Static website source for https://solanum.ltd/, hosted by the existing Cloudflare Pages project `solanum-site` using Direct Upload. There is no framework or build step.

The Capsid page uses one local JavaScript module for the nine-specimen showcase. Its artwork is exported from the existing Capsid renderer. The showcase uses one video element, pauses on request, unloads when offscreen or hidden, and offers static manual navigation under reduced motion.

Run `npm test` for the dependency-free showcase lifecycle tests. No dependency install is needed for those tests.

Publish the reviewed HTML pages, `assets/`, and `_redirects`. Do not upload `.git`, test files, local tooling, or account configuration. Legacy Bench paths redirect to Capsid. Existing CNAME and nojekyll files are preserved for compatibility. The deployed upload and exact-byte verification are recorded separately in the launch task.

Capsid and Nidus app code and releases live in separate repositories. Their source licenses do not establish a blanket license for this website, branding, or third-party services.
