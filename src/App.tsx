import React, { useMemo, useState, useEffect } from "react";

/**
 * Share Your Class Story — Alberta (28–29 ratios only)
 * Mobile-first UI. Sections stack vertically: Basics → Complexity → Results → Create & Share → Preview.
 * Generates a square 1080×1080 PNG with header, summary sentence, three bars (labels below),
 * remedies paragraph (same size as summary), and footer pills (incl. StopTheExcuses.ca).
 *
 * Notes (from prior fixes):
 * - Header text has no period for "MY CLASS IS COMPLEX".
 * - When class is within target, header becomes "MY CLASS IS COMPLEX" and summary still shows feels-like.
 * - “Should” bar is light green; other colours unchanged.
 * - Bars’ labels are full sentences placed **below** each bar.
 * - Remedies paragraph sized == summary, placed between bar labels and footer.
 */

type Counts = {
  mildModerate: number;
  ellFrancRefugee: number;
  targeted: number;
  gifted: number;
  severe: number;
  typical: number;
};

type Tags = {
  aboveSTR: boolean;
  highComplexity: boolean;
  multiGrade: boolean;
  shortSupport: boolean;
};

type Ctx = CanvasRenderingContext2D;

enum HeaderMode {
  Auto = "auto",
  Overcrowded = "overcrowded",
  Complex = "complex",
}

// 2028–29 targets (only)
const YEAR = { ratios: { K3: 17, G46: 23, G79: 25, G1012: 27 } } as const;

// complexity weights
const WEIGHTS = {
  typical: 1.0,
  mildModerate: 1.5,
  ellFrancRefugee: 1.5,
  targeted: 1.5,
  gifted: 1.25,
  severe: 2.0,
} as const;

const GRADE_CHOICES = [
  { key: "K", label: "Kindergarten" },
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "7", label: "7" },
  { key: "8", label: "8" },
  { key: "9", label: "9" },
  { key: "10", label: "10" },
  { key: "11", label: "11" },
  { key: "12", label: "12" },
] as const;

export default function App() {
  // Basics
  const [grades, setGrades] = useState<string[]>([]);
  const [isLabShop, setIsLabShop] = useState(false);
  const [actual, setActual] = useState(0);

  // Complexity inputs
  const [counts, setCounts] = useState<Counts>({
    mildModerate: 0,
    ellFrancRefugee: 0,
    targeted: 0,
    gifted: 0,
    severe: 0,
    typical: 0,
  });
  const [autoTypical, setAutoTypical] = useState(true);

  // Tags/pills
  const [tags, setTags] = useState<Tags>({
    aboveSTR: false,
    highComplexity: false,
    multiGrade: false,
    shortSupport: false,
  });

  // Header wording (user choice)
  const [headerMode, setHeaderMode] = useState<HeaderMode>(HeaderMode.Auto);

  // Output image
  const [lastDataUrl, setLastDataUrl] = useState<string | null>(null);

  // ---- Derived values ----
  const baseTarget = useMemo(() => {
    if (grades.length === 0) return 0;
    const sum = grades.reduce((acc, g) => {
      if (["K", "1", "2", "3"].includes(g)) return acc + YEAR.ratios.K3;
      if (["4", "5", "6"].includes(g)) return acc + YEAR.ratios.G46;
      if (["7", "8", "9"].includes(g)) return acc + YEAR.ratios.G79;
      return acc + YEAR.ratios.G1012;
    }, 0);
    const avg = sum / grades.length;
    const capped = isLabShop ? Math.min(24, avg) : avg;
    return Math.round(capped * 10) / 10;
  }, [grades, isLabShop]);

  const sumNonTypical =
    counts.mildModerate +
    counts.ellFrancRefugee +
    counts.targeted +
    counts.gifted +
    counts.severe;

  const finalTypical = autoTypical
    ? Math.max(0, actual - sumNonTypical)
    : counts.typical;

  const weighted = useMemo(() => {
    const w =
      finalTypical * WEIGHTS.typical +
      counts.mildModerate * WEIGHTS.mildModerate +
      counts.ellFrancRefugee * WEIGHTS.ellFrancRefugee +
      counts.targeted * WEIGHTS.targeted +
      counts.gifted * WEIGHTS.gifted +
      counts.severe * WEIGHTS.severe;
    return Math.round(w * 10) / 10;
  }, [finalTypical, counts]);

  const overLimit = weighted > baseTarget;
  const totalEntered = finalTypical + sumNonTypical;
  const mismatch = actual !== totalEntered;

  const gradeSentence = useMemo(() => {
    if (grades.length === 0) return "";
    const names = grades.map((g) =>
      g === "K" ? "Kindergarten" : `Grade ${g}`
    );
    if (names.length === 1) return `I teach ${names[0]}.`;
    if (names.length === 2) return `I teach ${names[0]} and ${names[1]}.`;
    const last = names[names.length - 1];
    return `I teach ${names.slice(0, -1).join(", ")}, and ${last}.`;
  }, [grades]);

  const caption = useMemo(() => {
    if (overLimit)
      return `My class should have ${baseTarget} students. It actually has ${actual}. With complexity, it feels like ${weighted}.`;
    return `My class meets Alberta's size target — but with complexity factors, it feels like teaching ${weighted}.`;
  }, [overLimit, baseTarget, actual, weighted]);

  // ---- Canvas helpers ----
  function roundRect(
    ctx: Ctx,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  /** Draw multi-line text and return the baseline Y of the last line. */
  function wrapText(
    ctx: Ctx,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): number {
    const words = String(text || "").split(" ");
    let line = "";
    let cursorY = y;
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      const width = ctx.measureText(test).width;
      if (width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, cursorY);
        line = words[n] + " ";
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, cursorY);
    return cursorY;
  }

  function buildPills(t: Tags, isOver: boolean) {
    const pills: string[] = [];
    if (t.aboveSTR || isOver) pills.push("Above STR");
    if (t.highComplexity) pills.push("High Complexity");
    if (t.multiGrade) pills.push("Multi-Grade");
    if (t.shortSupport) pills.push("Short on Support Staff");
    return pills;
  }
  /** Measure how tall wrapped text would be without drawing. */
  function measureWrappedHeight(
    ctx: Ctx,
    text: string,
    maxWidth: number,
    lineHeight: number
  ): number {
    const words = String(text || "").split(" ");
    let line = "";
    let height = lineHeight; // at least one line
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      const width = ctx.measureText(test).width;
      if (width > maxWidth && n > 0) {
        line = words[n] + " ";
        height += lineHeight;
      } else {
        line = test;
      }
    }
    return height;
  }

  /** Auto-fit a paragraph by reducing font size until it fits the box. Returns the final baseline Y. */
  function drawAutoFitParagraph(
    ctx: Ctx,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    startPx = 30,
    minPx = 16
  ): number {
    for (let px = startPx; px >= minPx; px -= 2) {
      const lh = Math.round(px * 1.3);
      ctx.font = `700 ${px}px Inter, ui-sans-serif, system-ui, -apple-system`;
      const h = measureWrappedHeight(ctx, text, maxWidth, lh);
      if (h <= maxHeight) {
        // draw for real with the same metrics
        return wrapText(ctx, text, x, y, maxWidth, lh);
      }
    }
    // If still too tall, draw at the smallest size available.
    const px = minPx;
    const lh = Math.round(px * 1.3);
    ctx.font = `700 ${px}px Inter, ui-sans-serif, system-ui, -apple-system`;
    return wrapText(ctx, text, x, y, maxWidth, lh);
  }

  // ---- Graphic generation ----
  function drawGraphic() {
    const size = 1080;
    const padding = 60;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    // ✅ Narrow once and keep a non-null alias
    const ctxMaybe = canvas.getContext("2d");
    if (!ctxMaybe) {
      console.error("Canvas 2D context unavailable");
      return;
    }
    const g: Ctx = ctxMaybe; // g is guaranteed non-null

    // Background gradient
    const bg = g.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, "#FEF08A");
    bg.addColorStop(1, "#FACC15");
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);

    // Header — auto/forced, no period for COMPLEX
    const headerText =
      headerMode === HeaderMode.Overcrowded
        ? "MY CLASS IS OVERCROWDED"
        : headerMode === HeaderMode.Complex
        ? "MY CLASS IS COMPLEX"
        : overLimit
        ? "MY CLASS IS OVERCROWDED"
        : "MY CLASS IS COMPLEX";

    g.fillStyle = "#111827";
    g.font = "800 56px Inter, ui-sans-serif, system-ui, -apple-system";
    const headerBottom = wrapText(
      g,
      headerText,
      padding,
      padding + 10,
      size - padding * 2,
      62
    );

    // Summary sentence (above bars)
    const summary = `${gradeSentence} My class should have ${baseTarget} students, but it actually has ${actual}, which feels like ${weighted} with complexity.`;
    g.font = "700 34px Inter, ui-sans-serif, system-ui, -apple-system";
    g.fillStyle = "#1F2937";
    const summaryBottom = wrapText(
      g,
      summary,
      padding,
      headerBottom + 64,
      size - padding * 2,
      44
    );

    // Bars area
    const areaY = summaryBottom + 40;
    const areaH = 460;
    const areaW = size - padding * 2;
    const maxVal = Math.max(baseTarget, actual, weighted, 1);
    const gap = 42;
    const barW = Math.min(240, (areaW - gap * 2) / 3);

    function drawBar(
      ix: number,
      sentence: string,
      value: number,
      color: string
    ): number {
      const x = padding + ix * (barW + gap);
      const usableH = areaH - 100;
      const h = Math.max(10, (value / maxVal) * usableH);
      const y = areaY + usableH - h;

      g.fillStyle = color;
      roundRect(g, x, y, barW, h, 16);
      g.fill();

      // label **below** the bar
      g.fillStyle = "#111827";
      g.font = "700 24px Inter, ui-sans-serif, system-ui, -apple-system";
      const labelBottom = wrapText(g, sentence, x, y + h + 40, barW, 28);
      return labelBottom + 8;
    }

    const b0 = drawBar(0, `Should have ${baseTarget}`, baseTarget, "#A7F3D0"); // light green
    const b1 = drawBar(1, `Actually has ${actual}`, actual, "#FBBF24"); // amber
    const b2 = drawBar(
      2,
      `Feels like ${weighted}`,
      weighted,
      overLimit ? "#DC2626" : "#B91C1C"
    ); // red hues

    const barsBottom = Math.max(b0, b1, b2);

    // Remedies (same size as summary)
    // ✅ Keep your final wording exactly as requested:
    const remedies =
      "The ATA’s $500 million/year proposal for a complexity-weighted Student-Teacher Ratio (STR) would compel school administrators and school divisions to remedy classes that exceed the weighted STR by hiring additional teachers, assigning multiple teachers to a classroom, increasing assistance and professional supports, or providing teachers with additional release time. This flexibility ensures that no student in Alberta goes without an education due to hard caps, while the province continues building more classrooms to meet future needs.";

    // Place the paragraph safely under the bars
    const remediesStartY = Math.min(barsBottom + 80, size - padding - 220);
    g.fillStyle = "#111827";

    // Reserve vertical room so pills/footer can still render
    const reservedForFooter = 76; // ~ pills + spacing
    const availableHeight = Math.max(
      60,
      size - padding - reservedForFooter - remediesStartY
    );

    // ✅ Auto-fit the paragraph. It will reduce font size as needed to fit.
    const remediesBottom = drawAutoFitParagraph(
      g,
      remedies,
      padding,
      remediesStartY,
      size - padding * 2,
      availableHeight,
      30, // start size
      16 // minimum size
    );

    // Footer pills + StopTheExcuses.ca (unchanged)
    const footerY = Math.max(remediesBottom + 36, size - padding + 8);
    const pills = buildPills(tags, overLimit);
    let px = padding;
    g.font = "700 20px Inter, ui-sans-serif, system-ui, -apple-system";
    for (const text of pills) {
      const tw = g.measureText(text).width + 24;
      roundRect(g, px, footerY - 26, tw, 28, 14);
      g.fillStyle = "#111827";
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.fillText(text, px + 12, footerY - 6);
      px += tw + 10;
    }
    const ste = "StopTheExcuses.ca";
    const steW = g.measureText(ste).width + 28;
    roundRect(g, size - padding - steW, footerY - 26, steW, 28, 14);
    g.fillStyle = "#111827";
    g.fill();
    g.fillStyle = "#FFFFFF";
    g.fillText(ste, size - padding - steW + 14, footerY - 6);

    // ---- Tiny self-tests (don’t modify UI) ----
    useEffect(() => {
      const approx = (a: number, b: number, t = 1e-3) => Math.abs(a - b) <= t;
      const w1 = 20 * 1.0;
      console.assert(approx(w1, 20), "All-typical math");
      const w2 = 10 * 1 + 5 * 1.5 + 2 * 2;
      console.assert(approx(w2, 21.5), "Mixed weights math");
      const cap = Math.min(24, 36);
      console.assert(cap === 24, "Lab/shop cap");
    }, []);

    // ---- UI helpers ----
    function NumberField({
      label,
      value,
      onChange,
      disabled = false,
      help,
    }: {
      label: string;
      value: number;
      onChange?: (v: number) => void;
      disabled?: boolean;
      help?: string;
    }) {
      return (
        <label className={`block ${disabled ? "opacity-75" : ""}`}>
          <span className="text-sm text-slate-700">{label}</span>
          <input
            type="number"
            min={0}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className="mt-1 w-full bg-white border border-black/10 rounded-xl px-3 py-2"
          />
          {help && <div className="text-xs text-slate-700 mt-1">{help}</div>}
        </label>
      );
    }

    function TagToggle({
      label,
      value,
      onToggle,
    }: {
      label: string;
      value: boolean;
      onToggle: () => void;
    }) {
      return (
        <button
          type="button"
          onClick={onToggle}
          className={`text-sm px-3 py-2 rounded-lg border ${
            value
              ? "bg-black text-white border-black"
              : "bg-white text-slate-800 border-black/10"
          }`}
        >
          {label}
        </button>
      );
    }

    // ---- Render UI ----
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-yellow-200 to-yellow-400 text-slate-900 px-5 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-6">
            <h1 className="text-4xl font-extrabold tracking-tight">
              Share Your Class Story
            </h1>
            <p className="text-slate-800/90 mt-2 text-sm md:text-base">
              Select your grades, enter your class and complexity, then generate
              a square graphic ready to post.
            </p>
          </header>

          <section className="flex flex-col gap-6">
            {/* 1) Basics */}
            <div className="bg-white/70 rounded-2xl p-5 shadow-lg border border-black/10">
              <h2 className="text-xl font-bold mb-4">Grades & Basics</h2>

              <div className="grid gap-4">
                <div>
                  <span className="text-sm text-slate-700">
                    Grades you teach
                  </span>
                  <div className="grid grid-cols-6 gap-1 mt-1">
                    {GRADE_CHOICES.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() =>
                          setGrades((prev) =>
                            prev.includes(g.key)
                              ? prev.filter((x) => x !== g.key)
                              : [...prev, g.key]
                          )
                        }
                        className={`px-2 py-1 rounded border text-sm font-semibold ${
                          grades.includes(g.key)
                            ? "bg-yellow-300/70 border-yellow-500"
                            : "bg-white border-black/10"
                        }`}
                      >
                        {g.key}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Multi-grade rooms supported — choose as many as apply (even
                    3–4 grades).
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isLabShop}
                    onChange={(e) => setIsLabShop(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">
                    Lab/shop/technical class (cap 24)
                  </span>
                </label>

                <label>
                  <span className="text-sm text-slate-700">
                    Actual number of students
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={actual}
                    onChange={(e) => setActual(Math.max(0, +e.target.value))}
                    className="mt-1 w-full border border-black/10 rounded-xl px-3 py-2"
                  />
                </label>
              </div>
            </div>

            {/* 2) Complexity */}
            <div className="bg-white/70 rounded-2xl p-5 shadow-lg border border-black/10">
              <h2 className="text-xl font-bold mb-2">Complexity Calculator</h2>
              <p className="text-sm text-slate-700 mb-3">
                Enter each student once in the highest-weight category. Use{" "}
                <strong>Auto typical</strong> to fill the remainder.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <NumberField
                  label="Severe / high-cost (2.0)"
                  value={counts.severe}
                  onChange={(v) =>
                    setCounts((p) => ({ ...p, severe: Number(v) || 0 }))
                  }
                />
                <NumberField
                  label="Mild/Moderate (1.5)"
                  value={counts.mildModerate}
                  onChange={(v) =>
                    setCounts((p) => ({ ...p, mildModerate: Number(v) || 0 }))
                  }
                />
                <NumberField
                  label="ELL / Francization / Refugee (1.5)"
                  value={counts.ellFrancRefugee}
                  onChange={(v) =>
                    setCounts((p) => ({
                      ...p,
                      ellFrancRefugee: Number(v) || 0,
                    }))
                  }
                />
                <NumberField
                  label="Targeted/Individualized supports (1.5)"
                  value={counts.targeted}
                  onChange={(v) =>
                    setCounts((p) => ({ ...p, targeted: Number(v) || 0 }))
                  }
                />
                <NumberField
                  label="Gifted (1.25)"
                  value={counts.gifted}
                  onChange={(v) =>
                    setCounts((p) => ({ ...p, gifted: Number(v) || 0 }))
                  }
                />

                <div className="col-span-2 flex items-center justify-between bg-white border border-black/10 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoTypical}
                      onChange={(e) => setAutoTypical(e.target.checked)}
                    />
                    <span className="text-sm">
                      Auto typical = Actual – other categories
                    </span>
                  </div>
                  <div className="text-sm text-slate-700">
                    Typical weight 1.0
                  </div>
                </div>

                <NumberField
                  label="Typical (1.0)"
                  disabled={autoTypical}
                  value={
                    autoTypical
                      ? Math.max(0, actual - sumNonTypical)
                      : counts.typical
                  }
                  onChange={(v) =>
                    setCounts((p) => ({ ...p, typical: Number(v) || 0 }))
                  }
                  help={autoTypical ? "Auto-filled" : undefined}
                />
              </div>

              {mismatch && (
                <div className="mt-3 text-orange-900 text-sm bg-orange-100 border border-orange-200 rounded-lg p-2">
                  Heads-up: Your category totals don’t equal actual students.
                  With <em>Auto typical</em> on, this reconciles automatically —
                  but please check for double-counting.
                </div>
              )}

              <div className="mt-5">
                <h3 className="text-lg font-bold">Reality Tags (optional)</h3>
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  <TagToggle
                    label="Above STR"
                    value={tags.aboveSTR}
                    onToggle={() =>
                      setTags((t) => ({ ...t, aboveSTR: !t.aboveSTR }))
                    }
                  />
                  <TagToggle
                    label="High Complexity"
                    value={tags.highComplexity}
                    onToggle={() =>
                      setTags((t) => ({
                        ...t,
                        highComplexity: !t.highComplexity,
                      }))
                    }
                  />
                  <TagToggle
                    label="Multi-Grade"
                    value={tags.multiGrade}
                    onToggle={() =>
                      setTags((t) => ({ ...t, multiGrade: !t.multiGrade }))
                    }
                  />
                  <TagToggle
                    label="Short on Support Staff"
                    value={tags.shortSupport}
                    onToggle={() =>
                      setTags((t) => ({ ...t, shortSupport: !t.shortSupport }))
                    }
                  />
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  These show up as small badges on your image footer — add
                  context without a wall of text.
                </div>
              </div>
            </div>

            {/* 2.5) Results */}
            <div className="bg-white/70 rounded-2xl p-5 shadow-lg border border-black/10">
              <h2 className="text-xl font-bold mb-2">Results</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-sm">Header wording</span>
                  <select
                    className="ml-auto text-sm bg-white border border-black/10 rounded-md px-2 py-1"
                    value={headerMode}
                    onChange={(e) =>
                      setHeaderMode(e.target.value as HeaderMode)
                    }
                  >
                    <option value={HeaderMode.Auto}>Smart (auto)</option>
                    <option value={HeaderMode.Overcrowded}>
                      Always “My class is overcrowded”
                    </option>
                    <option value={HeaderMode.Complex}>
                      Always “My class is complex”
                    </option>
                  </select>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Target (should have)</span>
                  <span className="font-semibold">{baseTarget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Actual students</span>
                  <span className="font-semibold">{actual}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-slate-700">Feels like (weighted)</span>
                  <span className="font-extrabold text-lg">{weighted}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span
                    className={`px-2 py-1 rounded-lg text-sm ${
                      overLimit
                        ? "bg-red-600/15 text-red-800"
                        : "bg-emerald-600/15 text-emerald-800"
                    }`}
                  >
                    {overLimit
                      ? "Over target"
                      : "Within target (complexity story)"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3) Create & Share */}
            <div className="bg-white/70 rounded-2xl p-5 shadow-lg border border-black/10">
              <h2 className="text-xl font-bold mb-4">Create & Share</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  onClick={drawGraphic}
                  className="rounded-xl bg-black hover:bg-gray-800 px-4 py-3 font-semibold text-white w-full"
                >
                  Generate Graphic (Square PNG)
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(caption)}
                  className="rounded-xl bg-white hover:bg-gray-50 px-4 py-3 font-semibold border border-black/10 w-full"
                >
                  Copy Suggested Caption
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Tip: After generating, scroll to the preview below to save the
                image.
              </p>
            </div>
          </section>

          {/* Preview */}
          {lastDataUrl && (
            <section className="mt-6">
              <div className="bg-white/70 rounded-2xl p-5 shadow-lg border border-black/10">
                <h2 className="text-xl font-bold mb-2">Preview</h2>
                <img
                  src={lastDataUrl}
                  alt="Preview"
                  className="rounded-xl w-full border border-black/10"
                />
                <a
                  href={lastDataUrl}
                  download="class-story.png"
                  className="inline-block mt-3 rounded-lg bg-black text-white px-4 py-2 font-semibold"
                >
                  Download
                </a>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }
}
