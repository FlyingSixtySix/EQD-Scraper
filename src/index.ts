// Best of luck to anyone who can actually read and understand this...
// because I sure won't in a few days!

import * as url from 'url';
import * as request from 'requestretry';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as yargs from 'yargs';
import * as moment from 'moment';
import * as path from 'path';
import 'colors';

// EQD update-min/max params do not like positive timezone offsets; force UTC
const eqdDateStrFmt = 'YYYY-MM-DD[T]HH:mm:ss[-00:00]'

const args = yargs
  .command('', 'Utility to scrape content from Equestria Daily')
  .option('labels', {
    alias: 'l',
    type: 'array',
    description: 'The labels to search under',
    default: ['']
  })
  .option('pagemax', {
    alias: 'pm',
    type: 'number',
    description: 'The maximum amount of results per page',
    default: 50
  })
  .option('mindate', {
    type: 'string',
    alias: 'min',
    description: 'The minimum page date to search within',
    default: moment.utc(0).format(eqdDateStrFmt)
  })
  .option('maxdate', {
    alias: 'max',
    type: 'string',
    description: 'The maximum page date to search within',
    default: moment.utc().format(eqdDateStrFmt)
  })
  .option('overwrite', {
    alias: 'o',
    type: 'boolean',
    description: 'Whether the current data files should be overwritten',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Enables verbose outputting',
    default: false
  })
  .option('saveby', {
    alias: 's',
    type: 'string',
    description: 'The file structure to save articles under',
    default: 'namedir'
  })
  .option('resume', {
    alias: 'r',
    type: 'boolean',
    description: 'Resumes from the article number in data/bak.json.',
    default: true
  })
  // TODO: Clean up usage
  .usage('$0 [--label -l "Label 1" ..."label"] [--mindate -min YYYY-MM-DD] [--maxdate -max YYYY-MM-DD] [--overwrite -o] [--verbose -v] [--saveby -s ext/name/namedir]')
  .version()
  .argv

const baseURL = 'https://www.equestriadaily.com';

// https://www.equestriadaily.com/search/label/Media?updated-max=2019-10-10T19:38:00-07:00&max-results=50&start=50&by-date=false&m=1
// update-max is the bottom-most post's publish date
// use in combination with start - which is the offset

async function saveBackup(data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path.join('data', 'bak.json'), JSON.stringify(data, null, 2), err => err ? reject() : resolve());
  });
}

async function loadBackup() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join('data', 'bak.json'), 'utf8', (err, data) => {
      if (!err) {
        // The backup exists!
        resolve(JSON.parse(data));
      } else if (err.code === 'ENOENT') {
        // The backup doesn't exist; we can safely continue.
        resolve(null);
      }
      reject(err);
    });
  });
}

// The page number
let page = 0;
let hasLoadedBackup = false;

/**
 * Aggregates all articles found under the specified label.
 * @param label The label to search under.
 * @param pages The current page buffer.
 * @param updatedMax The current maximum date.
 * @param offset The page offset.
 */
// NOTE: I don't think the offset matters... will visit later
async function getArticlesByLabel(label = '', pages = [], updatedMax = moment.utc(args.maxdate).format(eqdDateStrFmt), offset = 0): Promise<Array<Object>> {
  let updatedMin = moment.utc(args.mindate).format(eqdDateStrFmt);
  let start = offset;
  if (!hasLoadedBackup) {
    hasLoadedBackup = true;
    const bak = await loadBackup();
    console.log('Backup loaded!');
    // If the backup is valid, use the values in that
    if (bak != null) {
      if (typeof bak['updated-min'] !== 'undefined') {
        updatedMin = bak['updated-min'];
      }
      if (typeof bak['updated-max'] !== 'undefined') {
        updatedMax = bak['updated-max'];
      }
      if (typeof bak['start'] !== 'undefined') {
        start = bak['start'];
      }
      if (typeof bak['page'] !== 'undefined') {
        page = bak['page'];
      }
      if (typeof bak['pages'] !== 'undefined') {
        pages = bak['pages'];
      }
    } 
  } else {
    // If the backup was loaded, save a new one
    // This is called on the second iteration onwards
    await saveBackup({
      'updated-min': updatedMin,
      'updated-max': updatedMax,
      start,
      page,
      pages
    });
  }
  page++;
  console.log(`Currently on page ${page.toString().yellow}.`);
  const searchURL = new url.URL('/search/label/' + label, baseURL);
  const searchParams = {
    m: 1,
    'max-results': args.pagemax,
    'updated-min': updatedMin,
    'updated-max': updatedMax,
    start
  };
  // Apply searchParams to the actual search parameters
  for (const param in searchParams) {
    searchURL.searchParams.set(param, searchParams[param]);
  }
  if (args.verbose) console.log(`Sending GET request to ${searchURL.href.underline}...`);
  // Send the request!
  const res = await request(searchURL.href);
  // If there was an issue, break everything
  if (res.statusCode !== 200) {
    throw new Error('website did not return 200');
  }
  // Load the HTML into Cheerio, granting us jQuery-like access to the page
  const $ = cheerio.load(res.body);
  // Get all of the "original post" dates
  const articles = $('.timestamp-link');
  console.log(`There are ${articles.length.toString().yellow} articles on this page.`);
  // Format all of the articles into an array of objects with link and date fields
  let articlesArr = articles.get().map(e => {
    return {
      link: e.attribs['href'],
      date: e.firstChild.attribs['title']
    };
  });
  let shouldStop = false;
  // This is to make sure we aren't saving articles with a date below the specified minimum date
  articlesArr = articlesArr.filter(article => {
    if (moment(article.date).isBefore(args.maxdate) && moment(article.date).isAfter(args.mindate)) {
      return true;
    } else {
      shouldStop = true;
      return false;
    }
  });
  // Only push if the page isn't empty
  if (articlesArr.length !== 0) {
    pages.push({
      "page": page,
      "articles": articlesArr
    });
  }
  // If we haven't run out of articles, do some recursion!
  if (articles.length !== 0 && !shouldStop) {
    pages = await getArticlesByLabel(label, pages, articles.last().children().first().attr('title'), offset + articles.length);
    return pages;
  }
  return pages;
}

const friendlylink = /([\w-_]+)\./;

/**
 * Finds the article's title and friendly link name.
 * The friendly link is the same as the webpage href's filename but without the
 * extension or query params.
 * @param $
 * @returns {object}
 */
async function getArticleTitle($: CheerioStatic) {
  const title = $('.post-title');
  const href = new url.URL(title.children().first().attr('href')).href;
  return {
    friendly: title.text().trim(),
    friendlyLink: path.basename(href).match(friendlylink)[1]
  };
}

/**
 * Finds the article's author's name and Blogger page.
 * @param $
 * @returns {object}
 */
async function getArticleAuthor($: CheerioStatic) {
  const authorProfile = $('.g-profile[title="author profile"]');
  return {
    name: authorProfile.first().text().trim(),
    link: authorProfile.attr('href')
  };
}

const youtubeRegex = /(?:https:)?\/\/(?:www\.)?youtu(?:(?:\.be)|(?:be\.com))\/(?:embed\/|watch\?v=)([\w-_]+)/;
const youtubePlaylistRegex = /(?:https:)?\/\/(?:www\.)?youtu(?:(?:\.be)|(?:be\.com))\/(?:embed\/videoseries|playlist)(?:\?list=)?([\w-_]+)/;

/**
 * Finds all of the YouTube video/embed links in the post.
 * @param $
 * @returns {Array<string>} The video URLs.
 */
async function findYouTubeLinks($: CheerioStatic) {
  const linkArr = [];
  // This'll match all iframes with an src containing "youtu.be/", "youtube.com/watch?v=", or "youtube.com/embed/".
  const iframes = $('iframe[src*="youtu.be/"], iframe[src*="youtube.com/watch?v="], iframe[src*="youtube.com/embed/"]');
  // For each iframe, fix the src to https://youtube.com/watch?v=VIDEOID
  // (This breaks embeds, but we'll have a clean source)
  for (let i = 0; i < iframes.length; i++) {
    const src = iframes[i].attribs['src'];
    const matches = src.match(youtubeRegex);
    if (matches == null) continue;
    iframes[i].attribs['src'] = 'https://youtube.com/watch?v=' + matches[1];
  }
  linkArr.push(...iframes.toArray().map(e => e.attribs['src']));
  // Get all the YouTube links that aren't embedded
  const links = $('a[href*="youtu.be/"], a[href*="youtube.com/watch?v="]');
  for (let i = 0; i < links.length; i++) {
    const src = links[i].attribs['href'];
    const matches = src.match(youtubeRegex);
    if (matches == null) continue;
    links[i].attribs['href'] = 'https://youtube.com/watch?v=' + matches[1];
  }
  linkArr.push(...links.toArray().map(e => e.attribs['href']));
  return linkArr;
}

/**
 * Finds all of the YouTube playlists in the post.
 * @param $
 * @returns {Array<string>} The playlist URLs.
 */
async function findYouTubePlaylists($: CheerioStatic) {
  // For each playlist embed, fix the src like in findYouTubeLinks
  const iframes = $('iframe[src*="youtube.com/embed/videoseries"]');
  for (let i = 0; i < iframes.length; i++) {
    const src = iframes[i].attribs['src'];
    const matches = src.match(youtubePlaylistRegex);
    if (matches == null) continue;
    iframes[i].attribs['src'] = 'https://youtube.com/playlist?list=' + matches[1];
  }
  return iframes.toArray().map(e => e.attribs['src']);
}

/**
 * Finds all of the images in the post.
 * @param $
 * @returns {Array<string>} The image source URLs.
 */
async function findImgSrcs($: CheerioStatic) {
  // Find all img srcs and set the protocol to https: if it's missing
  const imgs = $('.post img').not('a[href="/"] > img').not('.image-button img');
  for (let i = 0; i < imgs.length; i++) {
    const src = imgs[i].attribs['src'];
    if (src.startsWith('//')) {
      imgs[i].attribs['src'] = 'https:' + src;
    }
  }
  return imgs.toArray().map(e => e.attribs['src']);
}

/**
 * Aggregates all of the article information into an object.
 * @param articleURL The article URL.
 * @returns {object} The article information.
 */
async function getArticleInformation(articleURL) {
  const res = await request(articleURL);
  if (res.statusCode !== 200) {
    throw new Error('website did not return 200');
  }
  const $ = cheerio.load(res.body);
  // Unmodified HTML string
  const raw = res.body;
  // Title
  const title = await getArticleTitle($);
  // Author
  const author = await getArticleAuthor($);
  // YouTube video links
  const youtubeLinks = await findYouTubeLinks($);
  // YouTube playlist links
  const playlistLinks = await findYouTubePlaylists($);
  // Image sources
  const imgSrcs = await findImgSrcs($);
  return {
    data: {
      title,
      author,
      youtubeLinks,
      playlistLinks,
      imgSrcs
    },
    raw
  };
}

/**
 * @param baseDir The directory path.
 * @param fileNames The filenames to check the existence of.
 * @returns {boolean} Whether any of the files exist in the basedir.
 */
function filesExist(baseDir: string, ...fileNames: string[]) {
  let exists = false;
  for (const fileName of fileNames) {
    exists = exists || fs.existsSync(path.join(baseDir, fileName));
  }
  return exists;
}

/**
 * @returns {Array<string>} A string array of all the video URLs from the specified page.
 * @param pages The pages.
 */
function flattenPages(pages) {
  const articleURLs = [];
  for (const page of pages) {
    for (const article of page.articles) {
      articleURLs.push(article.link);
    }
  }
  return articleURLs;
}

/**
 * Creates a directory while ignoring the EEXIST error if it already exists.
 * @param dirname The directory path.
 */
async function mkdir(dirname: string) {
  return new Promise((resolve, reject) => {
    fs.mkdir(dirname, err => {
      if (!err || err.code === 'EEXIST') {
        resolve();
      }
      reject(err);
    });
  });
}

/**
 * The main function.
 */
async function main() {
  args.mindate = moment(args.mindate).toISOString();
  args.maxdate = moment(args.maxdate).toISOString();

  if (args.verbose) {
    console.log(`Specified minimum date: ${args.mindate.cyan}`);
    console.log(`Specified maximum date: ${args.maxdate.cyan}`);
  }

  const dataDir = path.join(process.cwd(), 'data');
  await mkdir(dataDir).catch(console.error);

  if (args.verbose)
    console.log('Specified labels: ' + ('"' + args.labels.join('", "') + '"').green)

  console.log('-'.repeat(80));
  console.log('Step One: Page Scraping'.green);
  console.log('This step will scrape the search pages using the specified label(s),');
  console.log('within the specified date(s) (or 1970 -> now if unspecified).');
  console.log('-'.repeat(80));

  for (const label of args.labels) {
    const labelDir = path.join(dataDir, label || '_all');
    await mkdir(labelDir);

    if (filesExist(labelDir, 'pages.json', 'articles.json') && !args.overwrite && !args.resume) {
      throw new Error('pages.json and/or articles.json exists in label directory; use --overwrite flag to overwrite');
    }

    const bak = await loadBackup();

    let articlesUnderLabel;
    if (args.resume) {
      if (bak != null) {
        if (typeof bak['pages']) {
          articlesUnderLabel = bak['pages'];
        }
      } else {
        console.log(`Could not resume; there's nothing to resume from!`);
      }
    }
    if (args.resume && bak == null) {
      articlesUnderLabel = await getArticlesByLabel(label);
      console.log('Saving pages.json...'.blue);
      fs.writeFileSync(path.join(labelDir, 'pages.json'), JSON.stringify(articlesUnderLabel, null, 2));
      console.log('Done!'.green);
    }

    console.log('-'.repeat(80));
    console.log('Step Two: Article Scraping'.green);
    console.log('This step will scrape each article found in step one.');
    console.log('-'.repeat(80));

    const articleURLs = flattenPages(articlesUnderLabel);

    console.log(`Found ${articleURLs.length.toString().yellow} articles total.`);

    let i = 0;
    if (bak != null) {
      if (typeof bak['article'] !== 'undefined') {
        i = bak['article'];
      }
    };
    for (; i < articleURLs.length; i++) {
      const articleURL = articleURLs[i];
      console.log(`Scraping article ${(articleURLs.indexOf(articleURL) + 1).toString().yellow} of ${(articleURLs.length).toString().yellow} (${(((articleURLs.indexOf(articleURL) + 1) / articleURLs.length).toFixed(2)).toString().green}` + '%'.green + `)...`);

      if (args.verbose)
        console.log(articleURL.underline);

      const articleInformation = await getArticleInformation(articleURL);

      const articlesDir = path.join(labelDir, 'articles');
      await mkdir(articlesDir);

      let friendlyLink = articleInformation.data.title.friendlyLink;

      if (args.saveby === 'ext') {
        await mkdir(path.join(articlesDir, 'html'));
        await mkdir(path.join(articlesDir, 'json'));

        if (filesExist(`data/${label}/articles/html`, `${friendlyLink}.html`) || filesExist(`data/${label}/articles/json/`, `${friendlyLink}.json`)) {
          friendlyLink += '_2';
        }
        console.log('Writing ' + `data/${label}/articles/html/${friendlyLink}.html`.cyan + '...');
        fs.writeFileSync(path.join(articlesDir, 'html', friendlyLink + '.html'), articleInformation.raw);
        console.log('Writing ' + `data/${label}/articles/json/${friendlyLink}.json`.cyan + '...');
        fs.writeFileSync(path.join(articlesDir, 'json', friendlyLink + '.json'), JSON.stringify(articleInformation.data, null, 2));
      } else if (args.saveby === 'name') {
        if (filesExist(`data/${label}/articles`, `${friendlyLink}.html`, `${friendlyLink}.json`)) {
          friendlyLink += '_2';
        }
        console.log('Writing ' + `data/${label}/articles/${friendlyLink}.html`.cyan + '...');
        fs.writeFileSync(path.join(articlesDir, friendlyLink + '.html'), articleInformation.raw);
        console.log('Writing ' + `data/${label}/articles/${friendlyLink}.json`.cyan + '...');
        fs.writeFileSync(path.join(articlesDir, friendlyLink + 'data.json'), JSON.stringify(articleInformation.data, null, 2));
      } else if (args.saveby === 'namedir') {
        if (filesExist(`data/${label}/articles/${friendlyLink}`, `page.html`, `data.json`)) {
          friendlyLink += '_2';
        }
        await mkdir(path.join(articlesDir, friendlyLink));

        console.log('Writing ' + `data/${label}/articles/${friendlyLink}/page.html`.cyan + '...');
        fs.writeFileSync(path.join(articlesDir, friendlyLink, 'page.html'), articleInformation.raw);
        console.log('Writing ' + `data/${label}/articles/${friendlyLink}/data.json`.cyan + '...');
        fs.writeFileSync(path.join(articlesDir, friendlyLink, 'data.json'), JSON.stringify(articleInformation.data, null, 2));
      }
      bak['article'] = i;
      await saveBackup(bak);
    }
  }
}
main();
