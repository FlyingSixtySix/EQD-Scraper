# EQD-Scraper
A utility to scrape all (or some) articles from [Equestria Daily](https://equestriadaily.com/).
Takes roughly 7-9 minutes to scrape all articles.


## Setting Up

1. Copy `config.json.example` to `config.json`
2. Go to https://console.developers.google.com/ and create a project
3. On Dashboard, click "Enable APIs and Services"
4. Search for "Blogger" and enable the Blogger API v3
5. Go to Credentials, click "Create Credentials", then click "API key"
6. Copy the API key and paste in `bloggerAPIKey` in `config.json`

## Directory Structure
The structure in which data is saved looks like so:

    output
    ├── articles
    │   └── $YEAR-$MONTH
    │       └── $POST_ID
    │           ├── body.html
    │           ├── extracted.json
    │           └── metadata.json
    └── youtube.json*

\* Only with the `aggregate` sub-command (see below)

## Scrape Options

### Search by label

| Parameter | Alias | Description | Example |
| --- | --- | --- | --- |
| `--labels Label "Label 2"` | `-l` | Scrapes articles with the specified label(s). | `-l Music "Music: Instrumental"` |

### Search by date
**NOTE:** See below for valid date formats.

| Parameter  | Alias | Description | Example |
| --- | --- | --- | --- |
| `--date YYYY-MM-DD` | `-d` | Scrapes articles on the specified date. | `-d 2020-01-01` |
| `--date YYYY-MM-DD YYYY-MM-DD` | `-d` | Scrapes articles between (including) the two dates. | `-d 2020-01-01 2020-02-01` |

### Combination Examples

| Example | Explanation |
| --- | --- |
| `node . -d 2013-05-01 2013-06-01` | Scrapes all articles published between May and June of 2013. |
| `node . -l Music Story` | Scrapes all articles with the labels `Music` and `Story`. |

## Aggregate Options

| Parameter | Alias | Description | Example |
| --- | --- | --- | --- |
| `--output FILE` | `-o` | Outputs to a different location. Default: output/youtube.json | `aggregate -o /tmp/youtube.json `
| `--videos` | `-v` | Includes videos. Default: true | `aggregate -v` |
| `--playlists` | `-p` | Includes playlists. Default: false | `aggregate -p` |
| `--channels` | `-c` | Includes channels. Default: false | `aggregate -c` |
| `--embeds` | `-e` | Includes embeds. Default: false | `aggregate -e` |
| `--rewrite` | `-r` | Rewrites all URLs to ensure standardization, and extracts included playlists in links. Default: false | `aggregate -r` |

### Combination Examples

| Example | Explanation |
| --- | --- |
| `node . aggregate -c` | Aggregates channels only. |
| `node . aggregate -cvper` | Includes all videos, playlists, channels, embeds. Rewrites embeds and (soon) channel links. |
