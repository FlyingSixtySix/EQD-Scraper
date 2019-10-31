import * as request from 'requestretry';
import * as logger from './logger';
import * as cheerio from 'cheerio';
import * as utils from './utils';

function getTotalArticles($: CheerioStatic): number {
  return parseInt($('openSearch\\:totalResults').text());
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

function getArticleMetadata($: CheerioElement): object {
  const author = findNode($, 'author');
  return {
    postID: findNode($, 'id').firstChild.data.match(/post-([0-9]+)/)[1],
    publishDate: findNode($, 'published').firstChild.data,
    updatedDate: findNode($, 'updated').firstChild.data,
    categories: findNodes($, 'category').map(e => e.attribs['term']),
    title: findNode($, 'title').firstChild.data,
    content: findNode($, 'content').firstChild.data,
    replyCount: parseInt(findNode($, 'thr:total').firstChild.data),
    link: findNodeWhere($, 'link', 'rel', 'alternate').firstChild.data,
    author: {
      name: findNode(author, 'name').firstChild.data,
      profile: findNode(author, 'uri').firstChild.data,
      avatar: findNode(author, 'gd:image').attribs['src']
    }
  }
/*   const metadata = {
    postID: $('id').text().match(/post-([0-9]+)/)[1],
    publishDate: $('published').text(),
    updatedDate: $('updated').text(),
    categories: $('category').toArray().map(e => e.attribs['term']),
    title: $('title').text(),
    content: parseInt($('thr\\:total').text()),
    replyCount: $('link[rel="alternate"]').attr('href'),
    link: $('link[rel="alternate"]').attr('href'),
    author: {
      name: $('author > name').text(),
      profile: $('author > uri').text(),
      avatar: $('author > gd\\:image').attr('src')
    }
  }; */
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
  logger.debug('Iteration', options.iteration);
  let nextURL = options.nextURL;
  if (options.iteration === 0) {
    nextURL = utils.generateLabelURL(options.label)
    .maxResults(options.maxResults)
    .build();
  }
  logger.debug(options.buffer.length);
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
  const entries = getArticlesInSearch($);
  entries.map((i, e) => {
    const metadata = getArticleMetadata(e);
    logger.debug(metadata);
  })
  // TODO: Save articles on current search page
  // ...
  options.buffer.push(...$('entry').toArray());
  if (typeof options.nextURL !== 'undefined') {
    await getArticlesByLabel(options);
  }
  return options.buffer;
}
