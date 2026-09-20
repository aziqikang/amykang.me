import { useEffect, useRef } from 'react'
import { THEME_EVENT } from '@/features/theme/theme'
import { FRAGMENT, MAX_RIPPLES, VERTEX } from './glazeShader'
import styles from './GlazeField.module.css'

/**
 * Render scale. The background is soft by design, so drawing at ~60% and
 * letting the canvas scale up is visually free — and it is where the
 * performance headroom comes from, since a fragment shader's cost is
 * per-pixel. At 1920 wide this shades ~0.7MP instead of ~2MP.
 */
const RENDER_SCALE = 0.6

/** Pointer travel between spawned impulses, in CSS pixels. */
const SPAWN_DISTANCE = 26

type Props = {
  /** Reports whether WebGL actually came up, so the CSS field can yield. */
  onStatus: (active: boolean) => void
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[glaze] shader failed:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** Read a hex token so tokens.css stays the single source of colour. */
function readColor(name: string, fallback: [number, number, number]) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const match = /^#?([0-9a-f]{6})$/i.exec(raw)
  if (!match?.[1]) return fallback
  const n = Number.parseInt(match[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as [
    number,
    number,
    number,
  ]
}

/**
 * The glaze background, rendered on the GPU, with ripples that follow the
 * pointer.
 *
 * Raw WebGL rather than a 3D library: this is one full-screen quad, and
 * three.js would add well over 100kB gzipped of scene graph, cameras and
 * geometry that a single fragment shader never touches. If real 3D scenes
 * arrive later, this component is the mount point for them.
 *
 * Falls back silently — returning null and reporting false — when WebGL
 * is unavailable or the visitor asked for reduced motion. The CSS glaze
 * field stays mounted underneath and simply shows through.
 */
export function GlazeCanvas({ onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Motion the visitor did not ask for. Don't even create the context.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onStatus(false)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const gl = (canvas.getContext('webgl2', { antialias: false, alpha: false }) ??
      canvas.getContext('webgl', { antialias: false, alpha: false })) as
      | WebGLRenderingContext
      | null

    if (!gl) {
      onStatus(false)
      return
    }

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()

    if (!vertex || !fragment || !program) {
      onStatus(false)
      return
    }

    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[glaze] link failed:', gl.getProgramInfoLog(program))
      onStatus(false)
      return
    }

    gl.useProgram(program)

    // One quad covering clip space.
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    const aPosition = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const u = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      clay: gl.getUniformLocation(program, 'uClay'),
      edge: gl.getUniformLocation(program, 'uEdge'),
      peri: gl.getUniformLocation(program, 'uPeri'),
      lav: gl.getUniformLocation(program, 'uLav'),
      pale: gl.getUniformLocation(program, 'uPale'),
      rust: gl.getUniformLocation(program, 'uRust'),
      ink: gl.getUniformLocation(program, 'uInk'),
      ripple: gl.getUniformLocation(program, 'uRipple[0]'),
    }

    /**
     * Pull the palette out of CSS. Re-run on theme change: these are
     * uniforms, so unlike everything else styled by tokens they do not
     * update themselves when the custom properties change underneath.
     */
    const uploadColors = () => {
      gl.uniform3fv(u.clay, readColor('--clay', [0.82, 0.8, 0.74]))
      gl.uniform3fv(u.edge, readColor('--glaze-edge', [0.61, 0.77, 0.76]))
      gl.uniform3fv(u.peri, readColor('--periwinkle', [0.68, 0.71, 0.85]))
      gl.uniform3fv(u.lav, readColor('--lavender', [0.77, 0.71, 0.83]))
      gl.uniform3fv(u.pale, readColor('--glaze-pale', [0.85, 0.93, 0.91]))
      gl.uniform3fv(u.rust, readColor('--rust', [0.65, 0.35, 0.2]))
      // The shader compares this against the ground to work out which
      // way its contrast clamp should run, so it must track the theme.
      gl.uniform3fv(u.ink, readColor('--ink', [0.23, 0.2, 0.17]))
    }

    uploadColors()

    // Ring buffer of impulses: xyz = x, y, birth time.
    //
    // Birth times start far in the past on purpose. Zero-initialised, all
    // sixteen slots read as born at t=0 and therefore alive — so every
    // page load fired sixteen stacked ripples out of the bottom-left
    // corner until they aged out.
    const ripples = new Float32Array(MAX_RIPPLES * 3)
    for (let i = 0; i < MAX_RIPPLES; i += 1) ripples[i * 3 + 2] = -1000
    let nextRipple = 0
    let lastSpawn = { x: 0, y: 0 }
    let started = performance.now()

    const resize = () => {
      const w = Math.max(1, Math.floor(window.innerWidth * RENDER_SCALE))
      const h = Math.max(1, Math.floor(window.innerHeight * RENDER_SCALE))

      // Reallocating the drawing buffer is the expensive part, so skip it
      // when nothing changed...
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      // ...but ALWAYS re-upload. Uniforms belong to the program, not to
      // the canvas, and StrictMode mounts this effect twice: the second
      // mount builds a fresh program against a canvas that is already the
      // right size. Early-returning here left that program with uRes at
      // (0,0), so uv = gl_FragCoord.xy / uRes blew up, every pool
      // evaluated to nothing, and the whole field rendered as flat clay.
      gl.viewport(0, 0, w, h)
      gl.uniform2f(u.res, w, h)
    }

    const spawn = (clientX: number, clientY: number) => {
      const x = clientX * RENDER_SCALE
      // Canvas Y runs bottom-up; the pointer's runs top-down.
      const y = (window.innerHeight - clientY) * RENDER_SCALE
      const i = nextRipple * 3
      ripples[i] = x
      ripples[i + 1] = y
      ripples[i + 2] = (performance.now() - started) / 1000
      nextRipple = (nextRipple + 1) % MAX_RIPPLES
    }

    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - lastSpawn.x
      const dy = event.clientY - lastSpawn.y
      if (dx * dx + dy * dy < SPAWN_DISTANCE * SPAWN_DISTANCE) return
      lastSpawn = { x: event.clientX, y: event.clientY }
      spawn(event.clientX, event.clientY)
    }

    const onPointerDown = (event: PointerEvent) => {
      // A press drops several at once, so a click reads heavier than a
      // drift of the mouse.
      spawn(event.clientX, event.clientY)
      spawn(event.clientX + 2, event.clientY + 2)
    }

    const draw = () => {
      gl.uniform1f(u.time, (performance.now() - started) / 1000)
      gl.uniform3fv(u.ripple, ripples)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    let frame = 0
    const render = () => {
      frame = requestAnimationFrame(render)
      draw()
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
      } else if (!frame) {
        // Rebase the clock, or the shader jumps forward by however long
        // the tab sat in the background.
        started = performance.now() - 1000
        frame = requestAnimationFrame(render)
      }
    }

    resize()
    // Paint one frame synchronously before handing over to rAF. The
    // context is opaque (alpha: false), so until something is drawn the
    // canvas is solid black — and rAF does not fire at all in a
    // backgrounded tab, which would leave a black page sitting there for
    // anyone who restores the window.
    draw()
    onStatus(true)
    frame = requestAnimationFrame(render)

    // Repaint immediately rather than waiting for the next frame — the
    // loop is paused whenever the tab is hidden.
    const onTheme = () => {
      uploadColors()
      draw()
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener(THEME_EVENT, onTheme)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener(THEME_EVENT, onTheme)
      document.removeEventListener('visibilitychange', onVisibility)

      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)

      // Deliberately NOT calling WEBGL_lose_context here. StrictMode runs
      // this effect twice in development — mount, clean up, mount again —
      // and a canvas whose context has been lost hands back that same
      // dead context on the next getContext(), so the second init fails
      // and the component reports no WebGL at all. The context is
      // reclaimed with the canvas anyway, and this field mounts once for
      // the lifetime of the app.
    }
  }, [onStatus])

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
}
