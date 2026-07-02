require("dotenv").config();
const express = require("express");
const {
  buscarConsultorPorTelefone,
  criarEmpresa,
  criarNegocio,
} = require("./agendorApi");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/ping", (req, res) => {
  res.json({ ok: true, service: "agendor-dsc-duplique" });
});

/**
 * Webhook chamado pelo bloco final da Júlia (BotConversa) quando o lead
 * termina a conversa de qualificação.
 *
 * Payload esperado (mesmos nomes de variáveis já usados no BotConversa,
 * mais a variável nova "telefone_consultor"):
 * {
 *   "nome_completo": "Nome do lead",
 *   "telefone": "5551999998888",
 *   "Email": "lead@exemplo.com",
 *   "REGIÃO": "Rio Grande do Sul - outras cidades",
 *   "telefone_consultor": "5551996310323"
 * }
 */
app.post("/webhook/novo-negocio", async (req, res) => {
  const body = req.body || {};
  const nome = body.nome_completo;
  const telefone = body.telefone;
  const email = body.Email;
  const regiao = body["REGIÃO"];
  const telefoneConsultor = body.telefone_consultor;

  console.log("Payload recebido:", body);

  if (!nome || !telefoneConsultor) {
    console.log("Payload incompleto - faltando nome_completo ou telefone_consultor");
    return res.status(400).json({
      ok: false,
      erro: "Campos obrigatórios: nome_completo e telefone_consultor",
    });
  }

  try {
    // 1. Busca o consultor responsável pelo telefone (sempre em tempo real,
    //    nunca por ID fixo - o consultor por trás do número pode mudar)
    const consultor = await buscarConsultorPorTelefone(telefoneConsultor);

    if (!consultor) {
      console.log(
        `Nenhum consultor encontrado no Agendor para o telefone ${telefoneConsultor}`
      );
      return res.status(404).json({
        ok: false,
        erro: "Consultor não encontrado no Agendor para esse telefone",
        telefoneConsultor,
      });
    }

    console.log(`Consultor encontrado: ${consultor.name} (ID ${consultor.id})`);

    // 2. Cria a Empresa vinculada ao consultor
    const empresa = await criarEmpresa({
      nome,
      telefone,
      email,
      regiao,
      consultorId: consultor.id,
    });

    console.log(`Empresa criada: ${empresa.name} (ID ${empresa.id})`);

    // 3. Cria o Negócio nessa Empresa, no Funil de Vendas / Contato Inicial
    const negocio = await criarNegocio({
      organizationId: empresa.id,
      titulo: nome,
      consultorId: consultor.id,
    });

    console.log(`Negócio criado: ${negocio.title} (ID ${negocio.id})`);

    return res.status(201).json({
      ok: true,
      consultor: { id: consultor.id, name: consultor.name },
      empresa: { id: empresa.id, name: empresa.name },
      negocio: { id: negocio.id, title: negocio.title },
    });
  } catch (err) {
    const detalhe = err.response?.data || err.message;
    console.error("Erro ao processar webhook:", detalhe);
    return res.status(500).json({ ok: false, erro: "Falha ao criar negócio no Agendor", detalhe });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
