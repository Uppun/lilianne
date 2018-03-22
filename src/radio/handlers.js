/* @flow */

import {Writable} from 'stream';
import type {ConfigOptions} from '..';
import SoundCloud from './handlers/soundcloud';
import YouTube from './handlers/youtube';

const handlers: * = [SoundCloud, YouTube];

export type SongInfo = {
  id: string,
  title: string,
  url: string,
  image: string,
  duration: number, // in seconds
  plays: string,
  uploader: {
    name: string,
    url: string,
  },
};

export interface Handler {
  // constructor(link: string, config: $PropertyType<ConfigOptions, 'services'>);
  // static match(link: string): boolean;
  getMeta(): Promise<SongInfo>;
  download(stream: Writable): Writable;
}

export function getHandler(link: string, config: ConfigOptions): ?Handler {
  for (const Handler of handlers) {
    if (Handler.match(link)) {
      return new Handler(link, config.services);
    }
  }
  return null;
}
