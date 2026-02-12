export function chooseStep(max) {
  if (max <= 20) return 1;
  if (max <= 50) return 2;
  if (max <= 120) return 5;
  return 10;
}

export function numberLineModel({ a, b, answer }) {
  const max = Math.max(10, Math.ceil(answer / 10) * 10);
  const step = chooseStep(max);

  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);

  return {
    max,
    step,
    ticks,
    start: a,
    end: answer
  };
}
