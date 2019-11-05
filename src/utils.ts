import * as moment from 'moment';
import 'colors';

const sanitize = require('sanitize-filename');

export function getPackage() {
  const packageJson = require('../package.json');
  return packageJson;
}

function clamp(x: number, min: number, max: number) {
  if (x < min) x = min;
  if (x > max) x = max;
  return x;
}

export function generateLabelURL(label: string): URLBuilder {
  return new URLBuilder('https://www.equestriadaily.com/feeds/posts/default')
    .category(label);
}

export class URLBuilder {
  private url: string;
  private params: Array<object>;
  constructor(url: string) {
    this.url = url;
    this.params = [];
  }
  build(): string {
    return this.url + '?' + this.params.map(param => {
      const key = Object.keys(param)[0];
      const value = Object.values(param)[0];
      return key + '=' + URLBuilder.encode(value);
    }).join('&');
  }
  static encode(param: string) {
    return param.toString()
      // https://stackoverflow.com/a/18750001
      //.replace(/[\u00A0-\u9999<>\&]/gim, i => `&#${i.charCodeAt(0)};`)
      //.replace(':', '&#58;')
      //.replace('\'', '&#39;')
      //.replace('"', '&#34;')
      //.replace(' ', '+');
  }
  category(category: string) {
    this.params.push({ category });
    return this;
  }
  maxResults(maxResults: number) {
    maxResults = clamp(maxResults, 0, 500);
    if (maxResults === 0) maxResults = 25;
    this.params.push({ 'max-results': maxResults });
    return this;
  }
}

export function cleanArticleName(title: string, legacy: boolean): string {
  return legacy ? title
    .replace(/[!@#$%^&*()_=+\[{\]};:'"\\|,<.>/? ]+/g, '-')
    .toLowerCase() : sanitize(title);
}

export function cleanProtocol(url: string): string {
  if (url) return url.startsWith('//') ? 'https:' + url : url;
}
