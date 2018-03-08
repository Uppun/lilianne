import {INITIALIZE, SET_CURRENT_SONG, SET_SKIP_STATUS} from '../../actions';
import {getUid} from './items';
import {getSong} from '../songs';
import {getUser} from '../users';

function reduceSong(song, skips = 0) {
  if (!song) return null;
  return {
    song: getUid(song),
    dj: song.player.dj.id,
    startTime: song.player.startTime,
    offset: song.player.startTime - song.player.currentTime,
    skips,
  };
}

export default function reduceCurrent(state = null, action, songs) {
  switch (action.type) {
    case INITIALIZE:
      return reduceSong(action.payload.current, action.payload.skips);

    case SET_CURRENT_SONG:
      return {
        reduceSong(action.payload),
      };

    case SET_SKIP_STATUS:
      return {
        ...state,
        skips: action.payload.skips,
      };

    default:
      return state;
  }
}

export function getCurrentSong(state) {
  const {current} = state.songs;
  if (!current) return {song: null}; // TODO

  return {
    ...current,
    song: getSong(state, current.song),
    dj: getUser(state, current.dj),
  };
}
