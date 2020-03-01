// index.js - The starting point.

const fs = require('fs');
const path = require('path');
const { log, numberInRange, parseArgDate } = require('./utils');
const { search } = require('./search');
const { aggregate } = require('./aggregate');

const outputPath = path.join(__dirname, '..', 'output');
const articlesPath = path.join(outputPath, 'articles');

require('yargs') // eslint-disable-line no-unused-expressions
  .scriptName('eqd-scraper')
  .usage('$0 [OPTIONS]')
  .command('$0', 'scrapes Equestria Daily articles', yargs => {
    return yargs
      .option('date', {
        alias: 'd',
        type: 'array',
        describe: 'date or date range (both-inclusive) to scrape articles from'
      })
      .option('labels', {
        alias: 'l',
        type: 'array',
        describe: 'label or labels to search with'
      })
      .option('max-results', {
        alias: 'mr',
        type: 'number',
        default: 500,
        describe: 'maximum results per page'
      })
      .option('max-iterations', {
        alias: 'mi',
        type: 'number',
        default: Infinity,
        describe: 'maximum search iterations'
      })
      .middleware(async argv => {
        // If --max-results is out of range [1, 500], throw a RangeError
        if (!numberInRange(argv['--max-results'], 1, 500)) {
          throw new RangeError('maximum results per page must be between 1 and 500');
        }
      });
  }, scrape)
  .command('aggregate', 'aggregates all YouTube links into a single file', yargs => {
    return yargs
      .option('output', {
        alias: 'o',
        type: 'string',
        default: path.join(outputPath, 'youtube.json'),
        describe: 'output JSON path'
      })
      .option('videos', {
        alias: 'v',
        type: 'boolean',
        default: true
      })
      .option('playlists', {
        alias: 'p',
        type: 'boolean',
        default: false
      })
      .option('channels', {
        alias: 'c',
        type: 'boolean',
        default: false
      })
      .option('embeds', {
        alias: 'e',
        type: 'boolean',
        default: false
      })
      .option('rewrite', {
        alias: 'r',
        type: 'boolean',
        default: false
      });
  }, aggregate)
  .help()
  .version()
  .argv;

/**
 * Initializes various things, including the output directory structure.
 */
async function init () {
  // Create output/articles in project directory
  await fs.promises.mkdir(articlesPath, { recursive: true }).catch(err => {
    if (err.code === 'EEXIST') {
      log('Output directories already exist.');
    } else {
      log('Could not initialize directories.');
      throw err;
    }
  });
}

/**
 * Parses command-line arguments to search options.
 * @param {string} argv The script arguments.
 * @returns {object} The parsed options.
 */
function parseArgs (argv) {
  // Handle scrape options
  const options = {};
  if (argv.date != null) {
    if (argv.date.length === 1) {
      // Assume that they want articles on a specific date
      options.specificDate = parseArgDate(argv.date[0]);
    } else if (argv.date.length === 2) {
      // Assume they want articles between (including) two specific dates
      options.dateRange = {};
      options.dateRange.startDate = parseArgDate(argv.date[0]);
      options.dateRange.endDate = parseArgDate(argv.date[1]);
    }
  }
  if (argv.labels != null) {
    // Join all labels with commas
    options.labels = argv.labels
      .join(',');
  }
  // Maximum results per search iteration
  options.maxPerPage = argv['max-results'];
  // Maximum search iterations
  options.maxIter = argv['max-iterations'];
  return options;
}

/**
 * The scrape command handler.
 * @param {string} argv The script arguments.
 */
async function scrape (argv) {
  await init();
  const options = parseArgs(argv);
  const label = 'Finished scraping; time elapsed';
  console.time(label);
  await search(options);
  console.timeEnd(label);
}

module.exports = { articlesPath };
