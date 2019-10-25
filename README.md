# EQD-Scraper
Utility to scrape content from Equestria Daily

## Instructions
1. Install either the current or LTS version of [Node.js](https://nodejs.org/en/)
2. Clone or download the repository
3. Run `npm i` to install the required packages
4. Run `npm run-script build` to build the code
5. Run `npm start -- --help` to see the general usage of the script

## Samples
This will scrape all articles between January 1st, 2013 to January 1st, 2014 with the label "Music".
```
npm start -- --min "2013-01-01" --max "2014-01-01" -l "Music"
```
This will scrape all articles since October 1st, 2019 with the label "Story".
```
npm start -- --min "2019-10-01" -l "Story"
```
