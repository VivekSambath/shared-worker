// One instance shared by every tab that has the deck open (same origin + same name "deck-sync").
// Its console: chrome://inspect/#workers (or brave://inspect/#workers) -> "inspect" next to deck-sync.
const tabs = new Map();               // MessagePort -> { name: "Tab A", port: "port#1", got: 0 }
let next = 1;
let slide = null;                     // shared state: the current slide

const names = () => [...tabs.values()].map(t => t.name + ' / ' + t.port);
const send = (type, extra) => tabs.forEach((_, p) => p.postMessage({ type, ...extra }));
const update = () => { send('count', { n: tabs.size }); send('tabs', { list: [...tabs.values()] }); };

onconnect = (e) => {                  // fires once per tab
  const port = e.ports[0];
  const me = { name: 'Tab ' + String.fromCharCode(64 + next), port: 'port#' + next, got: 0 };
  next++;
  tabs.set(port, me);
  console.log('[worker] connect:', me.name, me.port, '| all ports:', names());

  port.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'bye') {                                   // a tab can't be detected closing, so it says goodbye
      tabs.delete(port); update();
      console.log('[worker] left:', me.name, '| all ports:', names());
      return;
    }
    if (m.type === 'slide') slide = m.n;
    console.log('[worker] message', m, 'from', me.name, me.port, '| all ports:', names());   // log before sending
    tabs.forEach((t, p) => {
      if (m.type === 'slide' && p === port) return;           // slide sync: never echo to the sender
      if (m.type === 'msg' && m.skip && p === port) { console.log('   skipped', t.name, '(sender)'); return; }
      if (m.type === 'msg') { t.got++; p.postMessage({ type: 'msg', from: me.name, text: m.text, echo: p === port }); }
      else p.postMessage(m);
      console.log('   sent to', t.name, t.port);
    });
    if (m.type === 'msg') update();
  };
  port.postMessage({ type: 'hello', slide, name: me.name, port: me.port });   // newcomers learn the current slide
  update();
};
