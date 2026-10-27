import test from 'node:test';
import assert from 'node:assert/strict';
import {SpecimenShowcase, specimens} from '../assets/specimen-showcase.js';

class Element extends EventTarget {
  constructor() {
    super(); this.attrs = new Map(); this.textContent = ''; this.hidden = true;
    const classes = new Set();
    this.classList = {add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n),
      toggle: (n, on) => on ? classes.add(n) : classes.delete(n)};
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  click() { this.dispatchEvent(new Event('click')); }
}
class Video extends Element {
  constructor() { super(); this.paused = true; this.currentTime = 0; this.duration = 4; this.plays = 0; this.loads = 0; }
  set src(value) { this.setAttribute('src', value); }
  get src() { return this.getAttribute('src') || ''; }
  load() { this.loads++; this.paused = true; this.currentTime = 0; if(this.src) this.dispatchEvent(new Event('loadedmetadata')); }
  pause() { this.paused = true; }
  play() {
    this.plays++;
    if (this.rejectPlay) return Promise.reject(new Error('blocked'));
    this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve();
  }
}
class Clock {
  constructor() { this.now = 0; this.next = 0; this.tasks = new Map(); }
  setTimeout(fn, delay) { const id = ++this.next; this.tasks.set(id, {at: this.now + delay, fn}); return id; }
  clearTimeout(id) { this.tasks.delete(id); }
  tick(ms) {
    const end = this.now + ms;
    for(let count = 0; count < 100; count++) {
      const next = [...this.tasks].sort((a,b) => a[1].at-b[1].at)[0];
      if(!next || next[1].at > end) break;
      this.now = next[1].at; this.tasks.delete(next[0]); next[1].fn();
    }
    this.now = end;
  }
}
function fixture({reduced = false, hidden = false, fade = 0} = {}) {
  const doc = new EventTarget(); doc.hidden = hidden;
  const media = new EventTarget(); media.matches = reduced;
  const root = new Element(); root.ownerDocument = doc;
  const nodes = Object.fromEntries(['poster','name','count','previous','next','pause','announcement','controls'].map(n => [`[data-specimen-${n}]`, new Element()]));
  const video = new Video(); nodes['[data-specimen-video]'] = video;
  root.querySelector = selector => nodes[selector];
  const clock = new Clock(); let intersection; let disconnected = false;
  const showcase = new SpecimenShowcase(root, {document: doc, media, clock, fade,
    observer: callback => { intersection = callback; return {observe() {}, disconnect() { disconnected = true; }}; }});
  return {root, nodes, video, doc, media, clock, showcase,
    visible: value => intersection([{target: root, isIntersecting: value, intersectionRatio: value ? 1 : 0}]),
    hidden: value => {doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange'));},
    reduced: value => {media.matches = value; media.dispatchEvent(new Event('change'));},
    click: name => nodes[`[data-specimen-${name}]`].click(),
    text: name => nodes[`[data-specimen-${name}]`].textContent,
    disconnected: () => disconnected};
}

test('all nine requested visuals are present in order, including the recorded western alias', () => {
  assert.deepEqual(specimens.map(s=>s.name), ['Kinesin','Gel','Western blot','Plate reader','Volcano plot','Orbital shaker','Ribosome','Coronavirus budding','CRISPR']);
  assert.equal(new Set(specimens.map(s=>s.video)).size, 9);
});
test('no media or timers start before the card enters the viewport', () => {
  const f = fixture(); assert.equal(f.video.src, ''); assert.equal(f.clock.tasks.size, 0);
  f.visible(true); assert.equal(f.video.paused, false); assert.equal(f.clock.tasks.size, 1);
});
test('automatic rotation visits all nine and wraps with only one timer and decoder', () => {
  const f = fixture(); f.visible(true);
  for(let i=1; i<=9; i++) {f.clock.tick(8000); assert.equal(f.showcase.index, i%9); assert.equal(f.video.src, specimens[i%9].video); assert.equal(f.clock.tasks.size, 1);}
});
test('manual previous/next wraps and announces the selection', () => {
  const f = fixture({reduced:true}); f.visible(true); f.click('previous');
  assert.equal(f.text('name'), 'CRISPR'); assert.equal(f.text('count'), '9 / 9');
  assert.equal(f.text('announcement'), 'CRISPR, 9 of 9'); f.click('next'); assert.equal(f.text('name'), 'Kinesin');
});
test('pause freezes the current frame and timer; resume keeps its time', () => {
  const f = fixture(); f.visible(true); f.video.currentTime = 1.75; f.click('pause');
  assert.equal(f.video.paused, true); assert.equal(f.video.currentTime, 1.75); assert.equal(f.clock.tasks.size, 0);
  f.clock.tick(90000); assert.equal(f.showcase.index, 0); f.click('pause');
  assert.equal(f.video.paused, false); assert.equal(f.video.currentTime, 1.75); assert.equal(f.clock.tasks.size, 1);
});
test('manual navigation while paused stays static until resumed', () => {
  const f = fixture(); f.visible(true); f.click('pause'); f.click('next');
  assert.equal(f.text('name'), 'Gel'); assert.equal(f.video.src, ''); assert.equal(f.clock.tasks.size, 0);
  f.click('pause'); assert.equal(f.video.src, specimens[1].video); assert.equal(f.video.paused, false);
});
test('offscreen unloads and releases timers; returning restores the same animation position', () => {
  const f = fixture(); f.visible(true); f.video.currentTime=2.2; f.visible(false);
  assert.equal(f.video.src, ''); assert.equal(f.video.paused, true); assert.equal(f.clock.tasks.size, 0);
  f.clock.tick(90000); assert.equal(f.showcase.index, 0); f.visible(true); assert.equal(f.video.currentTime, 2.2);
});
test('tab hiding unloads and never advances while hidden, including during a fade', () => {
  const f = fixture({fade:220}); f.visible(true); f.click('next'); assert.equal(f.clock.tasks.size, 1);
  f.hidden(true); assert.equal(f.video.src, ''); assert.equal(f.clock.tasks.size, 0);
  f.clock.tick(60000); assert.equal(f.showcase.index, 1); f.hidden(false); assert.equal(f.video.src, specimens[1].video);
});
test('reduced motion starts static, permits manual selection and does not fetch video', () => {
  const f = fixture({reduced:true}); f.visible(true); assert.equal(f.video.src, ''); assert.equal(f.clock.tasks.size, 0);
  assert.equal(f.nodes['[data-specimen-pause]'].disabled, true); f.click('next'); f.clock.tick(60000);
  assert.equal(f.showcase.index, 1); assert.equal(f.video.plays, 0);
});
test('changing the motion preference cancels a pending transition; restoring it resumes once', () => {
  const f=fixture({fade:220});f.visible(true);f.click('next');f.reduced(true);
  assert.equal(f.video.src,'');assert.equal(f.clock.tasks.size,0);f.clock.tick(1000);assert.equal(f.video.src,'');
  f.reduced(false);assert.equal(f.video.src,specimens[1].video);assert.equal(f.clock.tasks.size,1);
});
test('rapid manual changes cancel stale transitions and load only the final selection', () => {
  const f=fixture({fade:220});f.visible(true);f.click('next');f.click('next');f.click('next');
  assert.equal(f.clock.tasks.size,1);f.clock.tick(220);assert.equal(f.video.src,specimens[3].video);assert.equal(f.clock.tasks.size,1);
});
test('autoplay rejection preserves manual browsing without an endless retry timer', async () => {
  const f=fixture();f.video.rejectPlay=true;f.visible(true);await Promise.resolve();
  assert.equal(f.showcase.userPaused,true);assert.equal(f.clock.tasks.size,0);f.click('next');assert.equal(f.text('name'),'Gel');
});
test('destroy removes observers, listeners and active media', () => {
  const f=fixture();f.visible(true);f.showcase.destroy();assert.equal(f.video.src,'');assert.equal(f.clock.tasks.size,0);assert.equal(f.disconnected(),true);
  f.click('next');assert.equal(f.showcase.index,0);
});
