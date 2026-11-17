/** Cosine similarity of two embeddings, which Supabase returns either as arrays or as JSON strings. */
export const cosine = (a: unknown, b: unknown) => {
  const parse = (v: unknown) => (typeof v === "string" ? (JSON.parse(v) as number[]) : Array.isArray(v) ? (v as number[]) : null);
  try {
    const x = parse(a);
    const y = parse(b);
    if (!x || !y || x.length !== y.length) return null;
    let dot = 0;
    let nx = 0;
    let ny = 0;
    for (let i = 0; i < x.length; i++) {
      dot += x[i] * y[i];
      nx += x[i] * x[i];
      ny += y[i] * y[i];
    }
    return nx && ny ? dot / Math.sqrt(nx * ny) : null;
  } catch {
    return null;
  }
};
