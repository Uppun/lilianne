/* @flow */

const https = require('https');
const querystring = require('querystring');

export default function parsePlaylist(
  id: string,
  token: string = '',
  resultArray: Array<string> = []
): Promise<Array<string>> {
  const key = 'AIzaSyCSPw6aZyX0sdH39Lm_Bzf2SRMdBcqNcp4';
  let getUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?';
  const youtubeUrl = 'https://www.youtube.com/watch?v=';
  const options: Object = {
    playlistId: id,
    maxResults: 50,
    part: 'snippet',
    key: key,
  };
  if (token) {
    options.pageToken = token;
  }
  getUrl += querystring.stringify(options);
  return new Promise(resolve => {
    https.get(getUrl, res => {
      const buffer = [];
      res.on('data', chunk => {
        buffer.push(chunk);
      }),
        res.on('end', () => {
          const data = Buffer.concat(buffer).toString();
          const parsedData = JSON.parse(data);
          for (let item of parsedData.items) {
            if (
              !(item.snippet.title === 'Private video' || item.snippet.title === 'Deleted video') &&
              item.snippet.resourceId.kind === 'youtube#video'
            ) {
              resultArray.push(youtubeUrl + item.snippet.resourceId.videoId);
            }
          }
          if (parsedData.nextPageToken) {
            resolve(parsePlaylist(id, parsedData.nextPageToken, resultArray));
          } else {
            resolve(resultArray);
          }
        }),
        res.on('error', err => {
          console.error(err);
        });
    });
  });
}
