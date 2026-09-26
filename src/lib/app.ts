import { CosmicAudio, type AudioState } from './audio';
import { Sky } from './sky';
import { currentYearMonth, formatDuration, monthsBetween, parseIso, yearsSince } from './time';

const TABS = ['about', 'missions', 'skills', 'contact'] as const;
type Tab = (typeof TABS)[number];

const SILENT_KEYS = new Set(['Tab', 'Shift', 'CapsLock', 'Escape', 'Meta', 'Control', 'Alt', 'AltGraph', 'Fn', 'ContextMenu']);

const isTab = (value: string | undefined): value is Tab => !!value && (TABS as readonly string[]).includes(value);
const panFor = (x: number) => (x / Math.max(1, window.innerWidth)) * 1.2 - 0.6;
const randomPan = () => Math.random() * 1.2 - 0.6;

function renderSound(state: AudioState): void {
  const root = document.documentElement;
  root.classList.toggle('is-muted', state.muted);
  root.classList.toggle('is-ambient', state.ambient && !state.muted);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')) {
    button.setAttribute('aria-pressed', String(!state.muted));
    const label = button.querySelector('.sound-label');
    if (label) label.textContent = state.muted ? 'SOUND OFF' : 'SOUND ON';
  }
  const hint = document.querySelector<HTMLElement>('[data-sound-hint]');
  if (!hint) return;
  const verb = window.matchMedia('(pointer: coarse)').matches ? 'TAP' : 'CLICK';
  if (state.muted) hint.textContent = 'SOUND IS OFF — SWITCH IT ON, TOP RIGHT';
  else if (state.ambient) hint.textContent = `AMBIENT ON · ${verb} ANYWHERE, TYPE ANYTHING`;
  else if (state.started) hint.textContent = `SOUND ON · ${verb} ANYWHERE, TYPE ANYTHING`;
  else hint.textContent = `${verb} ANYWHERE — THE COSMOS WILL ANSWER`;
}

function refreshLiveNumbers(): void {
  const now = currentYearMonth();
  for (const el of document.querySelectorAll<HTMLElement>('[data-years-since]')) {
    const start = parseIso(el.dataset.yearsSince);
    if (start) el.textContent = String(yearsSince(start, now));
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-duration-since]')) {
    const start = parseIso(el.dataset.durationSince);
    if (start) el.textContent = formatDuration(monthsBetween(start, now));
  }
}

function createSky(): Sky | null {
  const staticCanvas = document.getElementById('sky-static');
  const fxCanvas = document.getElementById('sky-fx');
  if (!(staticCanvas instanceof HTMLCanvasElement) || !(fxCanvas instanceof HTMLCanvasElement)) return null;
  const horizonCanvas = document.getElementById('sky-horizon');
  const sky = new Sky({
    staticCanvas,
    fxCanvas,
    horizonCanvas: horizonCanvas instanceof HTMLCanvasElement ? horizonCanvas : null,
    lantern: document.getElementById('lantern'),
  });
  sky.start();
  return sky;
}

function init(): void {
  const root = document.documentElement;
  const sky = createSky();
  const audio = new CosmicAudio(renderSound);
  const views = [...document.querySelectorAll<HTMLElement>('[data-view]')];
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.tabs [data-tab], .tabbar [data-tab]')];
  let activeTab: Tab | null = null;
  let openDialog: HTMLDialogElement | null = null;
  let litKey: string | null = null;

  refreshLiveNumbers();

  const showTab = (tab: Tab, sound: boolean) => {
    if (!views.length) return;
    if (sound) audio.play(tab === activeTab ? 'ping' : 'chirp');
    if (tab === activeTab) return;
    activeTab = tab;
    for (const view of views) view.classList.toggle('is-active', view.dataset.view === tab);
    for (const link of navLinks) link.setAttribute('aria-current', link.dataset.tab === tab ? 'page' : 'false');
    window.scrollTo(0, 0);
  };

  const openDossier = (id: string, sound: boolean) => {
    const dialog = document.getElementById(`dossier-${id}`);
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (openDialog && openDialog !== dialog) openDialog.close();
    if (!dialog.open) dialog.showModal();
    openDialog = dialog;
    root.classList.add('has-dialog');
    if (sound) audio.play('warp');
    history.replaceState(null, '', `#missions/${id}`);
  };

  const closeDossier = (sound: boolean) => {
    const dialog = openDialog;
    if (!dialog) return;
    openDialog = null;
    dialog.close();
    root.classList.remove('has-dialog');
    if (sound) audio.play('warpOut');
    history.replaceState(null, '', '#missions');
  };

  const route = (sound: boolean) => {
    const [tabPart, missionPart] = window.location.hash.replace(/^#/, '').split('/');
    const tab = isTab(tabPart) ? tabPart : 'about';
    if (openDialog && !(tab === 'missions' && missionPart && openDialog.id === `dossier-${missionPart}`)) closeDossier(false);
    showTab(tab, sound);
    if (tab === 'missions' && missionPart && (!openDialog || openDialog.id !== `dossier-${missionPart}`)) openDossier(missionPart, false);
  };

  const light = (key: string | null) => {
    if (key === litKey) return;
    if (litKey) for (const el of document.querySelectorAll(`[data-star="${CSS.escape(litKey)}"]`)) el.classList.remove('is-lit');
    litKey = key;
    if (key) for (const el of document.querySelectorAll(`[data-star="${CSS.escape(key)}"]`)) el.classList.add('is-lit');
  };

  route(false);
  window.addEventListener('popstate', () => route(true));

  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[data-dossier]')) {
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDossier(true);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      event.stopPropagation();
      closeDossier(true);
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const tabLink = target.closest<HTMLAnchorElement>('a[data-tab]');
    if (tabLink && isTab(tabLink.dataset.tab)) {
      event.preventDefault();
      if (tabLink.dataset.tab !== activeTab) history.pushState(null, '', `#${tabLink.dataset.tab}`);
      showTab(tabLink.dataset.tab, true);
    }

    const planet = target.closest<HTMLElement>('[data-mission]');
    if (planet?.dataset.mission) openDossier(planet.dataset.mission, true);

    const go = target.closest<HTMLButtonElement>('[data-dossier-go]');
    if (go?.dataset.dossierGo && !go.disabled) openDossier(go.dataset.dossierGo, true);

    if (target.closest('[data-dossier-close]')) closeDossier(true);

    if (target.closest('[data-sound-toggle]')) audio.toggle();

    const chip = target.closest<HTMLElement>('.chip[data-star]');
    if (chip) {
      light(chip.dataset.star ?? null);
      audio.play('star', panFor(event.clientX), Number(chip.dataset.level ?? 0.5));
    }

    // Keyboard-activated clicks carry no pointer position; they get their own sound, not a ripple.
    if (event.detail === 0) return;
    sky?.ripple(event.clientX, event.clientY);
    if (!target.closest('[data-sfx]')) audio.play('ping', panFor(event.clientX));
  });

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || SILENT_KEYS.has(event.key)) return;
    const tag = event.target instanceof HTMLElement ? event.target.tagName : '';
    if ((event.key === 'Enter' || event.key === ' ') && (tag === 'BUTTON' || tag === 'A')) return;
    if (event.key === 'Enter') audio.play('enter');
    else if (event.key === 'Backspace' || event.key === 'Delete') audio.play('back', randomPan());
    else {
      audio.play('key', randomPan());
      sky?.birth();
    }
  });

  document.addEventListener('pointerover', (event) => {
    const chip = event.target instanceof Element ? event.target.closest<HTMLElement>('.chip[data-star]') : null;
    if (chip) light(chip.dataset.star ?? null);
  });
  document.addEventListener('pointerout', (event) => {
    const chip = event.target instanceof Element ? event.target.closest('.chip[data-star]') : null;
    if (chip && !(event.relatedTarget instanceof Node && chip.contains(event.relatedTarget))) light(null);
  });
  document.addEventListener('focusin', (event) => {
    const chip = event.target instanceof Element ? event.target.closest<HTMLElement>('.chip[data-star]') : null;
    light(chip?.dataset.star ?? null);
  });

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') sky?.pointerMove(event.clientX, event.clientY);
  });
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) sky?.pointerLeave();
  });

  const onScroll = () => root.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const form = document.querySelector<HTMLFormElement>('form[data-transmission]');
  if (form) {
    const note = form.querySelector<HTMLElement>('[data-note]');
    const message = form.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
    const setNote = (text: string) => {
      if (note) note.textContent = text;
    };
    message?.addEventListener('input', () => {
      const length = message.value.trim().length;
      setNote(length ? `${length} CHARACTERS · READY` : 'CHANNEL IDLE');
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const text = String(data.get('message') ?? '').trim();
      if (!text) {
        audio.play('back');
        setNote('TYPE A MESSAGE FIRST');
        message?.focus();
        return;
      }
      const name = String(data.get('name') ?? '').trim();
      const reply = String(data.get('reply') ?? '').trim();
      const subject = `Transmission from ${name || 'your website'}`;
      const body = reply ? `${text}\n\nReply-to: ${reply}` : text;
      audio.play('enter');
      sky?.shower();
      setNote('HANDED TO YOUR MAIL APP');
      window.location.href = `mailto:${form.dataset.transmission}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
