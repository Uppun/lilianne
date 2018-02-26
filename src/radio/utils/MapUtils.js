/* @flow */

export function getWithDefault<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  if (!map.has(key)) {
    map.set(key, defaultValue);
  }

  // $FlowFixMe
  return map.get(key);
}
