// js/ui/additionBase10Explain.js
// CE1 friendly – base 10 + regroupements par 5
// 1 (bleu), 5 (bleu foncé), 10 (vert), 50 (vert foncé), 100 (jaune), 500 (jaune foncé)

// ------------------------
// Découpage + regroupements
// ------------------------
function splitBase10(n){
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  return { hundreds, tens, units };
}

function splitGroupedBlocks(n){
  const { hundreds, tens, units } = splitBase10(n);

  const fiveHundreds = Math.floor(hundreds / 5);   // 500
  const restHundreds = hundreds % 5;               // 100

  const fifties = Math.floor(tens / 5);            // 50
  const restTens = tens % 5;                       // 10

  const fives = Math.floor(units / 5);             // 5
  const restUnits = units % 5;                     // 1

  return { fiveHundreds, restHundreds, fifties, restTens, fives, restUnits };
}

function blocksHTMLGrouped(parts){
  const make = (count, className, label = "") =>
    Array.from({ length: count })
      .map(() => {
        const lbl = label ? `<span class="lbl">${label}</span>` : "";
        return `<span class="b10 block ${className}">${lbl}</span>`;
      })
      .join("");

  return (
    make(parts.fiveHundreds, "fivehundred", "500") +
    make(parts.restHundreds, "hundred", "100") +
    make(parts.fifties, "fifty", "50") +
    make(parts.restTens, "ten", "10") +
    make(parts.fives, "five", "5") +
    make(parts.restUnits, "unit", "")
  );
}

function line(label, n){
  const parts = splitGroupedBlocks(n);
  return `
    <div class="b10-line">
      <div class="b10-label">${label}</div>
      <div class="b10-bar">${blocksHTMLGrouped(parts)}</div>
      <div class="b10-num">${n}</div>
    </div>
  `;
}

// ------------------------
// Addition posée + retenues
// ------------------------
function columnAdditionHTML(a, b){
  // Colonnes C D U avec "maison" de retenues
  const A = String(a).padStart(3, " ");
  const B = String(b).padStart(3, " ");

  const aC = A[0] === " " ? "" : A[0];
  const aD = A[1] === " " ? "" : A[1];
  const aU = A[2] === " " ? "" : A[2];
  const bC = B[0] === " " ? "" : B[0];
  const bD = B[1] === " " ? "" : B[1];
  const bU = B[2] === " " ? "" : B[2];

  // Calcul des retenues par colonnes (générique)
  const Au = a % 10, Bu = b % 10;
  const Ad = Math.floor((a % 100) / 10), Bd = Math.floor((b % 100) / 10);
  const Ac = Math.floor(a / 100), Bc = Math.floor(b / 100);

  const sumU = Au + Bu;
  const carryU = Math.floor(sumU / 10);

  const sumD = Ad + Bd + carryU;
  const carryD = Math.floor(sumD / 10);

  const sumC = Ac + Bc + carryD;

  const res = sumC * 100 + (sumD % 10) * 10 + (sumU % 10);

  const R = String(res).padStart(3, " ");

  return {
    res,
    carryU,
    carryD,
    html: `
      <div class="coladd">
        <div class="row carry">
          <div class="cell c">${carryD ? `<span class="ret">${carryD}</span>` : ""}</div>
          <div class="cell d">${carryU ? `<span class="ret">${carryU}</span>` : ""}</div>
          <div class="cell u"></div>
        </div>
        <div class="row n1">
          <div class="cell c">${aC}</div>
          <div class="cell d">${aD}</div>
          <div class="cell u">${aU}</div>
        </div>
        <div class="row n2">
          <div class="cell c">${bC}</div>
          <div class="cell d">${bD}</div>
          <div class="cell u">${bU}</div>
        </div>
        <div class="row bar"><div class="cell" colspan="3"></div></div>
        <div class="row res">
          <div class="cell c">${R[0].trim()}</div>
          <div class="cell d">${R[1].trim()}</div>
          <div class="cell u">${R[2].trim()}</div>
        </div>
        <div class="cols">
          <div class="col">C</div>
          <div class="col">D</div>
          <div class="col">U</div>
        </div>
      </div>
    `
  };
}

// ------------------------
// Export principal
// ------------------------
export function renderAdditionBase10Explanation(question, container){
  const a = Number(question?.a ?? 0);
  const b = Number(question?.b ?? 0);
  const total = a + b;

  const Au = a % 10, Bu = b % 10;
  const Ad = Math.floor((a % 100) / 10), Bd = Math.floor((b % 100) / 10);
  const Ac = Math.floor(a / 100), Bc = Math.floor(b / 100);

  const sumU = Au + Bu;
  const hasCarry = sumU > 9;

  const title = `<div class="explain-title">🧮 ${a} + ${b}</div>`;

  // --- Sans retenue ---
  if (!hasCarry){
    const unitsRes = sumU;
    const tensRes = (Ad + Bd) * 10;
    const hundredsRes = (Ac + Bc) * 100;
    const composed = hundredsRes + tensRes + unitsRes;

    container.innerHTML = `
      ${title}
      <div class="ce1-text">
        <p><b>Addition en ligne sans retenue</b> ✅</p>
        <p>On calcule d’abord <b>les unités</b>, puis <b>les dizaines</b>, puis on assemble.</p>
      </div>

      <div class="b10-box">
        ${line("1er nombre", a)}
        ${line("2e nombre", b)}
      </div>

      <div class="ce1-steps">
        <div class="step">1) Unités : ${Au} + ${Bu} = <b>${unitsRes}</b></div>
        <div class="step">2) Dizaines : ${Ad * 10} + ${Bd * 10} = <b>${tensRes}</b></div>
        ${(Ac || Bc) ? `<div class="step">3) Centaines : ${Ac * 100} + ${Bc * 100} = <b>${hundredsRes}</b></div>` : ""}
        <div class="step">➡️ Résultat : ${hundredsRes} + ${tensRes} + ${unitsRes} = <b>${composed}</b></div>
      </div>

      <div class="b10-box">
        ${line("Résultat", composed)}
      </div>
    `;
    return;
  }

  // --- Avec retenue ---
  const col = columnAdditionHTML(a, b);
  const carryU = col.carryU;

  const unitsWritten = sumU % 10;
  const tenFromUnits = carryU * 10; // 10 si retenue
  const tensSum = (Ad * 10) + (Bd * 10) + tenFromUnits;
  const tensDigit = Math.floor((tensSum % 100) / 10);

  container.innerHTML = `
    ${title}
    <div class="ce1-text">
      <p><b>Addition avec retenue</b> 🏠</p>
      <p>Quand la somme des unités dépasse 9, on fait une <b>retenue</b>.</p>
      <p>On peut écrire la retenue <span class="ret-red">en rouge</span> pour bien la voir.</p>
    </div>

    <div class="b10-box">
      ${line("1er nombre", a)}
      ${line("2e nombre", b)}
    </div>

    <div class="ce1-steps">
      <div class="step">1) Unités : ${Au} + ${Bu} = <b>${sumU}</b> → je pose <b>${unitsWritten}</b> et je retiens <b class="ret-red">${carryU}</b>.</div>
      <div class="step">2) Dizaines : ${Ad} + ${Bd} + ${carryU} = <b>${tensDigit}</b> dizaine(s).</div>
      <div class="step">🗣️ <i>« ${Au} plus ${Bu} égale ${sumU}, je pose ${unitsWritten} et je retiens ${carryU}. »</i></div>
    </div>

    <div class="coladd-wrap">
      ${col.html}
    </div>

    <div class="ce1-text">
      <p>✅ Résultat : <b>${a} + ${b} = ${total}</b></p>
    </div>

    <div class="b10-box">
      ${line("Résultat", total)}
    </div>
  `;
}
