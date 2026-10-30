"""Measure the unchanged prototype architecture using Playwright Chromium.

Requires: pip install playwright && playwright install --with-deps chromium
Run outside the preview server container, e.g.:
    python benchmark.py --url http://127.0.0.1:4173/ --runs 5
"""
import argparse
import json
import statistics
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:4173/")
parser.add_argument("--runs", type=int, default=5)
parser.add_argument("--output", default="/tmp/lw-benchmark.json")
args = parser.parse_args()
if args.runs < 1:
    parser.error("--runs must be positive")

READY_SCRIPT = """document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.benchmarkReadyMs = performance.now();
  }));
});"""

# Both measurements include updating the DOM and reaching the next paint.
# Search also includes the application's intentional 120ms debounce.
ACTION_SCRIPT = """({selector, query}) => new Promise(resolve => {
  const start = performance.now();
  const control = document.querySelector(selector);
  if (query === undefined) {
    if (control.disabled) throw new Error('Benchmark control is disabled');
    control.click();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
  } else {
    const results = document.getElementById('papers');
    const observer = new MutationObserver(() => {
      observer.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
    });
    observer.observe(results, {childList: true});
    control.value = query;
    control.dispatchEvent(new Event('input', {bubbles: true}));
  }
})"""


def reset(page):
    page.evaluate("""() => new Promise(resolve => {
      const button = document.getElementById('clear-all');
      if (!document.getElementById('active-filter-bar').hidden) button.click();
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    })""")


def median(values):
    return round(statistics.median(values), 1)


def verify(page):
    expect(page.locator("#result-count")).to_have_text("10,000 papers · 34 venues")
    expect(page.locator(".paper")).to_have_count(50)
    assert page.locator("select").count() == 0
    page.locator("#show-more").click()
    expect(page.locator(".paper")).to_have_count(100)
    page.locator('#category-filters [data-value="hardware"]').click()
    expected = page.evaluate('window.LITERATURE_DATA.sample.filter(p => p.categories.includes("hardware")).length')
    expect(page.locator("#result-count")).to_have_text(f"{expected:,} of 10,000 papers")
    page.locator('#year-filters [data-value="2025"]').click()
    page.locator('#venue-filters [data-value="HPCA"]').click()
    expected = page.evaluate('window.LITERATURE_DATA.sample.filter(p => p.categories.includes("hardware") && p.year === 2025 && p.venue === "HPCA").length')
    expect(page.locator("#result-count")).to_have_text(f"{expected:,} of 10,000 papers")
    page.reload()
    expect(page.locator("#result-count")).to_have_text(f"{expected:,} of 10,000 papers")
    reset(page)
    page.locator("#paper-search").fill("example 10000")
    expect(page.locator("#result-count")).to_have_text("1 of 10,000 papers")
    expect(page.locator(".paper")).to_have_attribute("id", "sample-10000")
    page.locator(".paper-abstract summary").click()
    expect(page.locator(".paper-abstract")).to_have_attribute("open", "")
    reset(page)
    page.locator("#browse-venues").click()
    page.locator("#venue-search").fill("sosp")
    expect(page.locator("#venue-grid button:visible")).to_have_count(1)
    page.locator('#venue-grid [data-value="SOSP"]').click()
    page.locator('#venue-filters [data-value="HPCA"]').click()
    expected = page.evaluate('window.LITERATURE_DATA.sample.filter(p => ["SOSP", "HPCA"].includes(p.venue)).length')
    expect(page.locator("#result-count")).to_have_text(f"{expected:,} of 10,000 papers")
    reset(page)
    page.locator("#venue-search").fill("")
    for width in [1100, 680, 520, 375, 320]:
        page.set_viewport_size({"width": width, "height": 1000})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow at {width}px"
    page.set_viewport_size({"width": 1100, "height": 1000})
    page.goto(urljoin(args.url, "?dataset=real"))
    expect(page.locator("#result-count")).to_have_text("25 papers · 1 venue")
    page.locator('#category-filters [data-value="hardware"]').click()
    expect(page.locator("#result-count")).to_have_text("21 of 25 papers")


report = {
    "method": "Fresh Chromium contexts; browser cache disabled; median cold ready time includes next paint after DOMContentLoaded. Action timings include the next paint. Search timings include 120ms debounce. Local static HTTP serves data uncompressed.",
    "profiles": [],
}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(args=["--no-sandbox"])
    errors = []
    profiles = [
        ("Local desktop", 1, None, args.runs),
        ("4x CPU slowdown", 4, None, args.runs),
        ("4x CPU + 10 Mbps / 80ms latency", 4, 1_250_000, 1),
    ]
    for name, cpu_rate, throughput, runs in profiles:
        cold_ready, categories, years, venues, searches = [], [], [], [], []
        queries = ["memory", "silent corruption", "zz-no-matching-paper-zz"]
        for run in range(runs):
            context = browser.new_context(viewport={"width": 1100, "height": 1000})
            page = context.new_page()
            page.set_default_timeout(60_000)
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.add_init_script(READY_SCRIPT)
            cdp = context.new_cdp_session(page)
            cdp.send("Network.enable")
            cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": cpu_rate})
            if throughput:
                cdp.send("Network.emulateNetworkConditions", {
                    "offline": False, "latency": 80,
                    "downloadThroughput": throughput, "uploadThroughput": throughput,
                })
            page.goto(args.url, wait_until="load")
            page.wait_for_function("window.benchmarkReadyMs !== undefined")
            expect(page.locator(".paper")).to_have_count(50)
            cold_ready.append(page.evaluate("window.benchmarkReadyMs"))
            for selector, times in [
                ('#category-filters [data-value="hardware"]', categories),
                ('#year-filters [data-value="2025"]', years),
                ('#venue-filters [data-value="HPCA"]', venues),
            ]:
                reset(page)
                times.append(page.evaluate(ACTION_SCRIPT, {"selector": selector}))
            for query in queries:
                reset(page)
                searches.append(page.evaluate(ACTION_SCRIPT, {"selector": "#paper-search", "query": query}))
            if name == "Local desktop" and run == 0:
                report["data_bytes"] = page.evaluate("performance.getEntriesByType('resource').find(r => r.name.endsWith('/papers.js')).decodedBodySize")
                reset(page)
                report["initial_dom_elements"] = page.locator("*").count()
                report["data_records"] = page.evaluate("window.LITERATURE_DATA.sample.length")
                report["sample_mean_abstract_characters"] = round(page.evaluate("window.LITERATURE_DATA.sample.reduce((n,p) => n+p.abstract.length,0)/window.LITERATURE_DATA.sample.length"))
                report["real_mean_abstract_characters"] = round(page.evaluate("window.LITERATURE_DATA.real.reduce((n,p) => n+p.abstract.length,0)/window.LITERATURE_DATA.real.length"))
            if name == "Local desktop" and run == runs - 1:
                reset(page)
                verify(page)
            context.close()
        result = {
            "name": name, "cold_load_runs": runs,
            "cold_ready_median_ms": median(cold_ready),
            "cold_ready_range_ms": [round(min(cold_ready), 1), round(max(cold_ready), 1)],
            "category_update_median_ms": median(categories),
            "year_update_median_ms": median(years),
            "venue_update_median_ms": median(venues),
            "search_update_median_ms_including_debounce": median(searches),
        }
        report["profiles"].append(result)
        print(json.dumps(result), flush=True)
    assert not errors, errors
    report["functional_checks"] = "PASS: 10,000 records, 50 initial results, pagination, full-dataset search for record 10,000, abstracts, compound AND/OR filtering, URL restoration, venue browser, 320px layout, real-feed mode; no JavaScript errors."
    browser.close()

Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)
