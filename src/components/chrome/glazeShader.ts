/**
 * Shaders for the glaze background.
 *
 * Written against GLSL ES 1.00 deliberately: a WebGL2 context accepts
 * 1.00 shaders (they carry no #version directive), so one source works on
 * both and the WebGL1 fallback needs no second copy.
 */

export const VERTEX = /* glsl */ `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

/** Ripple impulses held in flight. Must match MAX_RIPPLES in the TS. */
export const MAX_RIPPLES = 16

export const FRAGMENT = /* glsl */ `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;

uniform vec3  uClay;      // the stoneware body
uniform vec3  uEdge;      // blue-green glaze
uniform vec3  uPeri;      // periwinkle drip
uniform vec3  uLav;       // lavender drip
uniform vec3  uPale;      // pale highlight
uniform vec3  uRust;      // warm rim
uniform vec3  uInk;       // body text — decides which way contrast runs

/** xy = origin in pixels, z = birth time in seconds. */
uniform vec3  uRipple[${MAX_RIPPLES}];

const float LIFE  = 1.4;   // seconds before an impulse is spent
const float FREQ  = 0.125; // spatial frequency — higher means tighter rings
const float SPEED = 4.2;   // how fast the rings travel outward
const float FALL  = 0.019; // radial falloff — higher means a smaller ripple

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/**
 * One soft elliptical pool of glaze, normalised so the falloff reaches
 * zero at the ellipse edge.
 */
float pool(vec2 uv, vec2 centre, vec2 radii) {
  float d = length((uv - centre) / radii);
  return 1.0 - smoothstep(0.0, 1.0, d);
}

/** Slow wander, so no pool ever sits still or tracks its neighbours. */
vec2 drift(float a, float b) {
  return vec2(sin(uTime * a) * 0.05, cos(uTime * b) * 0.04);
}

/**
 * Move a colour to the target luma, whichever side it starts on.
 *
 * NOTE: never put a backtick in this file. The whole shader is a JS
 * template literal, so one inside a GLSL comment ends the string
 * mid-function and the parse error surfaces dozens of lines away.
 *
 * The glaze tokens do not sit at the ground's lightness, so pooling them
 * raw drags the whole canvas away from it — which the contrast clamp at
 * the end then has to drag back, on nearly every pixel, flattening the
 * field it is sitting on. Matching the sources to the ground first means
 * pooling shifts hue rather than lightness, the clamp almost never
 * engages, and the variation survives.
 *
 * Both directions matter: in light mode the glaze is darker than the
 * clay and gets lifted toward white; in dark mode it is lighter and gets
 * pulled toward black. The desaturation either way is bought back by the
 * chroma boost below, which is luminance-preserving by construction.
 */
vec3 matchLuma(vec3 c, float target) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (y < target) {
    float t = clamp((target - y) / max(1.0 - y, 0.001), 0.0, 1.0);
    return mix(c, vec3(1.0), t);
  }
  float t = clamp((y - target) / max(y, 0.001), 0.0, 1.0);
  return mix(c, vec3(0.0), t);
}

/**
 * Push a colour away from its own grey.
 *
 * The palette tokens are deliberately muted — they are UI colours, sized
 * for text to sit on. Washed across a whole page at low weight they read
 * as no colour at all, so the background needs a far more saturated
 * version of the same hues. Mixing about the colour's own luma changes
 * chroma only, which keeps the contrast guarantees intact.
 */
vec3 chroma(vec3 c, float k) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(y), c, k);
}

/**
 * Sum the live impulses into a height field, and accumulate its gradient
 * so the glaze underneath can be refracted rather than merely tinted.
 *
 * The loop bound is a compile-time constant and dead entries are masked
 * arithmetically rather than skipped with break — GLSL ES 1.00 will not
 * accept a loop whose bound depends on a uniform.
 */
float ripples(vec2 px, out vec2 grad) {
  float h = 0.0;
  grad = vec2(0.0);

  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec3 r = uRipple[i];
    float age = uTime - r.z;

    // 1.0 while the impulse is alive, 0.0 otherwise.
    float alive = step(0.0, age) * step(age, LIFE);

    vec2 d = px - r.xy;
    float dist = length(d) + 0.0001;
    float phase = dist * FREQ - age * SPEED;

    // Rings fade with distance from the origin and with age.
    float envelope = exp(-dist * FALL) * exp(-age * 2.1) * alive;

    h += sin(phase) * envelope;
    grad += (d / dist) * cos(phase) * FREQ * envelope;
  }

  return h;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / uRes;

  vec2 grad;
  float h = ripples(px, grad);

  // Refraction: bend the sample point by the wave's slope. This is what
  // makes the surface look like liquid over the glaze rather than rings
  // drawn on top of it.
  vec2 q = uv + grad * 0.09;

  // ── The glaze ──
  // Large overlapping pools, matching the composition the CSS field used
  // before this moved to the GPU. A noise ramp was tried here and lost
  // the character: these are broad, deliberately placed washes, and the
  // colour comes from where they overlap rather than from octaves.
  float clayY = dot(uClay, vec3(0.2126, 0.7152, 0.0722));

  // Saturate FIRST, then lighten — lightening desaturates, so the other
  // order leaves nothing to work with. Kept modest: this is clay with
  // glaze pooling through it, not a gradient mesh. Anything much above
  // 1.4 here and the stoneware disappears under pastel.
  vec3 edge = matchLuma(chroma(uEdge, 1.75), clayY);
  vec3 peri = matchLuma(chroma(uPeri, 1.75), clayY);
  vec3 lav  = matchLuma(chroma(uLav,  1.65), clayY);
  vec3 rust = matchLuma(chroma(uRust, 1.45), clayY);
  vec3 pale = matchLuma(chroma(uPale, 1.40), clayY);

  vec3 col = uClay;
  col = mix(col, edge, pool(q, vec2(0.22, 0.82) + drift( 0.09,  0.07), vec2(0.58, 0.34)) * 0.58);
  col = mix(col, peri, pool(q, vec2(0.74, 0.70) + drift(-0.06,  0.08), vec2(0.44, 0.52)) * 0.52);
  col = mix(col, lav,  pool(q, vec2(0.48, 0.38) + drift( 0.07, -0.05), vec2(0.66, 0.30)) * 0.46);
  col = mix(col, edge, pool(q, vec2(0.12, 0.24) + drift(-0.08,  0.06), vec2(0.38, 0.46)) * 0.50);
  col = mix(col, rust, pool(q, vec2(0.86, 0.16) + drift( 0.05,  0.09), vec2(0.50, 0.36)) * 0.42);
  col = mix(col, lav,  pool(q, vec2(0.66, 0.88) + drift(-0.07, -0.06), vec2(0.52, 0.40)) * 0.42);
  col = mix(col, peri, pool(q, vec2(0.18, 0.58) + drift( 0.06,  0.05), vec2(0.36, 0.58)) * 0.46);
  col = mix(col, edge, pool(q, vec2(0.80, 0.42) + drift(-0.05,  0.07), vec2(0.62, 0.32)) * 0.50);
  col = mix(col, rust, pool(q, vec2(0.34, 0.12) + drift( 0.08, -0.07), vec2(0.42, 0.44)) * 0.45);
  col = mix(col, pale, pool(q, vec2(0.60, 0.65) + drift(-0.09,  0.08), vec2(0.40, 0.30)) * 0.38);

  // Crests catch the light. Tinted with the glaze rather than white, and
  // kept low — a bright specular read as a hard ring sitting on the page
  // instead of a disturbance in the surface.
  col += edge * max(h, 0.0) * 0.058;
  col -= vec3(0.04, 0.035, 0.03) * max(-h, 0.0) * 0.34;

  // A final, gentle lift on top of the per-pool saturation above.
  col = chroma(col, 1.12);

  // MUST clamp before measuring luma. GLSL does not clamp intermediates —
  // only the final write to gl_FragColor — so an out-of-range channel
  // from the chroma push would skew the luma below, trip the floor, and
  // wash the colour back out.
  col = clamp(col, 0.0, 1.0);

  // ── Contrast clamp ──
  // Safety net only, now that the sources are luma-matched. Text
  // contrast is computed against the clay, so the field must not drift
  // far from it in whichever direction costs contrast — and which
  // direction that is flips with the theme. Dark ink on a light ground
  // needs a floor; light ink on a dark ground needs a ceiling. Deriving
  // it from the ink rather than a mode flag means the shader never has
  // to be told which theme is active.
  float inkY = dot(uInk, vec3(0.2126, 0.7152, 0.0722));
  float y = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float lo = inkY < clayY ? clayY - 0.02 : -1.0;
  float hi = inkY > clayY ? clayY + 0.02 :  2.0;
  col += clamp(y, lo, hi) - y;

  // Dither. These are very wide, very shallow gradients, which is exactly
  // where 8-bit output bands.
  col += (hash(px) - 0.5) * 0.008;

  gl_FragColor = vec4(col, 1.0);
}
`
