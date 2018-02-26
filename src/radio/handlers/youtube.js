/* @flow */

import {parse as parseUrl} from 'url';
import ytdl from 'ytdl-core';

import type {Writable} from 'stream';
import type {Handler, SongInfo} from '../handlers';

export default class YouTube implements Handler {
  static match(link: string) {
    const parse = parseUrl(link);
    return parse.hostname === 'youtu.be' || /\byoutube\b/.test(String(parse.hostname));
  }

  info: ytdl.videoInfo;
  link: string;

  constructor(link: string, _config: *) {
    this.link = link;
  }

  getMeta(): Promise<SongInfo> {
    return new Promise((resolve, reject) => {
      ytdl.getInfo(this.link, (err, info) => {
        // check ytdl error
        if (err) return reject(err);

        //
        this.info = info;

        resolve({
          id: info.video_id,
          title: info.title,
          url: info.video_url,
          image: info.thumbnail_url,
          duration: +info.length_seconds,
          plays: info.view_count,
          uploader: {
            name: info.author.name,
            url: info.author.channel_url,
          },
        });
      });
    });
  }

  download(stream: Writable) {
    return ytdl.downloadFromInfo(this.info, {filter: 'audioonly'}).pipe(stream);
  }
}
