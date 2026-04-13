export function renderAdditionExplanation(a, b, container){
  container.innerHTML = "";

  const total = a + b;
  const manquePour10 = 10 - a;

  const makeSquares = (count, className) => {
    return Array.from({length: count})
      .map(() => `<span class="u ${className}"></span>`)
      .join("");
  };

  if (b <= manquePour10) {

    container.innerHTML = `
      <div class="line">
        <div class="label">${a}</div>
        <div class="bar">${makeSquares(a, "a")}</div>
      </div>

      <div class="line">
        <div class="label">+ ${b}</div>
        <div class="bar">${makeSquares(b, "b")}</div>
      </div>

      <div class="explain-text">
        ${a} + ${b} = ${total}
      </div>
    `;

  } else {

    const complement = manquePour10;
    const reste = b - complement;

    container.innerHTML = `
      <div class="line">
        <div class="label">${a}</div>
        <div class="bar">${makeSquares(a, "a")}</div>
      </div>

      <div class="line">
        <div class="label">${b} = ${complement} + ${reste}</div>
        <div class="bar">
          ${makeSquares(complement, "comp")}
          ${makeSquares(reste, "b")}
        </div>
      </div>

      <div class="explain-text">
        ${a} + ${b} = ${a} + (${complement} + ${reste})
        = (${a} + ${complement}) + ${reste}
        = 10 + ${reste}
        = <b>${total}</b>
      </div>
    `;
  }
}
