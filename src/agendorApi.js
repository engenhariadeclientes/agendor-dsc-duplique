const axios = require("axios");
const { phonesMatch } = require("./phoneUtils");

const AGENDOR_BASE_URL = "https://api.agendor.com.br/v3";

// IDs fixos do Agendor (Grupo DSC), confirmados via API em 01/07/2026
const FUNIL_DE_VENDAS_ID = 444639;
const ETAPA_CONTATO_INICIAL_SEQUENCE = 2; // sequência 2 = "Contato Inicial" (id 3660120)

function agendorClient() {
  return axios.create({
    baseURL: AGENDOR_BASE_URL,
    headers: {
      Authorization: `Token ${process.env.AGENDOR_TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
}

/**
 * Busca o usuário (consultor) no Agendor cujo telefone (work, mobile ou whatsapp)
 * bate com o telefone informado, após normalização.
 *
 * Não usamos IDs fixos de propósito: o telefone é a chave estável, o consultor
 * por trás dele pode mudar ao longo do tempo.
 *
 * @param {string} telefoneConsultor
 * @returns {Promise<{id: number, name: string} | null>}
 */
async function buscarConsultorPorTelefone(telefoneConsultor) {
  const client = agendorClient();
  const { data } = await client.get("/users", { params: { per_page: 100 } });
  const usuarios = data?.data || [];

  const encontrado = usuarios.find((u) => {
    const contato = u.contact || {};
    return (
      phonesMatch(telefoneConsultor, contato.work) ||
      phonesMatch(telefoneConsultor, contato.mobile) ||
      phonesMatch(telefoneConsultor, contato.whatsapp)
    );
  });

  if (!encontrado) return null;
  return { id: encontrado.id, name: encontrado.name };
}

/**
 * Cria uma nova Empresa no Agendor vinculada ao consultor responsável.
 *
 * @param {object} params
 * @param {string} params.nome
 * @param {string} params.telefone
 * @param {string} params.email
 * @param {string} params.regiao
 * @param {number} params.consultorId
 * @returns {Promise<{id: number, name: string}>}
 */
async function criarEmpresa({ nome, telefone, email, regiao, consultorId }) {
  const client = agendorClient();
  const payload = {
    name: nome,
    description: regiao ? `Lead via WhatsApp - Região: ${regiao}` : "Lead via WhatsApp",
    author: consultorId,
    ownerUser: consultorId,
    contact: {
      mobile: telefone,
      email: email || undefined,
      whatsapp: telefone,
    },
    allowedUsers: [consultorId],
  };

  const { data } = await client.post("/organizations", payload);
  return data.data;
}

/**
 * Cria um Negócio vinculado a uma Empresa, no Funil de Vendas / Contato Inicial.
 *
 * @param {object} params
 * @param {number} params.organizationId
 * @param {string} params.titulo
 * @param {number} params.consultorId
 * @returns {Promise<object>}
 */
async function criarNegocio({ organizationId, titulo, consultorId }) {
  const client = agendorClient();
  const payload = {
    title: titulo,
    funnel: FUNIL_DE_VENDAS_ID,
    dealStage: ETAPA_CONTATO_INICIAL_SEQUENCE,
    author: consultorId,
    ownerUser: consultorId,
    dealStatusText: "ongoing",
  };

  const { data } = await client.post(`/organizations/${organizationId}/deals`, payload);
  return data.data;
}

/**
 * Cria uma Nota na Empresa (aparece na aba "Ver histórico" > "Nota" no Agendor).
 * Usa o endpoint de tasks sem especificar "type", que é como o Agendor
 * registra uma nota simples de texto.
 *
 * @param {object} params
 * @param {number} params.organizationId
 * @param {string} params.texto
 * @returns {Promise<object>}
 */
async function criarNota({ organizationId, texto }) {
  const client = agendorClient();
  const payload = { text: texto };
  const { data } = await client.post(`/organizations/${organizationId}/tasks`, payload);
  return data.data;
}

module.exports = {
  buscarConsultorPorTelefone,
  criarEmpresa,
  criarNegocio,
  criarNota,
  FUNIL_DE_VENDAS_ID,
  ETAPA_CONTATO_INICIAL_SEQUENCE,
};
