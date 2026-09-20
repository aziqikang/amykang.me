/**
 * Long-form pages for timeline entries that have more to say than a few
 * bullets. An entry opts in by setting `page: "<slug>"` in timeline.json,
 * which makes its card render "read more →" and routes to /e/<slug>.
 *
 * Math uses TeX delimiters: \( inline \) and \[ display \]. EntryPage
 * renders them with KaTeX.
 */

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }

export type EntryPageData = {
  title: string
  kicker: string
  lede: string
  links: { label: string; url: string }[]
  blocks: Block[]
}

export const ENTRY_PAGES: Record<string, EntryPageData> = {
  ecc: {
    title: 'elliptic curve group structure explorer',
    kicker: 'directed reading program · purdue math',
    lede: 'a field-agnostic playground for the arithmetic and group structure of elliptic curves.',
    links: [
      { label: 'github.com/aziqikang/ecc-sim', url: 'https://github.com/aziqikang/ecc-sim' },
      { label: 'try it on streamlit', url: 'https://ecc-sim.streamlit.app' },
    ],
    blocks: [
      {
        type: 'p',
        text: 'elliptic curves are cubic curves of the form \\(y^2 = x^3 + ax + b\\) that carry a natural abelian group structure. you can literally add two points on the curve and get a third, and that operation satisfies every group axiom — which is both a lovely piece of geometry and the foundation of a great deal of modern cryptography.',
      },
      { type: 'h2', text: 'why anyone cares' },
      {
        type: 'p',
        text: 'the security of elliptic curve cryptography rests on the elliptic curve discrete logarithm problem: given points \\(P\\) and \\(Q = kP\\) on a curve, recover the scalar \\(k\\). no sub-exponential algorithm is known for this in general, which is why ECC reaches the same security level as RSA at dramatically smaller key sizes. it is what secures key exchange in TLS, SSH, and bitcoin.',
      },
      { type: 'h2', text: 'what i built' },
      {
        type: 'p',
        text: 'the project works with curves in short weierstrass form over two kinds of field: the rationals \\(\\mathbb{Q}\\) and prime fields \\(\\mathbb{F}_p\\) with \\(p \\neq 2, 3\\). it has two halves.',
      },
      {
        type: 'ul',
        items: [
          'a python library for elliptic curve arithmetic — point addition, doubling, and scalar multiplication — written field-agnostically so the same code path runs over \\(\\mathbb{Q}\\) and over \\(\\mathbb{F}_p\\).',
          'an algorithm that computes the full group structure \\(E(\\mathbb{F}_p) \\cong \\mathbb{Z}/n_1\\mathbb{Z} \\times \\mathbb{Z}/n_2\\mathbb{Z}\\) together with explicit generators \\(e_1, e_2\\) for each cyclic factor.',
        ],
      },
      { type: 'h2', text: 'finding the group order' },
      {
        type: 'p',
        text: 'computing \\(|E(\\mathbb{F}_p)|\\) by brute force means walking every point, which is \\(O(p)\\) and hopeless past small primes. instead I used baby-step giant-step: hasse\u2019s theorem pins the order inside the interval \\[|E(\\mathbb{F}_p)| \\in [p + 1 - 2\\sqrt{p},\\; p + 1 + 2\\sqrt{p}],\\] which is only \\(O(\\sqrt{p})\\) wide, so a meet-in-the-middle search over that window runs in \\(O(\\sqrt[4]{p})\\) steps against a precomputed table. factoring the resulting order then pins down the cyclic decomposition and its generators.',
      },
    ],
  },
}
