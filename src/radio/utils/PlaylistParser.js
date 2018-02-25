/* @flow */

import https from 'https';
import querystring from 'querystring';
import type {ConfigOptions} from '../..';

const getUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?';
const youtubeUrl = 'https://www.youtube.com/watch?v=';

export default function parsePlaylist(
  id: string,
  config: string,
  token?: string,
  resultArray: Array<string> = []
): Promise<Array<string>> {
  const key = config;
  const options: Object = {
    playlistId: id,
    maxResults: 50,
    part: 'snippet',
    key: key,
  };
  if (token) {
    options.pageToken = token;
  }
  let currentUrl = getUrl + querystring.stringify(options);
  return new Promise(resolve => {
    https.get(currentUrl, res => {
      const buffer = [];

      res.on('data', chunk => {
        buffer.push(chunk);
      });

      res.on('end', () => {
        const data = Buffer.concat(buffer).toString();
        const parsedData = JSON.parse(data);
        for (const item of parsedData.items) {
          if (
            !(item.snippet.title === 'Private video' || item.snippet.title === 'Deleted video') &&
            item.snippet.resourceId.kind === 'youtube#video'
          ) {
            resultArray.push(youtubeUrl + item.snippet.resourceId.videoId);
          }
        }

        if (parsedData.nextPageToken) {
          resolve(parsePlaylist(id, config, parsedData.nextPageToken, resultArray));
        } else {
          resolve(resultArray);
        }
      });

      res.on('error', err => {
        console.error(err);
      });
    });
  });
}
