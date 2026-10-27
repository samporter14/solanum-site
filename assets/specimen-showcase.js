// Existing Capsid artwork; one decoder, one rotation timer, no network services.
const asset = name => new URL(`./specimens/${name}`, import.meta.url).href;
export const specimens = [
  ['kinesin', 'Kinesin'], ['gel', 'Gel'], ['western-blot', 'Western blot'],
  ['plate-reader', 'Plate reader'], ['volcano-plot', 'Volcano plot'],
  ['orbital-shaker', 'Orbital shaker'], ['ribosome', 'Ribosome'],
  ['coronavirus-budding', 'Coronavirus budding'], ['crispr', 'CRISPR'],
].map(([id, name]) => ({id, name, poster: asset(`${id}.png`), video: asset(`${id}.mp4`)}));

export class SpecimenShowcase {
  constructor(root, options = {}) {
    this.root = root;
    this.video = root.querySelector('[data-specimen-video]');
    this.poster = root.querySelector('[data-specimen-poster]');
    this.name = root.querySelector('[data-specimen-name]');
    this.count = root.querySelector('[data-specimen-count]');
    this.previous = root.querySelector('[data-specimen-previous]');
    this.next = root.querySelector('[data-specimen-next]');
    this.pause = root.querySelector('[data-specimen-pause]');
    this.announcement = root.querySelector('[data-specimen-announcement]');
    this.document = options.document || root.ownerDocument;
    this.media = options.media || matchMedia('(prefers-reduced-motion: reduce)');
    this.clock = options.clock || window;
    this.interval = options.interval || 8000;
    this.fade = options.fade ?? 220;
    this.index = 0;
    this.visible = false;
    this.userPaused = false;
    this.loadedIndex = null;
    this.savedTime = 0;
    this.rotation = null;
    this.transition = null;
    this.generation = 0;
    this.destroyed = false;
    this.video.muted = true;
    this.onPrevious = () => this.show(this.index - 1, true);
    this.onNext = () => this.show(this.index + 1, true);
    this.onPause = () => {
      if (this.media.matches) return;
      this.userPaused = !this.userPaused;
      this.sync();
    };
    this.onVisibility = () => this.sync();
    this.onMotion = () => this.sync();
    this.onPlaying = () => {
      if (!this.canPlay) { this.video.pause(); return; }
      this.video.classList.add('is-playing');
      this.scheduleRotation();
    };
    this.onLoaded = () => {
      if (this.savedTime > 0 && Number.isFinite(this.video.duration)) {
        this.video.currentTime = Math.min(this.savedTime, Math.max(0, this.video.duration - .05));
        this.savedTime = 0;
      }
    };
    this.onError = () => {
      this.userPaused = true;
      this.clearTimers();
      this.unload();
      this.controls();
    };
    this.previous.addEventListener('click', this.onPrevious);
    this.next.addEventListener('click', this.onNext);
    this.pause.addEventListener('click', this.onPause);
    this.document.addEventListener('visibilitychange', this.onVisibility);
    this.media.addEventListener('change', this.onMotion);
    this.video.addEventListener('playing', this.onPlaying);
    this.video.addEventListener('loadedmetadata', this.onLoaded);
    this.video.addEventListener('error', this.onError);
    const observer = options.observer || (callback => new IntersectionObserver(callback, {threshold: .15}));
    this.observer = observer(entries => {
      this.visible = entries.some(entry => entry.target === root && entry.isIntersecting && entry.intersectionRatio >= .15);
      this.sync();
    });
    this.observer.observe(root);
    root.querySelector('[data-specimen-controls]').hidden = false;
    this.updateText();
    this.controls();
  }

  get canPlay() {
    return !this.destroyed && this.visible && !this.document.hidden && !this.media.matches && !this.userPaused;
  }

  controls() {
    this.root.classList.toggle('motion-reduced', this.media.matches);
    this.pause.disabled = this.media.matches;
    this.pause.textContent = this.media.matches ? 'Motion off' : this.userPaused ? 'Play' : 'Pause';
    this.pause.setAttribute('aria-label', this.media.matches ? 'Animations off for reduced motion' : this.userPaused ? 'Resume animations' : 'Pause animations');
    this.pause.setAttribute('aria-pressed', String(this.userPaused));
  }

  updateText(manual = false) {
    const item = specimens[this.index];
    this.poster.src = item.poster;
    this.name.textContent = item.name;
    this.count.textContent = `${this.index + 1} / ${specimens.length}`;
    if (manual) this.announcement.textContent = `${item.name}, ${this.index + 1} of ${specimens.length}`;
  }

  clearTimers() {
    if (this.rotation !== null) this.clock.clearTimeout(this.rotation);
    if (this.transition !== null) this.clock.clearTimeout(this.transition);
    this.rotation = this.transition = null;
  }

  unload() {
    this.video.pause();
    this.video.classList.remove('is-playing');
    if (this.video.hasAttribute('src')) {
      this.video.removeAttribute('src');
      this.video.load();
    }
    this.loadedIndex = null;
  }

  sync() {
    this.controls();
    if (!this.visible || this.document.hidden || this.media.matches || this.destroyed) {
      this.generation++;
      this.clearTimers();
      if (this.loadedIndex === this.index && Number.isFinite(this.video.currentTime)) this.savedTime = this.video.currentTime;
      this.unload();
      return;
    }
    if (this.userPaused) {
      this.generation++;
      this.clearTimers();
      this.video.pause();
      return;
    }
    this.play();
  }

  play() {
    if (!this.canPlay || this.transition !== null) return;
    if (this.loadedIndex !== this.index) {
      this.video.src = specimens[this.index].video;
      this.loadedIndex = this.index;
      this.video.load();
    }
    const generation = this.generation;
    const promise = this.video.play();
    promise?.catch(() => {
      // A cancelled load can reject after a later selection. It must not stop that selection.
      if (generation !== this.generation || !this.canPlay) return;
      this.userPaused = true;
      this.clearTimers();
      this.controls();
    });
    if (!this.video.paused) this.scheduleRotation();
  }

  scheduleRotation() {
    if (!this.canPlay || this.rotation !== null) return;
    this.rotation = this.clock.setTimeout(() => {
      this.rotation = null;
      if (this.canPlay) this.show(this.index + 1);
    }, this.interval);
  }

  show(index, manual = false) {
    if (this.destroyed) return;
    this.generation++;
    this.clearTimers();
    const hadMovie = this.loadedIndex !== null;
    this.index = (index + specimens.length) % specimens.length;
    this.savedTime = 0;
    this.updateText(manual);
    this.video.pause();
    this.video.classList.remove('is-playing');
    if (!this.canPlay) {
      this.unload();
      this.controls();
      return;
    }
    if (hadMovie && this.fade > 0) {
      this.transition = this.clock.setTimeout(() => {
        this.transition = null;
        this.unload();
        this.play();
      }, this.fade);
    } else {
      this.unload();
      this.play();
    }
  }

  destroy() {
    this.destroyed = true;
    this.sync();
    this.observer.disconnect();
    this.previous.removeEventListener('click', this.onPrevious);
    this.next.removeEventListener('click', this.onNext);
    this.pause.removeEventListener('click', this.onPause);
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    this.media.removeEventListener('change', this.onMotion);
    this.video.removeEventListener('playing', this.onPlaying);
    this.video.removeEventListener('loadedmetadata', this.onLoaded);
    this.video.removeEventListener('error', this.onError);
  }
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-specimen-showcase]').forEach(root => new SpecimenShowcase(root));
}
