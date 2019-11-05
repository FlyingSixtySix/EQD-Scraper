import * as moment from 'moment';

export function log(level: string, ...x) {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${now}]`.yellow, level + ':', ...x);
}

export function debug(...x) {
  log('DEBUG'.bgCyan.black, ...x);
}

export function info(...x) {
  log('INFO'.cyan, ...x);
}

export function warn(...x) {
  log('WARN'.yellow, ...x);
}

export function error(...x) {
  log('ERROR'.red, ...x);
}

export function fatal(...x) {
  log('FATAL'.bgBlack.red, ...x);
}
