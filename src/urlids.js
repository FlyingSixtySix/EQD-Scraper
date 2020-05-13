// urlids.js - Handles URL-article ID mapping.

const fs = require('fs');
const path = require('path');
const { logPart, logf } = require('./utils');

const outputPath = path.join(__dirname, '..', 'output');
const articlesPath = path.join(outputPath, 'articles');
const urlIDsPath = path.join(outputPath, 'urlids.json');

/**
 * The urlids command handler.
 * @param argv The script arguments.
 */
async function urlIDsFn (argv) {
  const urlIDs = await fs.promises.readFile(urlIDsPath, 'utf8').then(file => {
    return JSON.parse(file);
  }).catch(() => {
    return {};
  });
  const dates = fs.readdirSync(articlesPath);
  for (const date of dates) {
    logPart(`Reading articles for ${date}... `);
    const posts = fs.readdirSync(path.join(articlesPath, date));
    for (const post of posts) {
      const metadataText = fs.readFileSync(path.join(articlesPath, date, post, 'metadata.json'), 'utf8');
      const metadata = JSON.parse(metadataText);
      urlIDs[metadata.url.split('/').pop()] = metadata.id;
    }
    logf('done');
  }
  // Save the new URL-IDs.
  logPart('Saving new URL-IDs... ');
  await fs.promises.writeFile(urlIDsPath, JSON.stringify(urlIDs, null, 2));
  logf('done');
}

module.exports = { urlIDsFn }
