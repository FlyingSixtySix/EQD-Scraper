import { getPackage } from './utils';
import * as logger from './logger';
import * as search from './search';

const packageData = getPackage();

const args = process.argv.slice(2);

async function main() {
  logger.info(packageData.name, packageData.version);
  logger.info('by', packageData.author);
  logger.separator();
  const articles = await search.getArticlesByLabel(args[0] || '');
  logger.debug(articles);
}
main();
