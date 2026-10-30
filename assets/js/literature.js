(() => {
  'use strict';

  const root = document.querySelector('.lw[data-source]');
  if (!root || !root.querySelector('#lw-filters')) return;
  const byId = (id) => root.querySelector(`#lw-${id}`);
  const PAGE_SIZE = 50;
  const formatNumber = (value) => value.toLocaleString('en-US');
  const normalize = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const categoryDescriptions = {
    hardware: 'Devices and computer architecture',
    cluster: 'Fleets and datacenters',
    workload: 'Software and applications',
  };
  const selections = { category: new Set(), year: new Set(), venue: new Set() };
  const controls = [];
  const openAbstracts = new Set();
  let papers = [];
  let years = [];
  let venues = [];
  let query = '';
  let shown = PAGE_SIZE;
  let searchTimer;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function readURL() {
    const params = new URLSearchParams(window.location.search);
    const allowed = { category: Object.keys(categoryDescriptions), year: years, venue: venues };
    Object.entries(selections).forEach(([group, selection]) => {
      selection.clear();
      params.getAll(group).forEach((value) => {
        if (allowed[group].includes(value)) selection.add(value);
      });
    });
    query = params.get('q') || '';
    byId('search').value = query;
    shown = PAGE_SIZE;
    render(true);
  }

  function writeURL(replace) {
    const url = new URL(window.location.href);
    ['q', ...Object.keys(selections)].forEach((key) => url.searchParams.delete(key));
    if (query.trim()) url.searchParams.set('q', query.trim());
    Object.entries(selections).forEach(([group, selection]) => {
      [...selection].sort().forEach((value) => url.searchParams.append(group, value));
    });
    if (url.href !== window.location.href) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    }
  }

  function commit(replace = false) {
    clearTimeout(searchTimer);
    query = byId('search').value;
    shown = PAGE_SIZE;
    writeURL(replace);
    render();
  }

  function toggle(group, value) {
    if (selections[group].has(value)) selections[group].delete(value);
    else selections[group].add(value);
    commit();
  }

  function focusFilter(group, value) {
    const control = controls.find(({ button, group: key, value: item }) =>
      key === group && item === value && !button.disabled &&
      (button.parentElement !== byId('venue-grid') || !byId('venue-browser').hidden));
    (control ? control.button : byId('search')).focus();
  }

  function filterButton(group, value, isGrid = false) {
    const button = element('button', 'lw-button');
    button.type = 'button';
    button.dataset.group = group;
    button.dataset.value = value;
    const label = group === 'category' ? value[0].toUpperCase() + value.slice(1) : value;
    const count = element('span', 'lw-filter-count');
    count.setAttribute('aria-hidden', 'true');
    button.append(element('span', '', label), count);
    if (group === 'category') button.title = categoryDescriptions[value];
    button.addEventListener('click', () => toggle(group, value));
    controls.push({ button, count, group, value, label, isGrid });
    return button;
  }

  function buildControls() {
    byId('category-filters').replaceChildren(...Object.keys(categoryDescriptions).map((value) => filterButton('category', value)));
    byId('year-filters').replaceChildren(...years.map((value) => filterButton('year', value)));
    const totals = new Map(venues.map((venue) => [venue, 0]));
    papers.forEach((paper) => totals.set(paper.venue, totals.get(paper.venue) + 1));
    const preferred = ['HPCA', 'ISCA', 'MICRO', 'ASPLOS'].filter((venue) => venues.includes(venue));
    const ranked = [...venues].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b));
    const quick = [...new Set([...preferred, ...ranked])].slice(0, 5);
    byId('venue-filters').replaceChildren(...quick.map((value) => filterButton('venue', value)));
    byId('venue-grid').replaceChildren(...venues.map((value) => filterButton('venue', value, true)));
  }

  // OR within one row; AND between rows. Facet counts ignore their own row.
  function matches(paper, tokens, except) {
    if (!tokens.every((token) => paper.search.includes(token))) return false;
    if (except !== 'category' && selections.category.size && !paper.categories.some((value) => selections.category.has(value))) return false;
    if (except !== 'year' && selections.year.size && !selections.year.has(String(paper.year))) return false;
    if (except !== 'venue' && selections.venue.size && !selections.venue.has(paper.venue)) return false;
    return true;
  }

  function renderControlCounts(tokens) {
    const counts = { category: new Map(), year: new Map(), venue: new Map() };
    Object.keys(counts).forEach((group) => {
      papers.forEach((paper) => {
        if (!matches(paper, tokens, group)) return;
        const values = group === 'category' ? paper.categories : [group === 'year' ? String(paper.year) : paper.venue];
        values.forEach((value) => counts[group].set(value, (counts[group].get(value) || 0) + 1));
      });
    });
    controls.forEach(({ button, count, group, value, label }) => {
      const total = counts[group].get(value) || 0;
      const selected = selections[group].has(value);
      count.textContent = formatNumber(total);
      button.setAttribute('aria-label', `${label}, ${formatNumber(total)} ${total === 1 ? 'paper' : 'papers'}`);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = total === 0 && !selected;
    });
    renderVenueSearch();
  }

  function renderVenueSearch() {
    const venueQuery = normalize(byId('venue-search').value.trim());
    let visible = 0;
    controls.filter((control) => control.isGrid).forEach(({ button, value }) => {
      button.hidden = !normalize(value).includes(venueQuery);
      if (!button.hidden) visible += 1;
    });
    byId('venue-count').textContent = `${visible} of ${venues.length} ${venues.length === 1 ? 'venue' : 'venues'}`;
    byId('no-venues').hidden = visible > 0;
  }

  function renderSelections() {
    const chips = [];
    const addChip = (label, onClick) => {
      const button = element('button', 'lw-button', `${label} ×`);
      button.type = 'button';
      button.setAttribute('aria-label', `Remove ${label} filter`);
      button.addEventListener('click', onClick);
      chips.push(button);
    };
    if (query.trim()) addChip(`Search: ${query.trim()}`, clearSearch);
    Object.entries(selections).forEach(([group, selection]) => {
      selection.forEach((value) => addChip(value, () => {
        toggle(group, value);
        focusFilter(group, value);
      }));
    });
    byId('active-filters').replaceChildren(...chips);
    byId('active-filter-bar').hidden = chips.length === 0;
    byId('clear-search').hidden = !query;
  }

  function paperElement(paper) {
    const article = element('article', 'lw-item');
    article.id = paper.id;
    const side = element('div', 'lw-side');
    const venue = element('button', 'lw-venue lw-paper-filter', paper.venue_label);
    venue.type = 'button';
    venue.setAttribute('aria-label', `Filter by ${paper.venue}`);
    venue.addEventListener('click', () => {
      toggle('venue', paper.venue);
      focusFilter('venue', paper.venue);
    });
    side.append(venue, element('span', 'visually-hidden', 'Categories:'));
    const tags = element('ul', 'lw-tags');
    paper.categories.forEach((category) => {
      const tag = element('button', `lw-tag lw-tag--${category} lw-paper-filter`, category);
      tag.type = 'button';
      tag.setAttribute('aria-label', `Filter by ${category}`);
      tag.setAttribute('aria-pressed', String(selections.category.has(category)));
      tag.addEventListener('click', () => {
        toggle('category', category);
        focusFilter('category', category);
      });
      const item = element('li');
      item.append(tag);
      tags.append(item);
    });
    side.append(tags);
    const main = element('div', 'lw-main');
    const title = element('h3', 'lw-title');
    // Metadata is untrusted: use textContent and restrict link protocols.
    if (/^https?:\/\//i.test(paper.url)) {
      const link = element('a', '', paper.title);
      link.href = paper.url;
      title.append(link);
    } else title.textContent = paper.title;
    const byline = element('div', 'lw-byline');
    const shortAuthors = paper.authors.length > 4
      ? `${paper.first_author_family || paper.authors[0].split(' ').pop()} et al.`
      : paper.authors.join(', ');
    byline.append(element('p', 'lw-authors', shortAuthors));
    const details = element('details', 'lw-abstract');
    details.open = openAbstracts.has(paper.id);
    const summary = element('summary', '', 'Abstract');
    summary.setAttribute('aria-label', `Abstract for ${paper.title}`);
    details.append(summary, element('p', '', paper.abstract));
    if (paper.authors.length > 4) details.append(element('p', 'lw-all-authors', `Authors: ${paper.authors.join(', ')}`));
    details.addEventListener('toggle', () => {
      if (details.open) openAbstracts.add(paper.id);
      else openAbstracts.delete(paper.id);
    });
    byline.append(details);
    main.append(title, byline);
    article.append(side, main);
    return article;
  }

  function render(revealHash = false) {
    const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
    const results = papers.filter((paper) => matches(paper, tokens));
    let anchor;
    if (revealHash && window.location.hash) {
      try { anchor = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { /* Ignore malformed anchors. */ }
      const index = results.findIndex((paper) => paper.id === anchor);
      if (index >= 0) shown = Math.max(shown, Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE);
    }
    renderControlCounts(tokens);
    renderSelections();
    const fragment = document.createDocumentFragment();
    const visible = results.slice(0, shown);
    let currentYear;
    let section;
    visible.forEach((paper) => {
      if (currentYear !== paper.year) {
        currentYear = paper.year;
        section = element('section', 'lw-year');
        const heading = element('h2', 'lw-year-label', String(paper.year));
        heading.id = `lw-${paper.year}`;
        section.setAttribute('aria-labelledby', heading.id);
        section.append(heading);
        fragment.append(section);
      }
      section.append(paperElement(paper));
    });
    byId('papers').replaceChildren(fragment);
    byId('result-count').textContent = `${formatNumber(results.length)} of ${formatNumber(papers.length)} papers`;
    byId('empty-state').hidden = results.length > 0;
    byId('more-row').hidden = visible.length >= results.length;
    byId('show-more').textContent = `Show ${Math.min(PAGE_SIZE, results.length - visible.length)} more papers`;
    byId('shown-count').textContent = `${formatNumber(visible.length)} of ${formatNumber(results.length)} shown`;
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
  }

  function clearSearch() {
    byId('search').value = '';
    commit();
    byId('search').focus();
  }

  function clearAll() {
    Object.values(selections).forEach((selection) => selection.clear());
    clearSearch();
  }

  function setBrowserExpanded(expanded) {
    byId('venue-browser').hidden = !expanded;
    byId('browse-venues').setAttribute('aria-expanded', String(expanded));
    byId('browse-venues').textContent = `${expanded ? 'Close venue browser' : 'Browse all venues'} ${expanded ? '−' : '+'}`;
  }

  function bindEvents() {
    byId('browse-venues').addEventListener('click', () => {
      const expanded = byId('venue-browser').hidden;
      setBrowserExpanded(expanded);
      if (expanded) byId('venue-search').focus();
    });
    byId('venue-search').addEventListener('input', renderVenueSearch);
    byId('search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => commit(true), 120);
    });
    byId('search').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') commit(true);
    });
    byId('clear-search').addEventListener('click', clearSearch);
    byId('clear-all').addEventListener('click', clearAll);
    byId('reset-empty').addEventListener('click', clearAll);
    byId('show-more').addEventListener('click', () => {
      const previous = shown;
      shown += PAGE_SIZE;
      render();
      const next = byId('papers').querySelectorAll('.lw-item')[previous];
      const target = next?.querySelector('.lw-title a, .lw-abstract summary');
      if (target) target.focus({ preventScroll: true });
    });
    window.addEventListener('popstate', () => {
      clearTimeout(searchTimer);
      readURL();
    });
    window.addEventListener('hashchange', () => render(true));
  }

  async function initialize() {
    try {
      const response = await fetch(root.dataset.source);
      if (!response.ok) throw new Error('Catalog unavailable');
      const catalog = await response.json();
      if (!Array.isArray(catalog)) throw new Error('Invalid catalog');
      papers = catalog.map((paper) => ({
        ...paper,
        search: normalize([paper.title, ...paper.authors, paper.abstract, paper.venue, paper.venue_label].join(' ')),
      })).sort((a, b) => b.sort_key.localeCompare(a.sort_key));
      years = [...new Set(papers.map((paper) => String(paper.year)))].sort().reverse();
      venues = [...new Set(papers.map((paper) => paper.venue))].sort((a, b) => a.localeCompare(b));
      const searchPlaceholder = `Search papers by title, author, abstract, in ${formatNumber(venues.length)} ${venues.length === 1 ? 'venue' : 'venues'}…`;
      byId('search').placeholder = searchPlaceholder;
      byId('search').setAttribute('aria-label', searchPlaceholder);
      root.querySelectorAll('details[open]').forEach((details) => openAbstracts.add(details.closest('.lw-item').id));
      buildControls();
      readURL();
      bindEvents();
      byId('legend').hidden = true;
      byId('filters').hidden = false;
    } catch (_) {
      byId('load-error').hidden = false;
    }
  }

  initialize();
})();
