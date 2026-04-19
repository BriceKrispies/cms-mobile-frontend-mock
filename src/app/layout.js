// App shell: <app-root> renders header, content outlet, and mobile bottom nav.
// Nav items and routes come from the feature registry.

import { defineOnce } from '../utils/dom.js';
import { getNavItems } from './registry.js';
import { appBus } from '../utils/events.js';
import { currentPath, navigate } from './router.js';

class AppRoot extends HTMLElement {
  connectedCallback() {
    this.classList.add('app-root');
    this.innerHTML = `
      <header class="app-header" role="banner">
        <div class="u-container app-header__inner">
          <button class="app-header__menu" type="button" aria-label="Open menu" data-action="menu">
            <span class="app-header__menu-bar"></span>
            <span class="app-header__menu-bar"></span>
            <span class="app-header__menu-bar"></span>
          </button>
          <a class="app-header__brand" href="#/">
            <span class="app-header__brand-mark" aria-hidden="true">R</span>
            <span class="app-header__brand-name">Recognition CMS</span>
          </a>
          <div class="app-header__actions">
            <ui-badge tone="info" size="sm">Mock</ui-badge>
          </div>
        </div>
        <nav class="app-header__rail" aria-label="Primary">
          <div class="u-container app-header__rail-inner" data-rail></div>
        </nav>
      </header>

      <main id="app-outlet" class="app-outlet" role="main"></main>

      <nav class="app-bottom-nav" aria-label="Sections" data-bottom-nav></nav>

      <ui-drawer class="app-drawer" id="app-drawer" aria-label="Navigation drawer"></ui-drawer>
    `;

    this.outlet = this.querySelector('#app-outlet');
    this.rail = this.querySelector('[data-rail]');
    this.bottomNav = this.querySelector('[data-bottom-nav]');
    this.drawer = this.querySelector('#app-drawer');

    this.querySelector('[data-action="menu"]').addEventListener('click', () => {
      this.drawer?.open();
    });

    appBus.on('route:change', () => this.#updateActive());
    appBus.on('nav:updated', () => this.renderNav());
    this.renderNav();
  }

  renderNav() {
    const items = getNavItems();
    const linkHtml = (item, variant) => `
      <a class="nav-link nav-link--${variant}" href="#${item.path}" data-path="${item.path}">
        <span class="nav-link__icon" aria-hidden="true">${item.icon ?? '•'}</span>
        <span class="nav-link__label">${item.label}</span>
      </a>
    `;
    this.rail.innerHTML = items.map((i) => linkHtml(i, 'rail')).join('');
    this.bottomNav.innerHTML = items.slice(0, 6).map((i) => linkHtml(i, 'bottom')).join('');
    this.drawer.innerHTML = `
      <div class="app-drawer__body">
        <h2 class="app-drawer__title">Menu</h2>
        <div class="app-drawer__list">
          ${items.map((i) => linkHtml(i, 'drawer')).join('')}
        </div>
      </div>
    `;
    this.drawer.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => this.drawer.close());
    });
    this.#updateActive();
  }

  #updateActive() {
    const path = currentPath();
    this.querySelectorAll('.nav-link').forEach((el) => {
      const target = el.dataset.path;
      const active = target === '/' ? path === '/' : path.startsWith(target);
      el.classList.toggle('is-active', active);
      if (active) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  get mountPoint() { return this.outlet; }
}

defineOnce('app-root', AppRoot);

export { AppRoot };
