const cheerio = require('cheerio');
const { fixProtocol } = require('./utils');

/**
 * Extracts links, image sources and YouTube embeds from the post body.
 * @param {string} body The post body.
 * @param {Options} options The search and extraction options.
 * @returns {object} The extracted content.
 */
function extract (body, options) {
  const extracted = {};
  // Load the body
  const $ = cheerio.load(body);
  // Extract iframe sources
  const iframes = $('iframe');
  extracted.iframes = iframes.toArray().map(e => {
    return fixProtocol(e.attribs.src, true);
  }).filter(e => e != null);
  // Extract link sources
  const links = $('a');
  extracted.links = links.toArray().map(e => {
    return fixProtocol(e.attribs.href);
  }).filter(e => e != null);
  // Extract image sources
  const images = $('img');
  extracted.images = images.toArray().map(e => {
    return fixProtocol(e.attribs.src);
  }).filter(e => e != null);
  // And we're done!
  return extracted;
}

module.exports = { extract };
