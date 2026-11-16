function isPrime(number, primes) {
  for (const prime of primes) {
    if (prime * prime > number) break;
    if (number % prime === 0) return false;
  }
  return true;
}

self.onmessage = ({ data }) => {
  try {
    const { limit } = data;
    if (!Number.isInteger(limit) || limit < 2 || limit > 20_000_000) {
      self.postMessage({ error: 'Неверная граница расчета.' });
      return;
    }

    const started = performance.now();
    const primes = [];
    for (let number = 3; number <= limit; number += 2) {
      if (isPrime(number, primes)) primes.push(number);
    }

    self.postMessage({
      count: primes.length + 1,
      largest: primes.at(-1) ?? 2,
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch {
    self.postMessage({ error: 'Не удалось завершить расчет.' });
  }
};
