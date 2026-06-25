const https = require('https');
const fs = require('fs');

const content = fs.readFileSync('./src/core/constants/courseThemes.ts', 'utf-8');
const urls = [...content.matchAll(/url:\s*'([^']+)'/g)].map(m => m[1]);

console.log(`Found ${urls.length} urls to test`);

async function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      // Unsplash might redirect (302) or return 200
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve({ url, ok: true, status: res.statusCode });
      } else {
        resolve({ url, ok: false, status: res.statusCode });
      }
    }).on('error', (e) => resolve({ url, ok: false, error: e.message }));
  });
}

async function run() {
  let bad = [];
  for (const url of urls) {
    const res = await testUrl(url);
    if (!res.ok) {
      console.log(`BAD URL: ${url} (Status: ${res.status || res.error})`);
      bad.push(url);
    }
  }
  console.log(`Done testing. Found ${bad.length} bad URLs.`);
}

run();
