// utils.js - Holds various utility functions.

const util = require('util');

/**
 * Logs text to stdout with a localized timestamp.
 * @param {string} text The text to log.
 * @param {boolean} newline Whether to include a newline.
 */
function log (text, newline = true) {
  const { year, month, day, hour, minute, second } = getDateComponents();
  const formattedDateTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  logf(`${formattedDateTime} | ${util.format(text)}` + (newline ? '\n' : ''));
}

/**
 * Logs timestamped text without a newline.
 * @param {string} text The text to log.
 */
function logPart (text) {
  log(text, false);
}

/**
 * Logs text to stdout with a localized timestamp, but without a newline.
 * @param {string} text The text to log.
 */
function logf (text) {
  if (!logf.quiet) process.stdout.write(text);
}

/**
 * @typedef {object} DateComponents
 * @property {number} year The year.
 * @property {number|string} month The month.
 * @property {number|string} day The day.
 * @property {number|string} hour The hour.
 * @property {number|string} minute The minute.
 * @property {number|string} second The second.
 */

/**
 * Gets year, month, day, hour, minute and second date components.
 * @param {Date} date The date to get the components from.
 * @returns {DateComponents} The date components.
 */
function getDateComponents (date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // month is zero-based
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return { year, month, day, hour, minute, second };
}

/**
 * Pads the number with a zero if it's less than ten.
 * @param {number} number The number to pad.
 * @returns {number|string} The padded or original number.
 */
function pad (number) {
  if (number < 10) {
    return '0' + number;
  }
  return number;
}

/**
 * Returns whether or not the number is greater than min and less than max.
 * @param {number} number The number.
 * @param {number} min The minimum.
 * @param {number} max The maximum.
 * @returns {boolean} Whether the number is in range.
 */
function numberInRange (number, min, max) {
  if (number < min) {
    return false;
  }
  if (number > max) {
    return false;
  }
  return true;
}

/**
 * Parses a date string using either of the following formats into a Date:
 *   YYYY-MM-DD
 *   YYYY/MM/DD
 * @param {string} string The date string.
 * @returns {Date} The parsed date.
 */
function parseArgDate (string) {
  // Matches (YYYY)-(M?M)-(D?D) & (YYYY)/(M?M)/(D?D)
  // e.g. 2020-01-01, 2020-1-1, 2020/01/01, 2020/1/1
  // We aren't using the match groups right now, but they may be of use
  // in the future.
  // Input: 2020-01-24
  // Output: [ '2020-01-01', '2020', '01', '24' ]
  const matches = string.match(/([\d]{4})[-/]([\d]{1,2})[-/]([\d]{1,2})/);
  // TODO: Support hour, minute and second input
  // NOTE: That may be more difficult with spaces separating day and time--
  // could we group arguments by two? What about where only one side specifies
  // the time? Use two args: --start-date and --end-date?
  if (matches == null) {
    // Though the proper format is noted in README.md, would it be good to
    // detail why it's invalid?
    throw new Error('invalid date');
  }
  // Date constructor allows for strings in 'YYYY-MM-DD' format
  return new Date(matches[0]);
}

/**
 * Prepends http: to the URL if it doesn't includ the protocol.
 * @param {string} url The URL.
 * @param {boolean} https Whether or not we should assume HTTPS.
 * @returns {string} The corrected URL.
 */
function fixProtocol (url, https) {
  // If the beginning of the URL doesn't begin with http: or https:
  if (url && !/https?:/.test(url)) {
    // If HTTPS, the URL starts with https:, otherwise http:
    url = `http${https && 's'}:${url}`;
  }
  return url;
}

module.exports = { log, logPart, logf, pad, numberInRange, parseArgDate, fixProtocol };
