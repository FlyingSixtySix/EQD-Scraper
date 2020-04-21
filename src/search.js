// search.js - Scrapes the EQD Atom feed to get information.

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const request = require('request-promise-native');
const { log, logf, pad } = require('./utils');
const { extract } = require('./extract');

const config = require('../config');

const pathBase = `/blogger/v3/blogs/${config.blogID}/posts`;
const urlBase = `https://www.googleapis.com${pathBase}?key=${config.bloggerAPIKey}`;

/**
 * @typedef {object} Options The search and extraction options.
 * @property {string} label The label (or "category").
 * @property {number} maxPerPage The maximum amount of articles per page. Limit is 500.
 * @property {Date} specificDate The specific date to search on.
 * @property {InclusiveDateRange} dateRange A date range to search on.
 * @property {boolean} separateYTLinks Separates all YouTube links into a separate search category.
 * @property {boolean} overwrite Whether to overwrite existing files or halt.
 */

/**
 * @typedef {object} InclusiveDateRange An inclusive date range.
 * @property {Date} startDate The beginning date.
 * @property {Date} endDate The ending date.
 */

/**
 * Formats a URL with the provided search options.
 * @param {Options} options The search and extraction options.
 * @returns {URL} The formatted search URL.
 */
function formatSearchURL (options) {
  const url = new URL(urlBase);
  // Search by date
  if (options.specificDate != null) {
    url.searchParams.set('startDate', options.specificDate.toISOString());
    // Add one day to the specificDate
    const dayAhead = new Date(options.specificDate.getTime() + (1000 * 60 * 60 * 24));
    url.searchParams.set('endDate', dayAhead.toISOString());
  }
  if (options.dateRange != null) {
    url.searchParams.set('startDate', options.dateRange.startDate.toISOString());
    url.searchParams.set('endDate', options.dateRange.endDate.toISOString());
  }
  // Search by label
  if (options.labels != null) {
    url.searchParams.set('labels', options.labels);
  }
  url.searchParams.set('maxResults', options.maxPerPage);
  return url;
}

/**
 * Maximum iterations, set by command-line argument --max-iterations.
 */
let maxIter;

/**
 * The current search iteration.
 */
let searches = 0;

/**
 * @typedef {object} Page
 * @property {string} kind The resource kind.
 * @property {string} nextPageToken The next page token.
 * @property {Array<Post>} items The items.
 * @property {string} etag The etag.
 */

/**
 * @typedef {object} Post
 * @property {string} kind The resource kind.
 * @property {string} id The post ID.
 * @property {BasicBlogInfo} blog The blog info.
 * @property {string} published The publish date.
 * @property {string} updated The updated date.
 * @property {string} etag The etag.
 * @property {string} url The post URL.
 * @property {string} selfLink The API post URL.
 * @property {string} title The post title.
 * @property {string} content The post content.
 * @property {AuthorInfo} author The post author info.
 * @property {ReplyInfo} replies The post replies.
 * @property {Array<string>} labels The post labels.
 */

/**
 * @typedef {object} BasicBlogInfo
 * @property {string} id The blog ID.
 */

/**
 * @typedef {object} AuthorInfo
 * @property {string} id The author ID.
 * @property {string} displayName The author name.
 * @property {string} url The author URL.
 * @property {BasicImageInfo} image The author's profile picture.
 */

/**
 * @typedef {object} BasicImageInfo
 * @property {string} url The image URL.
 */

/**
 * @typedef {object} ReplyInfo
 * @property {string} totalItems The total amount of replies.
 * @property {string} selfLink The link to the post's comments.
 */

/**
 * Saved
 * @param {Page} page The page.
 * @param {Options} options The search and extraction options.
 */
async function saveData (page, options) {
  for (const item of page.items) {
    logf(`Saving article ${item.title}... `);
    const published = new Date(item.published);
    const year = published.getFullYear();
    const month = published.getMonth() + 1;
    const { articlesPath } = require('./index');
    const articlePath = path.join(articlesPath, `${year}-${pad(month)}`, item.id);
    const bodyPath = path.join(articlePath, 'body.html');
    const metadataPath = path.join(articlePath, 'metadata.json');
    const extractedPath = path.join(articlePath, 'extracted.json');
    // If the article directory already exists, and overwriting is disabled, halt
    if (fs.existsSync(articlePath) && !options.overwrite) {
      log('skipped and halted (-O to overwrite)')
      return false;
    }
    // Create the article directory
    await fs.promises.mkdir(articlePath, { recursive: true }).catch(err => {
      if (err.code === 'EEXIST') {
        log('Article output directory already exists.');
      } else {
        log('Could not create article output directory.');
        throw err;
      }
    });
    // Save body.html
    await fs.promises.writeFile(bodyPath, item.content, 'utf8');
    // Delete content so it isn't duplicated in metadata
    // Save metadata.json
    const metadata = JSON.parse(JSON.stringify(item));
    delete metadata.content;
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    // Save extracted.json
    const extracted = extract(item.content, options);
    await fs.promises.writeFile(extractedPath, JSON.stringify(extracted, null, 2));
    // And we're done!
    log('done');
  }
  return true;
}

/**
 * Loops over each page in the search results.
 * @param {URL} url The formatted search URL.
 * @param {Array<object>} data The recursive dataset.
 * @param {object} options The program options.
 * @returns {Array<object>} The dataset.
 */
async function loopPages (url, data, options) {
  searches++;
  log(`GET ${url.href}`);
  let response = await request(url.href).catch(err => {
    log('Unable to complete search loop! Error(s):');
    const errParsed = JSON.parse(err.error);
    if (errParsed.error.errors != null) {
      JSON.parse(err.error).error.errors.forEach(err => {
        log(`    ${err.location} :: ${err.message}`);
      });
    } else {
      log(`    ${errParsed.error.code} :: ${errParsed.error.message}`);
    }
    // TODO: Save progress!
    process.exit(1);
  });
  // Parse the data on the page.
  response = JSON.parse(response);
  // Save the data.
  const overwritten = !(await saveData(response, options));
  if (overwritten) {
    return data;
  }
  // Push all the data on this page to the dataset.
  data.push(response);
  // If there's a next page, continue the cycle
  if (response.nextPageToken != null && searches < maxIter) {
    url.searchParams.set('pageToken', response.nextPageToken);
    await loopPages(url, data, options);
  }
  // Otherwise... we've finished
  return data;
}

/**
 * Searches for articles given the specified search options.
 * @param {Options} options The search and extraction options.
 * @returns {Array<object>} The dataset.
 */
async function search (options) {
  maxIter = options.maxIter;
  const url = formatSearchURL(options);
  return loopPages(url, [], options);
}

module.exports = { search };
