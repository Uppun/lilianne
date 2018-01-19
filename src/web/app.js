/* @flow */

import Discord from 'discord.js';

import Web from '.';
import Radio, {SongInfoExtended, UserInfo, trimUser} from '../radio';
import type {QueueItem} from '../radio';
export default function webapp(web: Web) {
  const {base, io} = web;
  const {radio} = base;

  let current: SongInfoExtended | null = null;
  let order: UserInfo[] = [];

  radio.on('history', history => {
    io.emit('history', history);
  });

  radio.on('song', (fp, song) => {
    if (song) {
      current = Object.assign({}, song);
      current.player = Object.assign({}, song.player);
      current.player.currentTime = Date.now();
    } else {
      current = null;
    }
    io.emit('song', current);
  });

  radio.on('order', newOrder => {
    order = newOrder.map(trimUser);
    io.emit('order', order);
  });

  radio.on('queue', (user, queue) => {
    // ?
  });

  io.on('connection', socket => {
    let adding = false;

    // CHECK ERRORS
    if (!socket.request.session || !socket.request.session.passport) {
      socket.emit('app error', {type: 'not authenticated'});
      return;
    }

    if (!base.bot.server) {
      socket.emit('app error', {type: 'not connected'});
      return;
    }

    const {id} = socket.request.session.passport.user;
    const {server} = base.bot;
    const {voiceChannel} = base.bot;
    if (!server.members.has(id) && voiceChannel) {
      socket.emit('app error', {
        type: 'not in server',
        user: socket.request.session.passport.user,
        server: {
          id: server.id,
          name: server.name,
          icon: server.icon,
          channel: voiceChannel.name, // TODO
        },
      });
      return;
    }

    const member = server.members.get(id);
    if (!member) return; // TODO
    const {user} = member;

    // RADIO HOOKS
    function onQueue(u: Discord.User, queue: QueueItem[]) {
      if (u.id !== user.id) return;
      socket.emit('queue', queue.map(({fp, ...item}) => item));
    }

    radio.on('queue', onQueue);
    socket.on('disconnect', () => {
      radio.removeListener('queue', onQueue);
    });

    // ADD HOOKS
    socket.on('add', (url: string) => {
      if (adding) {
        socket.emit('add status', 'error', new Error('Already adding'));
        return;
      }

      const res = radio.addSong(url, user);
      if (!res) {
        socket.emit('add status', 'error', new Error('Invalid URL'));
        return;
      }

      adding = true;

      res.on('error', err => {
        socket.emit('add status', 'error', err);
        adding = false;
      });

      res.on('meta', song => {
        socket.emit('add status', 'meta', song);
      });

      res.on('downloading', () => {
        socket.emit('add status', 'downloading');
      });

      res.on('processing', () => {
        socket.emit('add status', 'processing');
      });

      res.on('done', song => {
        socket.emit('add status', 'done', song);
        adding = false;
      });
    });

    socket.on('delete', (qid: string) => {
      radio.removeSong(user, qid);
    });

    // SEND INIT
    if (current) current.player.currentTime = Date.now();
    const queue = radio.queues.get(id) || [];
    if (server && voiceChannel) {
      socket.emit('load', {
        id,
        server: {
          id: server.id,
          name: server.name,
          icon: server.icon,
          channel: voiceChannel.name, // TODO
        },
        order,
        queue: queue.map(({fp, ...item}) => item),
        current,
        history: radio.history,
      });
    }
  });
}
