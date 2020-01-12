import * as request from 'requestretry';
import * as logger from './logger';
import * as cheerio from 'cheerio';
import * as utils from './utils';
import * as fs from 'fs';
import * as path from 'path';
import moment = require('moment');
import * as workerFarm from 'worker-farm';

const worker = workerFarm({
  maxConcurrentCallsPerWorker: Infinity,
  maxCallTime: Infinity
}, require.resolve('./downloader.ts'));

function getTotalArticles($: CheerioStatic): number {
  return parseInt($('openSearch\\:totalResults').text());
}

function getPrevURL($: CheerioStatic): string {
  return $('link[rel="prev"]').attr('href');
}

function getNextURL($: CheerioStatic): string {
  return $('link[rel="next"]').attr('href');
}

function getArticlesInSearch($: CheerioStatic): Cheerio {
  return $('entry');
}

function findNode($: CheerioElement, tagName: string) {
  return $.childNodes.find(node => node.tagName === tagName);
}

function findNodeWhere($: CheerioElement, tagName: string, where: string, is: string) {
  return $.childNodes.find(node => node.tagName === tagName && node.attribs[where] === is)
}

function findNodes($: CheerioElement, tagName: string) {
  return $.childNodes.filter(node => node.tagName === tagName);
}

function getArticleMetadata($: CheerioElement) {
  const postID = findNode($, 'id').firstChild.data.match(/post-([0-9]+)/)[1];
  const publishDate = findNode($, 'published').firstChild.data;
  const updatedDate = findNode($, 'updated').firstChild.data;
  const categories = findNodes($, 'category').map(e => e.attribs['term']);
  const title = postID + '-' + (findNodeWhere($, 'link', 'rel', 'alternate').attribs['title'].trim() ?? 'untitled');
  const content = findNode($, 'content')?.firstChild?.data;
  const replyCount = parseInt(findNode($, 'thr:total')?.firstChild?.data);
  const link = findNodeWhere($, 'link', 'rel', 'alternate').attribs['href'];
  const authorNode = findNode($, 'author');
  const author = {
    name: findNode(authorNode, 'name').firstChild.data,
    profile: findNode(authorNode, 'uri')?.firstChild.data,
    avatar: utils.cleanProtocol(findNode(authorNode, 'gd:image').attribs['src'])
  };
  return { postID, publishDate, updatedDate, categories, title, content, replyCount, link, author };
}

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

export class ArticlesByLabelOptions {
  label: string;
  iteration: number = 0;
  totalArticles: number;
  nextURL: string;
  maxResults: number = 500;
  
  buffer: Array<any> = [];

  constructor(label: string) {
    this.label = label;
  }
}

export async function getArticlesByLabel(options: string | ArticlesByLabelOptions): Promise<Array<object>> {
  // If given a label (string), convert options to an instance of ArticlesByLabelOptions.
  if (typeof options === 'string') {
    options = new ArticlesByLabelOptions(options);
  }
  let nextURL = options.nextURL;
  if (options.iteration === 0) {
    nextURL = utils.generateLabelURL(options.label)
    .maxResults(options.maxResults)
    .build();
  }
  if (fs.existsSync(path.join(__dirname, '..', 'bak')) && options.iteration === 0) {
    nextURL = fs.readFileSync(path.join(__dirname, '..', 'bak'), 'utf8');
  }
  options.iteration++;
  // URL to request is the default (if first iteration), otherwise the specified next URL.
  logger.debug('URL to search with:', nextURL);
  const res = await request(nextURL);
  if (res.statusCode !== 200) {
    logger.fatal('Article by label returned non-200 status code; cannot continue');
    process.exit(1);
  }
  const $ = cheerio.load(res.body, { xmlMode: true });
  options.totalArticles = options.totalArticles || getTotalArticles($);
  options.nextURL = getNextURL($);
  fs.writeFileSync(path.join(__dirname, '..', 'bak'), getPrevURL($) || nextURL);
  const entries = getArticlesInSearch($);
  const startIndexMatches = /start-index=([\d]+)/.exec(nextURL);
  let count = 0;
  if (startIndexMatches != null) {
    count = parseInt(startIndexMatches[1]);
  }
  for (const entry of entries.toArray()) {
    count++;
    const metadata = getArticleMetadata(entry);
    logger.info(`[${count}/${options.totalArticles}] `.yellow + 'Currently working on article "' + metadata.title + '"...');
    const content = metadata.content;
    delete metadata.content;
    const pubDate = moment(metadata.publishDate);
    const year = pubDate.get('year').toString();
    const month = (pubDate.get('month') + 1).toString();
    const month2 = pubDate.get('month').toString();
    const shortPath = path.join(year, month, utils.cleanArticleName(metadata.title, true));
    const shortPath2 = path.join(year, month2, utils.cleanArticleName(metadata.title, true));
    const shortPath3 = path.join(year, month2, utils.cleanArticleName(metadata.title, false));
    const folder = path.join(__dirname, '..', 'data', shortPath);
    const folder2 = path.join(__dirname, '..', 'data', shortPath2);
    const folder3 = path.join(__dirname, '..', 'data', shortPath3);
    if (fs.existsSync(folder) ||
        (fs.existsSync(folder.replace(metadata.postID + '-', '')) &&
          (!folder.replace(metadata.postID + '-', '').endsWith('\\') &&
          !folder.replace(metadata.postID + '-', '').endsWith('/'))) ||
        fs.existsSync(folder2) ||
        (fs.existsSync(folder2.replace(metadata.postID + '-', '')) &&
          (!folder.replace(metadata.postID + '-', '').endsWith('\\') &&
          !folder.replace(metadata.postID + '-', '').endsWith('/'))) ||
        fs.existsSync(folder3) ||
        (fs.existsSync(folder3.replace(metadata.postID + '-', '')) &&
          (!folder.replace(metadata.postID + '-', '').endsWith('\\') &&
          !folder.replace(metadata.postID + '-', '').endsWith('/')))) {
      //logger.info('Article already exists; skipping...');
      continue;
    }
    fs.mkdirSync(folder2, { recursive: true });
    // First save the data already presented to us.
    fs.writeFileSync(path.join(folder2, 'metadata.json'), JSON.stringify(metadata, null, 2));
    logger.info('metadata.json saved');
    if (typeof content !== 'undefined') {
      fs.writeFileSync(path.join(folder2, 'short.html'), content);
      logger.info('short.html saved');
    } else {
      logger.warn('Metadata does not have a "content" field; skipping short.html...');
    }
    // Now save the full article page.
    const articleRes = await request(metadata.link);
    if (articleRes.statusCode !== 200) {
      logger.error('Article page returned non-200 status code; skipping...');
      continue;
    }
    fs.writeFileSync(path.join(folder2, 'content.html'), articleRes.body);
    logger.info('content.html saved');
    // Now extract stuff from them.
    const article$ = cheerio.load(articleRes.body);
    const extracted = extractArticle(article$);
    fs.writeFileSync(path.join(folder2, 'extracted.json'), JSON.stringify(extracted, null, 2));
    logger.info('extracted.json saved');
  }
  options.buffer.push(...$('entry').toArray());
  if (typeof options.nextURL !== 'undefined') {
    await getArticlesByLabel(options);
  }
  return options.buffer;
}
