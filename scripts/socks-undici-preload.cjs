/** 通过本机 Clash SOCKS(7890) 走 undici 全局 fetch，绕过 fake-ip 导致的 TLS 失败 */
const { setGlobalDispatcher } = require('undici');
const { socksDispatcher } = require('fetch-socks');

setGlobalDispatcher(
  socksDispatcher({
    type: 5,
    host: '127.0.0.1',
    port: 7890,
  }),
);
