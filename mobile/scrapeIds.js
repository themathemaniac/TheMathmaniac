const https = require('https');

function fetchIds(query) {
  return new Promise((resolve) => {
    https.get(`https://unsplash.com/s/photos/${query}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const matches = [...data.matchAll(/"id":"([a-zA-Z0-9_\-]+)"/g)].map(m => m[1]);
        // Also sometimes they are in the URL path /photos/xxxxx
        const pathMatches = [...data.matchAll(/href="\/photos\/[a-zA-Z0-9_\-]+-([a-zA-Z0-9_\-]+)"/g)].map(m => m[1]);
        resolve([...new Set([...matches, ...pathMatches])]);
      });
    }).on('error', () => resolve([]));
  });
}

async function run() {
  const mathIds = await fetchIds('math');
  console.log('Math IDs:', mathIds.slice(0, 10));

  const bioIds = await fetchIds('biology');
  console.log('Biology IDs:', bioIds.slice(0, 10));
}

run();
