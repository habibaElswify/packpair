"""Generate the Week 2 evidence visual for the status-update slide deck.

Produces a single PNG (3 panels) showing real output from the three AI
modules added this week:

    [A] Bayesian Beta posteriors evolving as rating count grows
    [B] CP-SAT solver timing: 12-student (Wk 1 brute-force vs Wk 2 CP-SAT) + 30-student
    [C] k-anonymity disclosure: which students' aggregates are public vs suppressed

Run: .venv/bin/python -m solver.render_evidence
Writes: docs/week2_evidence.png
"""

from __future__ import annotations

import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import beta as scipy_beta

from .cpsat_matcher import solve
from .privacy import DEFAULT_K, RollingAggregator
from .reputation import DIMENSIONS, ReputationStore, simulate_ratings
from .students import MOCK_POOL, synthetic_pool


UW_PURPLE = "#4b2e83"
UW_PURPLE_DARK = "#32235f"
UW_GOLD = "#ffc83d"
INK = "#1b1b1f"
INK_SOFT = "#4a4a55"
PANEL = "#f7f5fb"
GREEN = "#1f7a3a"
RED = "#b7202f"


def panel_a_bayesian(ax) -> None:
    """Beta posteriors after 0, 4, 12, 30 ratings for a 'true quality = 0.7' student."""
    true_q = 0.7
    rep = ReputationStore()
    snapshots = [0, 4, 12, 30]
    grid = np.linspace(0.001, 0.999, 400)

    cmap = plt.cm.viridis(np.linspace(0.15, 0.85, len(snapshots)))

    cum = 0
    for i, target_n in enumerate(snapshots):
        # Add (target_n - cum) more ratings to "Alex"
        if target_n > cum:
            simulate_ratings(rep, "Alex", true_q, n=target_n - cum, seed=42 + cum)
            cum = target_n
        post = rep.get("Alex").by_dim["participation"]
        pdf = scipy_beta.pdf(grid, post.alpha, post.beta)
        ax.plot(grid, pdf, color=cmap[i], linewidth=2.4,
                label=f"n = {target_n}")

    ax.axvline(true_q, linestyle="--", color=INK_SOFT, linewidth=1.2,
               label=f"true quality = {true_q}")
    ax.set_title("Bayesian reputation\nBeta posterior tightens with evidence",
                 fontsize=12, color=UW_PURPLE_DARK, fontweight="bold", pad=10)
    ax.set_xlabel("quality (0 = poor, 1 = strong)", color=INK_SOFT)
    ax.set_ylabel("posterior density", color=INK_SOFT)
    ax.set_xlim(0, 1)
    ax.legend(loc="upper left", frameon=False, fontsize=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def panel_b_timing(ax) -> None:
    """Side-by-side timing: Wk1 brute-force vs Wk2 CP-SAT @ 12, and CP-SAT @ 30."""
    # Live-measure CP-SAT at 12 and 30
    _, _, t12 = solve(MOCK_POOL, team_size=3)
    _, _, t30 = solve(synthetic_pool(30), team_size=3)

    # Reference: Wk 1 brute-force at 12 was 122 ms per the captured demo output.
    bars = [
        ("Wk 1 brute force\n(12 students)", 122.0, "#a89cc9"),
        ("Wk 2 CP-SAT\n(12 students)", t12 * 1000, UW_PURPLE),
        ("Wk 2 CP-SAT\n(30 students)", t30 * 1000, UW_PURPLE_DARK),
    ]
    labels = [b[0] for b in bars]
    values = [b[1] for b in bars]
    colors = [b[2] for b in bars]

    xs = np.arange(len(bars))
    ax.bar(xs, values, color=colors, width=0.6, edgecolor="white", linewidth=1.5)
    for x, v in zip(xs, values):
        text = f"{v:.0f} ms" if v < 1000 else f"{v/1000:.1f} s"
        ax.text(x, v * 1.04, text, ha="center", va="bottom",
                fontsize=11, color=INK, fontweight="bold")
    ax.set_xticks(xs)
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylabel("solve time (log scale)", color=INK_SOFT)
    ax.set_yscale("log")
    ax.set_ylim(10, max(values) * 4)
    ax.set_title("CP-SAT solver\nscales beyond brute-force limit (~15 students)",
                 fontsize=12, color=UW_PURPLE_DARK, fontweight="bold", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def panel_c_kanon(ax) -> None:
    """k-anonymity table: 6 students, some with n>=5 (disclosed), some n<5 (suppressed)."""
    import random
    rng = random.Random(7)

    agg = RollingAggregator(k=DEFAULT_K)
    # Pick 6 students; give them varying numbers of ratings to demonstrate the guard.
    sample = [("Alex Chen", 10), ("Maya Patel", 8), ("Jordan Kim", 2),
              ("Sara Ahmed", 5), ("Diego Lopez", 1), ("Priya Shah", 7)]
    for name, n_ratings in sample:
        for _ in range(n_ratings):
            for dim in DIMENSIONS:
                agg.record(name, dim, 1.0 + 4.0 * rng.random())

    ax.axis("off")
    ax.set_title("k-anonymity guard (k = 5)\nsuppresses small-window aggregates",
                 fontsize=12, color=UW_PURPLE_DARK, fontweight="bold", pad=10)

    # Build a small table
    col_labels = ["Student", "# ratings", "Participation", "Comm.", "Technical"]
    rows = []
    cell_colors = []
    for name, _ in sample:
        n = agg.count(name, "participation")
        cells = [name, str(n)]
        rgb = []
        for dim in DIMENSIONS:
            v = agg.aggregate(name, dim)
            if v is None:
                cells.append("—  suppressed")
                rgb.append("#fdecec")
            else:
                cells.append(f"{v:.2f}")
                rgb.append("#e6f4ea")
        rows.append(cells)
        cell_colors.append(["white", "white"] + rgb)

    tbl = ax.table(
        cellText=rows,
        colLabels=col_labels,
        cellLoc="center",
        loc="center",
        cellColours=cell_colors,
        colColours=[UW_PURPLE] * len(col_labels),
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(10.5)
    tbl.scale(1, 1.7)
    for (r, c), cell in tbl.get_celld().items():
        cell.set_edgecolor("#dddddd")
        if r == 0:
            cell.set_text_props(color="white", fontweight="bold")
        cell.set_linewidth(0.6)


def main() -> Path:
    fig = plt.figure(figsize=(18, 6.2), dpi=150)
    fig.patch.set_facecolor("white")
    gs = fig.add_gridspec(1, 3, wspace=0.42, left=0.04, right=0.99,
                          top=0.80, bottom=0.13)
    panel_a_bayesian(fig.add_subplot(gs[0, 0]))
    panel_b_timing(fig.add_subplot(gs[0, 1]))
    panel_c_kanon(fig.add_subplot(gs[0, 2]))

    fig.suptitle(
        "PackPair — Week 2 evidence: three AI layers, real output",
        fontsize=17, color=UW_PURPLE_DARK, fontweight="bold", y=0.965,
    )

    out = Path(__file__).resolve().parents[1] / "docs" / "week2_evidence.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=150, bbox_inches="tight", facecolor="white")
    print(f"Wrote {out}")
    return out


if __name__ == "__main__":
    main()
