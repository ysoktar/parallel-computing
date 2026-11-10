// UI building blocks: DOM helper, callout icons, C/C++/CUDA syntax highlighting.

/** Tiny hyperscript: h("div", {class: "x", onclick: f}, "text", child, …). Strings become text nodes (never HTML). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v; // only ever used with trusted, hard-coded markup
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------------------------------------------------------------- C / C++ / CUDA highlighting
//   tok-kw    control flow and declarations   for if return struct …
//   tok-type  types                           int float size_t dim3 …
//   tok-con   CUDA qualifiers                 __global__ __shared__ __syncthreads …
//   tok-lit   CUDA built-in variables         threadIdx blockIdx blockDim gridDim warpSize
//   tok-fn    CUDA runtime API                cudaMalloc cudaMemcpy …
//   tok-op    <<< >>> launch brackets
//   tok-str / tok-num / tok-cmt               "text", 42, // comments
const words = (t) => new Set(t.split(/\s+/).filter(Boolean));
const KW = words(`for while do if else return break continue switch case default struct class typedef using namespace template
typename const static extern inline volatile sizeof new delete public private auto #include #define #pragma unroll true false nullptr NULL`);
const TYPE = words(`void int unsigned signed char short long float double bool size_t dim3 float2 float4 int2 int4 uchar uint
cudaError_t cudaArray_t cudaTextureObject_t cudaPitchedPtr cudaExtent std thread mutex atomic`);
const CON = words(`__global__ __device__ __host__ __shared__ __constant__ __restrict__ __syncthreads __syncwarp __threadfence __align__
__launch_bounds__ __CUDA_ARCH__ __cluster_dims__`);
const LIT = words("threadIdx blockIdx blockDim gridDim warpSize");
export const wordClass = (w) => (LIT.has(w) ? "tok-lit" : CON.has(w) ? "tok-con" : TYPE.has(w) ? "tok-type" : KW.has(w) ? "tok-kw"
  : /^(cuda|cu)[A-Z]\w*$|^tex[123]D\w*$|^make_cuda\w+$/.test(w) ? "tok-fn" : null);

export function highlightC(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(<<<|>>>)|(\b\d+(?:\.\d+)?f?\b)|(#?[A-Za-z_][A-Za-z0-9_]*)/g;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    const [tok, cmt, str, launch, num, word] = m;
    const cls = cmt ? "tok-cmt" : str ? "tok-str" : launch ? "tok-op" : num ? "tok-num" : word ? wordClass(word) : null;
    out += cls ? `<span class="${cls}">${escapeHtml(tok)}</span>` : escapeHtml(tok);
    last = re.lastIndex;
  }
  return out + escapeHtml(src.slice(last));
}

/** Remove the common leading indentation of a block of code and trim blank first/last lines. */
export function dedent(s) {
  const lines = s.replace(/\t/g, "    ").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(ind)).join("\n");
}

export const CALLOUT_ICONS = {
  look: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  discuss: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" stroke-linejoin="round"/></svg>',
  key: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5z" stroke-linejoin="round"/></svg>',
  gotcha: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2l6.5 11.5h-13z" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1"/></svg>',
  try: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5l2.5 2.5L12 5"/><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="3"/></svg>',
  note: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 7v4.2M8 4.7v.1"/></svg>',
  why: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.8a4.4 4.4 0 0 0-2.6 8v1.7h5.2V9.8A4.4 4.4 0 0 0 8 1.8z" stroke-linejoin="round"/><path d="M6 13.8h4"/></svg>',
  connect: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="3.5" cy="8" r="2"/><circle cx="12.5" cy="3.5" r="2"/><circle cx="12.5" cy="12.5" r="2"/><path d="M5.3 7.1l5.4-2.7M5.3 8.9l5.4 2.7"/></svg>',
  goals: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="3.2"/><circle cx="8" cy="8" r="0.6" fill="currentColor"/></svg>',
  example: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="1.8" width="11" height="12.4" rx="1.6"/><path d="M5 5.5h6M5 8h6M5 10.5h3.5"/></svg>',
  beyond: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></svg>',
  class: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4.5l6-2.5 6 2.5-6 2.5z" stroke-linejoin="round"/><path d="M4.5 6v3.5c0 1 1.6 2 3.5 2s3.5-1 3.5-2V6"/></svg>',
};
