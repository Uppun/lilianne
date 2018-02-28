/* @flow */

import https from 'https';
import querystring from 'querystring';

const GET_URL = 'https://www.googleapis.com/youtube/v3/playlistItems?';
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=';

export default function parsePlaylist(
  id: string,
  key: string,
  pageToken?: string,
  resultArray: Array<string> = []
): Promise<Array<string>> {
  const options: Object = {
    playlistId: id,
    maxResults: 50,
    part: 'snippet',
    key: key,
  };
  if (pageToken) {
    options.pageToken = pageToken;
  }
  return new Promise((resolve, reject) => {
    https.get(GET_URL + querystring.stringify(options), res => {
      const buffer = [];

      res.on('data', chunk => {
        buffer.push(chunk);
      });

      res.on('end', () => {
        const data = Buffer.concat(buffer).toString();
        const parsedData = JSON.parse(data);
        if (parsedData.error) {
          reject(new Error(parsedData.error.message));
          return;
        }
        for (const item of parsedData.items) {
          if (
            !(item.snippet.title === 'Private video' || item.snippet.title === 'Deleted video') &&
            item.snippet.resourceId.kind === 'youtube#video'
          ) {
            resultArray.push(YOUTUBE_URL + item.snippet.resourceId.videoId);
          }
        }

        if (parsedData.nextPageToken) {
          resolve(parsePlaylist(id, key, parsedData.nextPageToken, resultArray));
        } else {
          resolve(resultArray);
        }
      });

      res.on('error', err => {
        reject(err);
      });
    });
  });
}
