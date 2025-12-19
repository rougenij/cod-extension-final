const fs = require("fs");
const path = require("path");
const { minify } = require("terser");
const CleanCSS = require("clean-css");

const distDir = path.join(__dirname, "dist");

// Create dist directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Files to process
const htmlFiles = ["panel.html", "video.html", "config.html"];
const cssFiles = ["panel.css", "video.css", "config.css"];
const jsFiles = ["panel.js", "video.js", "config.js"];

async function build() {
  console.log("Building extension...\n");

  // Copy and minify HTML files
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), "utf8");
    // Simple HTML minification - remove extra whitespace
    const minified = content
      .replace(/\s+/g, " ")
      .replace(/>\s+</g, "><")
      .replace(/<!--.*?-->/g, "");
    fs.writeFileSync(path.join(distDir, file), minified);
    console.log(`✓ ${file}`);
  }

  // Minify CSS files
  const cleanCSS = new CleanCSS({ level: 2 });
  for (const file of cssFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), "utf8");
    const minified = cleanCSS.minify(content);
    fs.writeFileSync(path.join(distDir, file), minified.styles);
    console.log(`✓ ${file}`);
  }

  // Minify JS files
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), "utf8");
    try {
      const minified = await minify(content, {
        compress: true,
        mangle: true,
      });
      fs.writeFileSync(path.join(distDir, file), minified.code);
      console.log(`✓ ${file}`);
    } catch (err) {
      console.error(`Error minifying ${file}:`, err.message);
      // Copy unminified on error
      fs.writeFileSync(path.join(distDir, file), content);
    }
  }

  console.log("\n✅ Build complete! Files are in the dist/ folder.");
  console.log("Zip the contents of dist/ and upload to Twitch.");
}

build().catch(console.error);
