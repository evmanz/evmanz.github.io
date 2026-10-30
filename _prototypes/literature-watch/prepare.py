"""Prepare local-only paper data. Run again after the real feed changes."""
import argparse
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--sample-count", type=int, default=10_000)
args = parser.parse_args()
if args.sample_count < 1:
    parser.error("--sample-count must be positive")
papers = []
for path in sorted((ROOT / "_data" / "literature").rglob("*.json")):
    papers.extend(json.loads(path.read_text())["papers"])

# Representative venue names to exercise a long filter list. These sample
# records do not claim that any particular paper was published at a venue.
venues = [
    "ASPLOS", "ATC", "CAL", "CC", "CGO", "DAC", "DATE", "DSN", "EuroSys",
    "FAST", "FSE", "HPCA", "HPDC", "ICCAD", "ICCD", "ICDCS", "ICSE", "ICS",
    "IISWC", "IPDPS", "ISCA", "ISPASS", "ISSRE", "ITC", "MICRO", "MLSys",
    "OSDI", "PACT", "PPoPP", "SC", "SIGMETRICS", "SOSP", "SPAA", "VTS",
]
subjects = [
    ("Detecting silent data corruption in large-scale computing", ["cluster", "hardware"], "silent data corruption datacenter fleet detection"),
    ("Understanding memory faults under production workloads", ["hardware", "workload"], "memory faults DRAM workload reliability"),
    ("Error correction for emerging memory systems", ["hardware"], "ECC error correction memory architecture"),
    ("Characterizing transient errors in GPU applications", ["hardware", "workload"], "GPU transient fault injection resilience application"),
    ("Resilient distributed execution with selective replication", ["cluster", "workload"], "replication distributed execution resilience"),
    ("Measuring fault coverage in processor testing", ["hardware"], "processor testing coverage fault detection"),
    ("Diagnosing hardware failures across a datacenter fleet", ["cluster", "hardware"], "datacenter fleet failure diagnosis telemetry"),
    ("Checkpoint strategies for reliable scientific computing", ["workload"], "checkpoint rollback scientific computing resilience"),
    ("Software defenses against intermittent hardware faults", ["workload", "hardware"], "software intermittent hardware faults mitigation"),
    ("Reliability-aware scheduling for heterogeneous clusters", ["cluster"], "scheduling heterogeneous cluster reliability"),
    ("Evaluating storage integrity under device failures", ["hardware", "cluster"], "storage integrity device failures SSD"),
    ("Improving application resilience with runtime checks", ["workload"], "runtime checks application resilience verification"),
]
samples = []
rng = random.Random(20261028)
# Match the current feed's abstract-length distribution so the scale test also
# exercises realistic text payloads and full-text scans, not just short rows.
abstract_lengths = [len(paper["abstract"]) for paper in papers if paper.get("abstract")] or [1743]
methods = ["controlled experiments", "trace-driven simulation", "statistical analysis", "targeted measurements", "comparative evaluation", "model-based reasoning", "automated instrumentation", "sensitivity analysis"]
components = ["the evaluated platform", "the monitored subsystem", "the baseline design", "the execution environment", "the target implementation", "the reference configuration"]
conditions = ["varying operating conditions", "sustained pressure", "heterogeneous configurations", "changing resource budgets", "representative execution patterns", "intermittent disturbances", "multiple deployment settings"]
metrics = ["coverage", "overhead", "recovery time", "availability", "throughput", "diagnostic precision", "tail latency", "resource utilization"]


def sample_abstract(keywords, target_length):
    text = f"Synthetic abstract for performance testing; this is not a real publication. Topic keywords: {keywords}."
    while len(text) < target_length:
        text += (
            f" Using {rng.choice(methods)}, we examine {rng.choice(components)} under {rng.choice(conditions)}."
            f" Across {rng.randint(12, 960)} illustrative configurations, {rng.choice(metrics)} changes by"
            f" {rng.uniform(0.1, 35):.2f} percent relative to the reference setting."
        )
    return text


for i in range(args.sample_count):
    title, categories, keywords = subjects[i % len(subjects)]
    venue = venues[i % len(venues)]
    year = 2026 - ((i // len(venues)) % 3)
    month = rng.randint(1, 12)
    date = f"{year}-{month:02d}-{rng.randint(1, 28):02d}"
    samples.append({
        "id": f"sample-{i + 1:05d}", "title": f"{title} — example {i + 1:05d}",
        "authors": [f"Sample Author {i + 1}", f"Example Researcher {i % 173 + 1}"], "venue": venue,
        "venue_label": f"{venue} {year}", "year": year, "date": date,
        "sort_key": f"{date}-{i:05d}", "categories": categories, "sample": True,
        "abstract": sample_abstract(keywords, rng.choice(abstract_lengths)),
    })

data = json.dumps({"real": papers, "sample": samples}, ensure_ascii=False, separators=(",", ":"))
(HERE / "papers.js").write_text("window.LITERATURE_DATA = " + data + ";\n")
print(f"Prepared {len(papers):,} real papers and {len(samples):,} sample papers across {len(venues)} venues.")
print(f"Data file: {(HERE / 'papers.js').stat().st_size / 1_000_000:.1f} MB uncompressed.")
