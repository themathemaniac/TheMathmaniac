const https = require('https');
const fs = require('fs');
const path = './src/core/constants/courseThemes.ts';

let content = fs.readFileSync(path, 'utf-8');
const urls = [...content.matchAll(/url:\s*'([^']+)'/g)].map(m => m[1]);

async function isGood(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    }).on('error', () => resolve(false));
  });
}

// Known good ones per category
const fallbacks = {
  comp: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
  phys: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=800&q=80',
  chem: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
  math: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80',
  bio: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
};

async function run() {
  for (const url of urls) {
    const ok = await isGood(url);
    if (!ok) {
      console.log(`Fixing: ${url}`);
      let fb = fallbacks.comp;
      if (content.substring(content.indexOf(url)-100, content.indexOf(url)).includes('phys_')) fb = fallbacks.phys;
      if (content.substring(content.indexOf(url)-100, content.indexOf(url)).includes('chem_')) fb = fallbacks.chem;
      if (content.substring(content.indexOf(url)-100, content.indexOf(url)).includes('math_')) fb = fallbacks.math;
      if (content.substring(content.indexOf(url)-100, content.indexOf(url)).includes('bio_')) fb = fallbacks.bio;
      
      content = content.replace(url, fb);
    }
  }
  fs.writeFileSync(path, content);
  console.log('Done replacing bad URLs');
}
run();
