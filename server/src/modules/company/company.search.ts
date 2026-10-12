const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function companySearchGrams(...values: string[]) {
  const grams = new Set<string>();
  for (const value of values) {
    const normalized = ` ${normalize(value)} `;
    for (const size of [2, 3]) {
      for (let index = 0; index <= normalized.length - size; index += 1) grams.add(normalized.slice(index, index + size));
    }
  }
  return [...grams];
}

function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length]!;
}

export function companySearchScore(search: string, ...values: string[]) {
  const queryWords = normalize(search).split(/\s+/).filter(Boolean);
  const haystack = normalize(values.join(" "));
  if (!queryWords.length || !haystack) return 0;
  const candidates = haystack.split(" ").filter(Boolean);
  let score = 0;
  for (const word of queryWords) {
    let best = 0;
    for (const candidate of candidates) {
      if (candidate === word) best = Math.max(best, 100);
      else if (candidate.startsWith(word) || word.startsWith(candidate)) best = Math.max(best, 85 - Math.abs(candidate.length - word.length));
      else if (candidate.includes(word) || word.includes(candidate)) best = Math.max(best, 75 - Math.abs(candidate.length - word.length));
      else {
        const distance = editDistance(word, candidate);
        const allowance = word.length < 3 ? 0 : Math.min(2, Math.floor(word.length / 4) || 1);
        if (distance <= allowance) best = Math.max(best, 65 - distance * 10 - Math.abs(candidate.length - word.length));
      }
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}
