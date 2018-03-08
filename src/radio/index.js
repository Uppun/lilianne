/* @flow */

import fs from 'fs';
import path from 'path';
import events from 'events';
import {URL} from 'url';
import {promisify} from 'util';

import uuid from 'uuid/v4';
import mkdirp from 'mkdirp';
import Discord from 'discord.js';

import Application from '..';
import {getHandler} from './handlers';
import replaygain from './replaygain';
import TaskRunner from './utils/TaskRunner';
import {parsePlaylist} from './utils/YoutubeUtils';
import {getWithDefault} from './utils/MapUtils';

import type {SongInfo} from './handlers';

const {EventEmitter} = events;
const stat = promisify(fs.stat);

export const QueueItemStatus = {
  INVALID: 0,
  UNKNOWN: 1,
  WAITING: 2,
  DOWNLOADING: 3,
  PROCESSING: 4,
  DONE: 5,
};

export type SongInfoExtended = SongInfo & {
  service: string,
  gain: number,
  player: {
    dj: UserInfo,
    startTime: number, // in ms
    currentTime?: number, // in ms
  },
};

export type UserInfo = {
  name: string,
  username: string,
  discriminator: string,
  id: string,
  avatar: string,
};

function skipRatio(length: number) {
  const minutes = length / 60;
  return 0.6 - 0.3 / (1 + Math.exp(3 - minutes / 3)); // eslint-disable-line no-mixed-operators
}

export function trimUser(user: Discord.User): UserInfo {
  const {username, discriminator, id, avatar} = user;
  const name = username; // TODO
  return {name, username, discriminator, id, avatar};
}

export type QueueItem = {
  fp?: string,
  song?: SongInfoExtended,
  id: string,
  status: $Values<typeof QueueItemStatus>,
  error?: string,
};

class Radio extends EventEmitter {
  queues: Map<string, QueueItem[]>;
  order: Discord.User[];
  current: ?SongInfoExtended;
  history: SongInfoExtended[];
  skips: Set<string>;
  app: Application;
  taskRunner: TaskRunner;

  constructor(app: Application) {
    super();

    this.app = app;
    this.queues = new Map();
    this.order = [];
    this.current = null;
    this.history = [];
    this.skips = new Set();
    this.taskRunner = new TaskRunner();

    // eslint-disable-next-line handle-callback-err
    app.db.lrange('radio:history', 0, 19, (_err: Error, res: string[]) => {
      if (res) {
        this.history = res.map(s => JSON.parse(s));
        this.emit('history', this.history);
      }
    });
  }

  addDj(user: Discord.User) {
    if (this.order.some(u => u.id === user.id)) return;

    if (!this.current) {
      this.order.push(user);
    } else {
      const currentId = this.current.player.dj.id;
      let last = this.order.pop();
      if (last && last.id !== currentId) {
        this.order.push(last);
        last = null;
      }
      this.order.push(user);
      if (last != null) {
        this.order.push(last);
      }
    }

    this.emit('order', this.order);
  }

  removeDj(user: Discord.User) {
    const idx = this.order.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      this.order.splice(idx, 1);
      this.emit('order', this.order);
    }

    if (this.current) {
      this.skips.delete(user.id);
      this.checkSkips();
    }
  }

  voteSkip(user: Discord.User) {
    if (this.current && user.id === this.current.player.dj.id) {
      this.getNext();
      return true;
    }

    if (!this.order.some(u => u.equals(user))) return false;

    this.skips.add(user.id);
    this.checkSkips();
    return true;
  }

  checkSkips() {
    if (!this.current) return false;

    const ratio = skipRatio(this.current.duration);
    const total = this.order.length;
    const needed = Math.ceil(ratio * total);
    this.emit('skips', this.skips);
    if (this.skips.size >= needed) {
      this.getNext();
    }
  }

  addSong(link: string, user: Discord.User): Promise<EventEmitter[]> {
    const url = new URL(link);
    if (url.pathname === '/playlist' && url.searchParams.has('list')) {
      // $FlowFixMe
      const playlistId: string = url.searchParams.get('list');
      return parsePlaylist(playlistId, this.app.config.youtube.key).then(items =>
        items.map(item => this._addSong(item, user))
      );
    }

    return Promise.resolve([this._addSong(link, user)]);
  }

  _addSong(link: string, user: Discord.User) {
    const emitter = new EventEmitter();

    const queueItem: QueueItem = {
      id: uuid(),
      status: QueueItemStatus.UNKNOWN,
    };

    const q = getWithDefault(this.queues, user.id, []);
    q.push(queueItem);
    this.emit('queue', user, q);

    const emitUpdate = (nextTick: boolean = false) => {
      const emit = () => {
        this.emit('queue', user, q);
        emitter.emit('update', queueItem);
      };

      if (nextTick) {
        process.nextTick(emit);
      } else {
        emit();
      }
    };

    const handler = getHandler(link, this.app.config);
    if (!handler) {
      queueItem.status = QueueItemStatus.INVALID;
      queueItem.error = 'Invalid URL';
      emitUpdate(true);
      return emitter;
    }

    this.taskRunner.queueTask(() =>
      handler
        .getMeta()
        .then((songInfo: SongInfo) => {
          // $FlowFixMe
          const song: SongInfoExtended = {...songInfo};

          // reject if too long
          if (song.duration > 2 * 60 * 60) {
            // TODO(meishu): const this value somewhere
            throw new Error('Track is too long');
          }

          const service = handler.constructor.name.toLowerCase();
          const cache = path.join(this.app.config.radio.cache, service);
          const fp = path.join(cache, song.id.toString());
          const key = ['radio', service, song.id].join(':');

          song.service = service;
          queueItem.status = QueueItemStatus.WAITING;
          queueItem.song = song;
          queueItem.fp = fp;
          emitUpdate();

          const download = (filepath: string): Promise<*> =>
            // Check the cached file.
            stat(filepath)
              // If it exists but is empty, pretend it doesn't exist.
              .then(stats => {
                if (stats.size === 0) {
                  const err = new Error();
                  // $FlowFixMe
                  err.code = 'ENOENT';
                  throw err;
                }
              })
              // We expect ENOENT if it doesn't exist. Re-throw any other error.
              .catch(err => {
                if (err.code !== 'ENOENT') {
                  throw err;
                }

                return (
                  // Create cache directory if needed.
                  promisify(mkdirp)(cache)
                    // Download the song.
                    .then(
                      () =>
                        new Promise((resolve, reject) => {
                          queueItem.status = QueueItemStatus.DOWNLOADING;
                          emitUpdate();

                          handler
                            .download(fs.createWriteStream(filepath))
                            .on('error', err => {
                              reject(err);
                            })
                            .on('finish', () => {
                              resolve();
                            });
                        })
                    )
                );
              });

          // FIXME(meishu): this is gross
          const getCachedSongInfo = new Promise((resolve, reject) => {
            this.app.db.get(key, (err, res) => {
              if (err) {
                reject(err);
              } else {
                resolve(res);
              }
            });
          });

          return (
            Promise.all([download(fp), getCachedSongInfo])
              // Get ReplayGain amount.
              .then((res: *) => {
                let cachedSong;
                try {
                  cachedSong = JSON.parse(res[1]);
                  return cachedSong.gain;
                } catch (e) {}

                queueItem.status = QueueItemStatus.PROCESSING;
                emitUpdate();

                return replaygain(fp);
              })
              // Save info, emit, and persist.
              .then(gain => {
                song.gain = gain;
                queueItem.status = QueueItemStatus.DONE;
                emitUpdate();

                // TODO(meishu): should wait for this before resolving
                this.app.db
                  .multi()
                  .set(key, JSON.stringify(song))
                  .sadd(['radio', service].join(':'), song.id)
                  .exec();
              })
          );
        })
        .catch((err: Error) => {
          console.warn(err);

          queueItem.status = QueueItemStatus.INVALID;
          queueItem.error = err.message;
          emitUpdate();

          emitter.emit('error', err);
          throw err;
        })
    );

    return emitter;
  }

  removeSong(user: Discord.User, qid: $PropertyType<QueueItem, 'id'>) {
    const queue = this.queues.get(user.id);
    if (!queue) return;

    const index = queue.findIndex(q => q.id === qid);
    if (index !== -1) {
      queue.splice(index, 1);
      this.emit('queue', user, queue);
    }
  }

  getNext() {
    this.skips.clear();

    if (this.current) {
      const song = this.current;
      delete song.player.currentTime;

      this.history.unshift(this.current);
      while (this.history.length > 20) this.history.pop();

      this.app.db.lpush('radio:history', JSON.stringify(this.current));
    }

    let orderIndex = -1;
    let songIndex;
    let user;
    let queue;

    for (let i = 0; i < this.order.length; i++) {
      user = this.order[i];
      queue = this.queues.get(user.id);
      if (queue) {
        songIndex = queue.findIndex(item => item.status === QueueItemStatus.DONE);
        if (songIndex !== -1) {
          orderIndex = i;
          break;
        }
      }
    }

    if (orderIndex === -1) {
      if (this.current) {
        this.current = null;
        this.emit('song', null);
      }
      return;
    }

    this.order.push(...this.order.splice(0, orderIndex + 1));

    // $FlowFixMe
    const data = queue.splice(songIndex, 1)[0];

    this.current = data.song;
    // $FlowFixMe
    this.current.player = {
      dj: trimUser(user),
      startTime: Date.now(),
    };

    this.emit('song', data.fp, this.current);
    this.emit('order', this.order);
    this.emit('queue', user, queue);
  }
}

/*
interface Radio {
  on(event: 'history', listener: (history: Radio.history) => void): this;
  on(event: 'order', listener: (order: Radio.order) => void): this;
  on(event: 'skips', listener: (skips: Radio.skips, needed: number) => void): this;
  on(event: 'queue', listener: (user: Discord.User, queue: QueueItem[]) => void): this;
  on(event: 'song', listener: (fp?: string, song?: SongInfoExtended) => void): this;
}
*/

export default Radio;
