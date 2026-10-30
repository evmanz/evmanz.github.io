# Literature Watch filter prototype

A separate, buildless prototype using the site's typography and paper layout.
Jekyll excludes `_prototypes/` from the public site by default.

Prepare the real feed and clearly labeled synthetic scale-demo data:

```sh
python3 _prototypes/literature-watch/prepare.py
```

Serve with Apple's container runtime, from the repository root:

```sh
container run --detach --name lw-filter-prototype --cpus 1 --memory 256M \
  --publish 127.0.0.1:4173:8000 \
  --volume "$(pwd)/_prototypes/literature-watch:/site:ro" \
  --workdir /site docker.io/library/python:3.12-slim \
  python -m http.server 8000 --bind 0.0.0.0
```

Open <http://127.0.0.1:4173/>. Stop with:

```sh
container stop lw-filter-prototype
```

The prototype opens on a 10,000-paper demo with synthetic records spanning
34 representative venues. Abstract lengths follow the current real feed's
distribution, with varied synthetic text. No sample titles are linked to real
publications. The current feed contains real paper links. Switching datasets
resets filters. Pass `--sample-count N` to `prepare.py` to change the demo size.

The whole data file, including all abstracts, is downloaded up front. This is
the original prototype architecture, without a search index, worker, or lazy
loading. Only 50 results are initially rendered. "Show more" increases that
number, so extensive use also increases the page's DOM size. The local Python
server serves the payload uncompressed; network loading differs from production.

`benchmark-results.json` records a local Chromium run with browser caching
disabled: five fresh-page runs each at normal CPU speed and a simulated 4x CPU
slowdown, plus one run with 10 Mbps bandwidth and 80ms latency. Ready time ends
after the initial results paint. Filter/search timings include the following
paint, and search also includes the existing 120ms debounce. These are local
measurements, not production timings or measurements of a physical mobile phone.

To repeat in an environment with Playwright and its Chromium browser installed:

```sh
python3 _prototypes/literature-watch/benchmark.py --url http://127.0.0.1:4173/
```

The benchmark also checks real-feed mode, combined filters, searches across all
10,000 records, URL restoration, abstracts, pagination, and mobile-width layout.

Filters use OR within a row and AND between rows. Counts reflect the current
search and other rows, so each row shows the options available in context.
Filtering considers the entire dataset before displaying 50 results at a time.
The URL retains the dataset, search, and selected filters; browser history works
for filter changes. No backend, framework, dropdown, or external service is used.
