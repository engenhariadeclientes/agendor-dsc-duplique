/**
 * Normaliza um telefone brasileiro para o formato DDD + 9 dígitos (11 dígitos totais).
 *
 * Mesma lógica do `_tel_canon()` usado no Registro Agendor (buscar.py):
 * - Remove tudo que não for dígito
 * - Remove o código do país (55) do início, mesmo se vier duplicado por engano
 *   (ex: "555197319893" -> "5197319893")
 * - Se sobrar um número de 10 dígitos (DDD + 8 dígitos, sem o 9 na frente),
 *   insere o 9 depois do DDD -> vira 11 dígitos
 *
 * Isso cobre os 3 formatos que já vimos na prática:
 *   "+5551996310323"      -> 51996310323 (já vem certo)
 *   "555197319893"        -> 51997319893 (55 duplicado)
 *   "(48) 9984-1455"      -> 48999841455 (falta o 9)
 *
 * @param {string} raw - telefone em qualquer formato
 * @returns {string} telefone normalizado com 11 dígitos (DDD + 9 + 8 dígitos), ou "" se vazio/inválido
 */
function normalizePhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");

  if (!digits) return "";

  // Remove o 55 do início, inclusive se vier duplicado (bug conhecido do BotConversa)
  while (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  // DDD (2 dígitos) + número local de 8 dígitos, sem o 9 na frente -> insere o 9
  if (digits.length === 10) {
    digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }

  return digits;
}

/**
 * Compara dois telefones já normalizando os dois lados.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function phonesMatch(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return Boolean(na) && na === nb;
}

module.exports = { normalizePhone, phonesMatch };
