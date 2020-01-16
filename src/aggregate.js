// aggregate.js - Handles YouTube link aggregation.
// TODO: Improve YouTube link detection and saving logic

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { log } = require('./utils');

const outputPath = path.join(__dirname, '..', 'output');
const articlesPath = path.join(outputPath, 'articles');

/**
 * @typedef {object} Options
 * @property {string} output The output directory.
 * @property {boolean} includeVideos Includes videos in the output.
 * @property {boolean} includePlaylists Includes playlists in the output.
 * @property {boolean} includeChannels Includes channels in the output.
 * @property {boolean} includeEmbeds Includes embeds in the output.
 * @property {boolean} rewrite Rewrites all URLs to ensure standardization.
 */

/**
 * Parses command-line arguments to aggregate options.
 * @param {string} argv The script arguments.
 * @returns {Options} The parsed options.
 */
function parseArgs (argv) {
  const options = {};
  // Handle different output directory
  options.output = argv.output;
  // Include videos
  options.includeVideos = argv.videos;
  // Include playlists
  options.includePlaylists = argv.playlists;
  // Include channels
  options.includeChannels = argv.channels;
  // Include embeds
  options.includeEmbeds = argv.embeds;
  // Rewrite URLs
  options.rewrite = argv.rewrite;
  return options;
}

/**
 * The aggregate command handler.
 * @param {string} argv The script arguments.
 */
function aggregate (argv) {
  const options = parseArgs(argv);
  let allYouTubeLinks = [];
  const dates = fs.readdirSync(articlesPath);
  for (const date of dates) {
    const posts = fs.readdirSync(path.join(articlesPath, date));
    log(`Iteration date: ${date}`);
    for (const post of posts) {
      const extractedText = fs.readFileSync(path.join(articlesPath, date, post, 'extracted.json'), 'utf8');
      const extracted = JSON.parse(extractedText);
      for (const group of Object.values(extracted)) {
        for (const link of group) {
          let url;
          try {
            url = new URL(link);
          } catch (err) {
            // TODO: Investigate broken URL
            continue;
          }
          const isLongYT = url.hostname === 'youtube.com';
          const isShortYT = url.hostname === 'youtu.be';
          if (isShortYT || isLongYT) {
            // Include videos
            if (url.pathname === '/watch' || isShortYT) {
              const videoID = url.searchParams.get('v');
              const playlistID = url.searchParams.get('list');
              // Add the video
              if (options.includeVideos && videoID != null) {
                if (options.rewrite) {
                  allYouTubeLinks.push('https://www.youtube.com/watch?v=' + videoID);
                } else {
                  allYouTubeLinks.push(url.href);
                }
              }
              // Add the playlist included in the link
              if (options.includePlaylists && playlistID != null) {
                if (options.rewrite) {
                  allYouTubeLinks.push('https://www.youtube.com/playlist?list=' + playlistID);
                } else {
                  allYouTubeLinks.push(url.href);
                }
              }
            }

            // Include playlists
            if (url.pathname === '/playlist') {
              log('Playlist');
              const playlistID = url.searchParams.get('list');
              // Add the playlist
              if (!options.includePlaylists && playlistID != null) {
                if (options.rewrite) {
                  allYouTubeLinks.push('https://www.youtube.com/playlist?list=' + playlistID);
                  log('Playlist ADDED');
                } else {
                  allYouTubeLinks.push(url.href);
                }
              }
            }

            // TODO: Include non-standard (youtube.com/channelname) channels
            // Include channels
            if (url.pathname.startsWith('/user/') || url.pathname.startsWith('/channel/')) {
              const channelID = url.pathname.replace(/\/(user|channel)\//, '');
              // Add the channel
              if (options.includeChannels && channelID != null) {
                // TODO: Allow for channel rewriting
                allYouTubeLinks.push(url.href);
              }
            }

            // Include embeds
            if (url.pathname.startsWith('/embed')) {
              const videoID = url.pathname.replace('/embed/', '');
              // TODO: Not discard playlists
              // Add the embed
              if (!options.includeEmbeds && videoID != null) {
                if (options.rewrite) {
                  allYouTubeLinks.push('https://www.youtube.com/watch?v=' + videoID);
                } else {
                  allYouTubeLinks.push(url.href);
                }
              }
            }
          }
        }
      }
    }
  }
  allYouTubeLinks = [...new Set(allYouTubeLinks)];
  log(`Aggregated ${allYouTubeLinks.length} YouTube links.`);
  fs.writeFileSync(options.output, JSON.stringify(allYouTubeLinks, null, 2));
  log(`Saved to ${options.output}`);
}

module.exports = { aggregate };
