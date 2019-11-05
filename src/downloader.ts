import * as request from 'requestretry';
import * as logger from './logger';
import * as cheerio from 'cheerio';
import * as utils from './utils';
import * as fs from 'fs';
import * as path from 'path';
import moment = require('moment');

function extractArticle($: CheerioStatic) {
  const youtubeEmbeds = $('.post-body iframe[src*="youtube.com/embed/"], .post-body iframe[src*="youtube.com/watch?v="], .post-body iframe[src*="youtu.be/"]');
  const cleanedEmbedSources = youtubeEmbeds.toArray()
    .map(e => utils.cleanProtocol(e.attribs['src']));
  const links = $('.post-body a');
  const cleanedLinkHrefs = links.toArray()
    .filter(e => typeof e.attribs['href'] !== 'undefined')
    .map(e => utils.cleanProtocol(e.attribs['href']));
  const images = $('.post-body img');
  const cleanedImageSources = images.toArray()
    .map(e => utils.cleanProtocol(e.attribs['src']));
  return {
    cleanedEmbedSources,
    cleanedLinkHrefs,
    cleanedImageSources
  };
}

export async function downloadArticle(folder: string, content, metadata) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'metadata.json'), JSON.stringify(metadata, null, 2));
  logger.info('metadata.json saved');
  if (typeof content !== 'undefined') {
    fs.writeFileSync(path.join(folder, 'short.html'), content);
    logger.info('short.html saved');
  } else {
    logger.warn('Metadata does not have a "content" field; skipping short.html...');
  }
  // Now save the full article page.
  const articleRes = await request(metadata.link);
  if (articleRes.statusCode !== 200) {
    logger.error('Article page returned non-200 status code; skipping...');
    return;
  }
  fs.writeFileSync(path.join(folder, 'content.html'), articleRes.body);
  logger.info('content.html saved');
  // Now extract stuff from them.
  const article$ = cheerio.load(articleRes.body);
  const extracted = extractArticle(article$);
  fs.writeFileSync(path.join(folder, 'extracted.json'), JSON.stringify(extracted, null, 2));
  logger.info('extracted.json saved');
}

module.exports = async (folder: string, content, metadata) => downloadArticle(folder, content, metadata);
