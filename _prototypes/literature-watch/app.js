(() => {
  'use strict';

  const data = window.LITERATURE_DATA;
  const byId = (id) => document.getElementById(id);
  if (!data) {
    byId('dataset-note').textContent = 'Paper data is missing. Run prepare.py and reload this page.';
    return;
  }
  const PAGE_SIZE = 50;
  const formatNumber = (value) => value.toLocaleString('en-US');
  const categoryNames = ['hardware', 'cluster', 'workload'];
  const categoryDescriptions = {
    hardware: 'Devices and computer architecture',
    cluster: 'Fleets and datacenters',
    workload: 'Software and applications',
  };
  const normalize = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sets = { category: new Set(), year: new Set(), venue: new Set() };
  const controls = [];
  const openAbstracts = new Set();
  let dataset = 'sample';
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

  function resetSelections() {
    Object.values(sets).forEach((selection) => selection.clear());
    query = '';
    shown = PAGE_SIZE;
    byId('paper-search').value = '';
  }

  function prepareDataset(name) {
    dataset = name === 'real' ? 'real' : 'sample';
    papers = data[dataset].map((paper) => ({
      ...paper,
      search: normalize([paper.title, ...paper.authors, paper.abstract, paper.venue, paper.venue_label].join(' ')),
    })).sort((a, b) => b.sort_key.localeCompare(a.sort_key));
    years = [...new Set(papers.map((paper) => String(paper.year)))].sort().reverse();
    venues = [...new Set(papers.map((paper) => paper.venue))].sort((a, b) => a.localeCompare(b));
    const searchPlaceholder = `Search papers by title, author, abstract, in ${formatNumber(venues.length)} ${venues.length === 1 ? 'venue' : 'venues'}…`;
    byId('paper-search').placeholder = searchPlaceholder;
    byId('paper-search').setAttribute('aria-label', searchPlaceholder);
    byId('venue-search').value = '';
    byId('venue-browser').hidden = true;
    setBrowserExpanded(false);
    document.querySelectorAll('[data-dataset]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.dataset === dataset));
      if (button.dataset.dataset === 'sample') button.textContent = `${formatNumber(data.sample.length)}-paper demo`;
    });
    byId('dataset-note').classList.toggle('is-sample', dataset === 'sample');
    byId('dataset-note').textContent = dataset === 'sample'
      ? `Scale demo · ${formatNumber(papers.length)} illustrative papers across ${venues.length} venues, with full-length synthetic abstracts. These are not real publications.`
      : `Current feed · ${papers.length} real papers. Switch to the ${formatNumber(data.sample.length)}-paper demo to explore a larger venue list.`;
    buildControls();
  }

  function readURL() {
    const params = new URLSearchParams(window.location.search);
    resetSelections();
    prepareDataset(params.get('dataset'));
    query = params.get('q') || '';
    byId('paper-search').value = query;
    const allowed = { category: categoryNames, year: years, venue: venues };
    Object.keys(sets).forEach((group) => {
      params.getAll(group).forEach((value) => {
        if (allowed[group].includes(value)) sets[group].add(value);
      });
    });
    render();
  }

  function writeURL(replace = false) {
    const url = new URL(window.location.href);
    ['dataset', 'q', ...Object.keys(sets)].forEach((key) => url.searchParams.delete(key));
    url.searchParams.set('dataset', dataset);
    if (query.trim()) url.searchParams.set('q', query.trim());
    Object.entries(sets).forEach(([key, selection]) => {
      [...selection].sort().forEach((value) => url.searchParams.append(key, value));
    });
    if (url.href !== window.location.href) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    }
  }

  function commit(replace = false) {
    clearTimeout(searchTimer);
    // Read the field as well so a quick click during typing never drops text.
    query = byId('paper-search').value;
    shown = PAGE_SIZE;
    writeURL(replace);
    render();
  }

  function toggle(group, value) {
    if (sets[group].has(value)) sets[group].delete(value);
    else sets[group].add(value);
    commit();
  }

  function filterButton(group, value, isGrid = false) {
    const button = element('button', isGrid ? 'venue-option' : 'filter-button');
    button.type = 'button';
    button.dataset.group = group;
    button.dataset.value = value;
    button.setAttribute('aria-pressed', 'false');
    const label = group === 'category' ? value[0].toUpperCase() + value.slice(1) : value;
    button.append(element('span', '', label));
    const count = element('span', 'filter-count');
    count.setAttribute('aria-hidden', 'true');
    button.append(count);
    if (group === 'category') button.title = categoryDescriptions[value];
    button.addEventListener('click', () => toggle(group, value));
    controls.push({ button, count, group, value, label });
    return button;
  }

  function buildControls() {
    controls.length = 0;
    byId('category-filters').replaceChildren(...categoryNames.map((value) => filterButton('category', value)));
    byId('year-filters').replaceChildren(...years.map((value) => filterButton('year', value)));
    const preferred = ['HPCA', 'ISCA', 'MICRO', 'ASPLOS'];
    const totals = new Map(venues.map((venue) => [venue, papers.filter((paper) => paper.venue === venue).length]));
    const ranked = [...venues].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b));
    const quick = [...new Set([...preferred.filter((venue) => venues.includes(venue)), ...ranked])].slice(0, 5);
    byId('venue-filters').replaceChildren(...quick.map((value) => filterButton('venue', value)));
    byId('venue-grid').replaceChildren(...venues.map((value) => filterButton('venue', value, true)));
  }

  function matches(paper, tokens, except) {
    if (!tokens.every((token) => paper.search.includes(token))) return false;
    if (except !== 'category' && sets.category.size && !paper.categories.some((value) => sets.category.has(value))) return false;
    if (except !== 'year' && sets.year.size && !sets.year.has(String(paper.year))) return false;
    if (except !== 'venue' && sets.venue.size && !sets.venue.has(paper.venue)) return false;
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
      const selected = sets[group].has(value);
      count.textContent = formatNumber(total);
      button.setAttribute('aria-label', `${label}, ${total} ${total === 1 ? 'paper' : 'papers'}`);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = total === 0 && !selected;
    });
    renderVenueSearch();
  }

  function renderVenueSearch() {
    const venueQuery = normalize(byId('venue-search').value.trim());
    let visible = 0;
    controls.filter((control) => control.button.parentElement === byId('venue-grid')).forEach(({ button, value }) => {
      button.hidden = !normalize(value).includes(venueQuery);
      if (!button.hidden) visible += 1;
    });
    byId('venue-count').textContent = `${visible} of ${venues.length} venues`;
    byId('no-venues').hidden = visible > 0;
  }

  function renderSelections() {
    const chips = [];
    const addChip = (label, onClick) => {
      const button = element('button', '', `${label} ×`);
      button.type = 'button';
      button.setAttribute('aria-label', `Remove ${label} filter`);
      button.addEventListener('click', onClick);
      chips.push(button);
    };
    if (query.trim()) addChip(`Search: ${query.trim()}`, () => {
      byId('paper-search').value = '';
      commit();
      byId('paper-search').focus();
    });
    Object.entries(sets).forEach(([group, selection]) => {
      selection.forEach((value) => addChip(value, () => {
        toggle(group, value);
        const primary = controls.find((control) => control.group === group && control.value === value && !control.button.hidden && !control.button.disabled);
        const canFocus = primary && (primary.button.parentElement !== byId('venue-grid') || !byId('venue-browser').hidden);
        (canFocus ? primary.button : byId('paper-search')).focus();
      }));
    });
    byId('active-filters').replaceChildren(...chips);
    byId('active-filter-bar').hidden = chips.length === 0;
    byId('clear-search').hidden = !query;
  }

  function paperElement(paper) {
    const article = element('article', 'paper');
    article.id = paper.id;
    article.dataset.venue = paper.venue;
    article.dataset.year = paper.year;
    article.dataset.categories = paper.categories.join(' ');
    const side = element('div', 'paper-side');
    const venue = element('button', 'paper-venue', paper.venue_label);
    venue.type = 'button';
    venue.setAttribute('aria-label', `Filter by ${paper.venue}`);
    venue.addEventListener('click', () => toggle('venue', paper.venue));
    side.append(venue);
    const tags = element('div', 'paper-tags');
    paper.categories.forEach((category) => {
      const tag = element('button', `paper-tag paper-tag--${category}`, category);
      tag.type = 'button';
      tag.setAttribute('aria-label', `Filter by ${category}`);
      tag.setAttribute('aria-pressed', String(sets.category.has(category)));
      tag.addEventListener('click', () => toggle('category', category));
      tags.append(tag);
    });
    side.append(tags);
    if (paper.sample) side.append(element('span', 'sample-label', 'SAMPLE ENTRY'));
    const main = element('div', 'paper-main');
    const title = element('h3', 'paper-title');
    if (paper.url && /^https?:\/\//i.test(paper.url)) {
      const link = element('a', '', paper.title);
      link.href = paper.url;
      title.append(link);
    } else title.textContent = paper.title;
    main.append(title);
    const byline = element('div', 'paper-byline');
    const shortAuthors = paper.authors.length > 4
      ? `${paper.first_author_family || paper.authors[0].split(' ').pop()} et al.`
      : paper.authors.join(', ');
    byline.append(element('p', 'paper-authors', shortAuthors));
    const details = element('details', 'paper-abstract');
    const key = `${dataset}:${paper.id}`;
    details.open = openAbstracts.has(key);
    const summary = element('summary', '', 'Abstract');
    summary.setAttribute('aria-label', `Abstract for ${paper.title}`);
    details.append(summary, element('p', '', paper.abstract));
    if (paper.authors.length > 4) details.append(element('p', 'all-authors', `Authors: ${paper.authors.join(', ')}`));
    details.addEventListener('toggle', () => {
      if (details.open) openAbstracts.add(key);
      else openAbstracts.delete(key);
    });
    byline.append(details);
    main.append(byline);
    article.append(side, main);
    return article;
  }

  function render() {
    const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
    const matchesAll = papers.filter((paper) => matches(paper, tokens));
    renderControlCounts(tokens);
    renderSelections();
    const fragment = document.createDocumentFragment();
    let currentYear;
    let section;
    const visible = matchesAll.slice(0, shown);
    visible.forEach((paper) => {
      if (currentYear !== paper.year) {
        currentYear = paper.year;
        section = element('section', 'year-section');
        const heading = element('h2', 'year-label', String(paper.year));
        heading.id = `year-${paper.year}`;
        section.setAttribute('aria-labelledby', heading.id);
        section.append(heading);
        fragment.append(section);
      }
      section.append(paperElement(paper));
    });
    byId('papers').replaceChildren(fragment);
    byId('result-count').textContent = matchesAll.length === papers.length
      ? `${formatNumber(papers.length)} papers · ${venues.length} ${venues.length === 1 ? 'venue' : 'venues'}`
      : `${formatNumber(matchesAll.length)} of ${formatNumber(papers.length)} papers`;
    byId('empty-state').hidden = matchesAll.length > 0;
    byId('more-row').hidden = visible.length >= matchesAll.length;
    const remaining = matchesAll.length - visible.length;
    byId('show-more').textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more papers`;
    byId('shown-count').textContent = `${formatNumber(visible.length)} of ${formatNumber(matchesAll.length)} shown`;
  }

  function setBrowserExpanded(expanded) {
    byId('venue-browser').hidden = !expanded;
    byId('browse-venues').setAttribute('aria-expanded', String(expanded));
    byId('browse-venues').textContent = `${expanded ? 'Close venue browser' : 'Browse all venues'} ${expanded ? '−' : '+'}`;
  }

  byId('browse-venues').addEventListener('click', () => {
    const expanded = byId('venue-browser').hidden;
    setBrowserExpanded(expanded);
    if (expanded) byId('venue-search').focus();
  });
  byId('venue-search').addEventListener('input', renderVenueSearch);
  byId('paper-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => commit(true), 120);
  });
  byId('paper-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(true);
  });
  byId('clear-search').addEventListener('click', () => {
    byId('paper-search').value = '';
    commit();
    byId('paper-search').focus();
  });
  function clearAll() {
    resetSelections();
    commit();
    byId('paper-search').focus();
  }
  byId('clear-all').addEventListener('click', clearAll);
  byId('reset-empty').addEventListener('click', clearAll);
  byId('show-more').addEventListener('click', () => {
    const previous = shown;
    shown += PAGE_SIZE;
    render();
    const nextSummary = byId('papers').querySelectorAll('.paper-abstract summary')[previous];
    if (nextSummary) nextSummary.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-dataset]').forEach((button) => {
    button.addEventListener('click', () => {
      clearTimeout(searchTimer);
      resetSelections();
      prepareDataset(button.dataset.dataset);
      writeURL();
      render();
    });
  });
  window.addEventListener('popstate', () => {
    clearTimeout(searchTimer);
    readURL();
  });
  readURL();
})();
