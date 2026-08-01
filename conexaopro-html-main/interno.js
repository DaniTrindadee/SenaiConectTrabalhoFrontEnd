const CHAVE_PUBLICACOES = "@conexaopro:publicacoes";
const CHAVE_PERFIL_BASE = "@conexaopro:perfil";
const CHAVE_PROGRESSO = "@conexaopro:progresso";
const CHAVE_NOTIFICACOES = "@conexaopro:notificacoes";
let sessao = null;
let imagemSelecionada = "";
let publicacaoEmEdicao = null;
let buscaGlobalIniciada = false;

// ===== SESSÃO VIA API =====
(async function inicializarSessao() {
    // Inicializar a busca global imediatamente (independente da sessão)
    iniciarBuscaGlobal();

    sessao = getSessao();
    if (!sessao) {
        window.location.replace("login.html");
        return;
    }

    // Validar sessão com o backend
    const usuario = await apiValidarSessao();
    if (!usuario) {
        // apiValidarSessao limpa os dados e retorna null se falhar (nunca lança exceção)
        window.location.replace("login.html");
        return;
    }

    sessao = getSessao(); // Atualizar dados com o retorno do backend

    // Inicializar interface após validar sessão
    inicializarInterface();
})();

function inicializarInterface() {
    if (!sessao) return;

    // Cada usuário possui seu próprio perfil, identificado pela matrícula.
    const CHAVE_PERFIL = sessao?.matricula
        ? `${CHAVE_PERFIL_BASE}:${sessao.matricula}`
        : CHAVE_PERFIL_BASE;

    // Migra uma única vez o perfil da versão anterior para o usuário que está logado.
    if (sessao?.matricula && !localStorage.getItem(CHAVE_PERFIL)) {
        const perfilAntigo = localStorage.getItem(CHAVE_PERFIL_BASE);
        if (perfilAntigo) {
            localStorage.setItem(CHAVE_PERFIL, perfilAntigo);
            localStorage.removeItem(CHAVE_PERFIL_BASE);
        }
    }

    const perfilSalvo = lerJSON(CHAVE_PERFIL, {});
    const primeiroNome = sessao.nome.split(" ")[0];
    const inicial = primeiroNome.charAt(0).toUpperCase();

    // Elementos podem não existir em todas as páginas (ex.: eventos.html).
    const elNomeUsuario = document.querySelector("#nome-usuario");
    const elCursoUsuario = document.querySelector("#curso-usuario");
    const elPrimeiroNome = document.querySelector("#primeiro-nome");
    const elNomeTopo = document.querySelector("#nome-topo");
    if (elNomeUsuario) elNomeUsuario.textContent = sessao.nome;
    if (elCursoUsuario) elCursoUsuario.textContent = sessao.curso;
    if (elPrimeiroNome) elPrimeiroNome.textContent = primeiroNome;
    if (elNomeTopo) elNomeTopo.textContent = primeiroNome;

    ["#avatar", "#avatar-publicacao", "#avatar-topo"].forEach((seletor) => {
        aplicarAvatar(
            document.querySelector(seletor),
            perfilSalvo.foto,
            `Foto de ${sessao.nome}`,
            inicial
        );
    });

    // Sair
    document.querySelector("#sair")?.addEventListener("click", async () => {
        await apiSair();
        window.location.href = "index.html";
    });

    // Carregar conexões na sidebar
    carregarConexoesSidebar();

    // ===== TODO O RESTO DO CÓDIGO EXISTENTE (publicações, comentários, notificações, etc.) =====
    iniciarRestoDaInterface();
}

// ===== FUNÇÕES AUXILIARES (mantidas do original) =====

function lerJSON(chave, fallback) {
    try {
        const valor = JSON.parse(localStorage.getItem(chave));
        return valor ?? fallback;
    } catch {
        return fallback;
    }
}

function salvarJSON(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
}

// ===== CONEXÕES NA SIDEBAR =====

async function carregarConexoesSidebar() {
    const container = document.querySelector("#sidebar-conexoes");
    if (!container) return;

    try {
        const dados = await apiListarConexoes();
        const conexoes = dados.aceitas || [];

        if (conexoes.length === 0) {
            container.innerHTML = `
                <p style="font-size: 0.78rem; color: #6b7294; margin-bottom: 8px;">
                    Você ainda não tem conexões.
                </p>
                <a href="conexoes.html" style="font-size: 0.75rem; color: #6c8cff; font-weight: 500;">
                    Encontrar pessoas →
                </a>
            `;
            return;
        }

        container.innerHTML = conexoes.slice(0, 5).map(conn => {
            const inicial = conn.nome.charAt(0).toUpperCase();
            return `
                <a class="comunidade" href="perfil.html?id=${conn.usuario_id}">
                    <span>${inicial}</span>
                    <div>
                        <strong>${conn.nome.split(" ")[0]}</strong>
                        <small>${conn.curso || "Membro"}</small>
                    </div>
                </a>
            `;
        }).join("");

        if (conexoes.length > 5) {
            container.innerHTML += `
                <a href="conexoes.html" style="display:block; margin-top:8px; font-size:0.75rem; color:#6c8cff; text-align:center;">
                    +${conexoes.length - 5} outras conexões
                </a>
            `;
        }
    } catch (erro) {
        console.error("Erro ao carregar conexões:", erro);
        container.innerHTML = `
            <p style="font-size: 0.78rem; color: #6b7294;">
                Erro ao carregar conexões.
            </p>
        `;
    }
}

// ===== CATÁLOGO DE CONQUISTAS =====
const CATALOGO_CONQUISTAS = [
    { id: "primeiro-acesso", titulo: "Primeiro acesso", texto: "Você entrou na comunidade ConexãoPro.", icone: "fa-door-open" },
    { id: "primeira-publicacao", titulo: "Voz na comunidade", texto: "Sua primeira publicação foi criada.", icone: "fa-pen-to-square" },
    { id: "primeiro-projeto", titulo: "Criador de projetos", texto: "Seu primeiro projeto entrou no portfólio.", icone: "fa-diagram-project" },
    { id: "primeiro-comentario", titulo: "Conexão iniciada", texto: "Você participou da sua primeira conversa.", icone: "fa-comments" },
    { id: "perfil-completo", titulo: "Perfil em destaque", texto: "Foto e apresentação profissional adicionadas.", icone: "fa-id-card" },
    { id: "colaborador", titulo: "Colaborador ativo", texto: "Você chegou a cinco comentários na comunidade.", icone: "fa-people-group" }
];

function obterProgresso() {
    return lerJSON(CHAVE_PROGRESSO, { conquistas: [], xpExtra: 0 });
}

function obterNotificacoes() {
    return lerJSON(CHAVE_NOTIFICACOES, []);
}

function salvarNotificacoes(notificacoes) {
    salvarJSON(CHAVE_NOTIFICACOES, notificacoes.slice(0, 50));
}

// ===== NOTIFICAÇÕES DE SOLICITAÇÕES DE CONEXÃO (BACKEND) =====

// IDs de notificações de conexão já processadas (para evitar duplicatas)
const CHAVE_CONEXOES_NOTIFICADAS = "@conexaopro:conexoes_notificadas";
let conexoesJaNotificadas = new Set();
let ultimasSolicitacoesPendentes = [];

function carregarConexoesNotificadas() {
    try {
        const raw = localStorage.getItem(CHAVE_CONEXOES_NOTIFICADAS);
        if (!raw) {
            conexoesJaNotificadas = new Set();
            return;
        }
        const dados = JSON.parse(raw);
        // Migração: verificar se há chaves antigas (numéricas).
        // Se sim, limpa completamente o armazenamento para recomeçar.
        const temChaveAntiga = Array.isArray(dados) && dados.some(chave => /^\d+$/.test(String(chave)));
        if (temChaveAntiga) {
            localStorage.removeItem(CHAVE_CONEXOES_NOTIFICADAS);
            conexoesJaNotificadas = new Set();
            return;
        }
        const lista = Array.isArray(dados)
            ? dados.filter(chave => typeof chave === "string" && !/^\d+$/.test(chave))
            : [];
        conexoesJaNotificadas = new Set(lista);
    } catch {
        conexoesJaNotificadas = new Set();
    }
}

function salvarConexoesNotificadas() {
    localStorage.setItem(CHAVE_CONEXOES_NOTIFICADAS, JSON.stringify([...conexoesJaNotificadas]));
}

async function verificarSolicitacoesConexao() {
    if (!sessao) return;
    try {
        const dados = await apiListarConexoes();
        const pendentes = dados.pendentes || [];

        // IDs das solicitações pendentes atuais (chave baseada no ID da conexão).
        // Usar o ID da conexão (e não o do usuário) permite que pedidos distintos
        // do mesmo usuário gerem notificações próprias.
        const idsPendentes = new Set(pendentes.map(c => `c-${c.id}`));

        // Limpar chaves de conexões que não estão mais pendentes (aceitas ou
        // recusadas). Assim, um novo pedido da mesma pessoa volta a notificar.
        [...conexoesJaNotificadas].forEach(chave => {
            if (!idsPendentes.has(chave)) {
                conexoesJaNotificadas.delete(chave);
            }
        });

        // Detectar solicitações ainda não notificadas
        const novasSolicitacoes = pendentes.filter(c => {
            const chave = `c-${c.id}`;
            return !conexoesJaNotificadas.has(chave);
        });

        // Adicionar notificações para cada nova solicitação
        novasSolicitacoes.forEach(c => {
            conexoesJaNotificadas.add(`c-${c.id}`);
            adicionarNotificacao(
                `Nova solicitação de ${c.nome.split(" ")[0]}`,
                `${c.nome} ${c.curso ? `· ${c.curso}` : ""} quer se conectar com você!`,
                "conexao",
                { conexaoId: c.id, usuarioId: c.usuario_id, nome: c.nome }
            );
        });

        if (novasSolicitacoes.length > 0) {
            salvarConexoesNotificadas();
        }

        ultimasSolicitacoesPendentes = pendentes;

        // Atualizar badge do botão de notificações
        const notificacoes = obterNotificacoes();
        const totalNaoLidas = notificacoes.filter(n => !n.lida).length;
        const contador = document.querySelector("#contador-notificacoes");
        if (contador) {
            contador.textContent = String(totalNaoLidas);
            contador.hidden = totalNaoLidas === 0;
        }
    } catch (erro) {
        // Silencioso - pode falhar se o servidor não estiver respondendo
        console.debug("Verificação de conexões:", erro.message);
    }
}

// Iniciar polling de solicitações de conexão (a cada 20s)
let intervaloPollingConexoes = null;

function iniciarPollingConexoes() {
    if (intervaloPollingConexoes) return;
    carregarConexoesNotificadas();
    verificarSolicitacoesConexao(); // Primeira verificação imediata
    intervaloPollingConexoes = setInterval(verificarSolicitacoesConexao, 20000);
}

function pararPollingConexoes() {
    if (intervaloPollingConexoes) {
        clearInterval(intervaloPollingConexoes);
        intervaloPollingConexoes = null;
    }
}

function adicionarNotificacao(titulo, texto, tipo = "geral", dadosExtra = null) {
    const notificacoes = obterNotificacoes();
    const notif = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        titulo,
        texto,
        tipo,
        lida: false,
        data: new Date().toISOString()
    };
    if (dadosExtra) {
        notif.dadosConexao = dadosExtra;
    }
    notificacoes.unshift(notif);
    salvarNotificacoes(notificacoes);
    renderizarNotificacoes();
}

function mostrarConquista(conquista) {
    const toast = document.querySelector("#conquista-toast");
    if (!toast) return;
    document.querySelector("#titulo-conquista-toast").textContent = conquista.titulo;
    document.querySelector("#texto-conquista-toast").textContent = conquista.texto;
    toast.querySelector(".icone-conquista i").className = `fa-solid ${conquista.icone}`;
    toast.setAttribute("aria-hidden", "false");
    toast.classList.add("visivel");
    clearTimeout(mostrarConquista.timer);
    mostrarConquista.timer = setTimeout(() => {
        toast.classList.remove("visivel");
        toast.setAttribute("aria-hidden", "true");
    }, 3800);
}

function desbloquearConquista(id) {
    const conquista = CATALOGO_CONQUISTAS.find((item) => item.id === id);
    if (!conquista) return false;
    const progresso = obterProgresso();
    if (progresso.conquistas.includes(id)) return false;
    progresso.conquistas.push(id);
    progresso.xpExtra = Number(progresso.xpExtra || 0) + 25;
    salvarJSON(CHAVE_PROGRESSO, progresso);
    adicionarNotificacao(conquista.titulo, conquista.texto, "conquista");
    mostrarConquista(conquista);
    return true;
}

function calcularEstatisticas() {
    const publicacoes = carregarPublicacoes().map(normalizarPublicacao);
    const comentarios = publicacoes.reduce((total, item) => total + item.comentarios.length, 0);
    const projetos = publicacoes.filter((item) => item.tipo === "Projeto").length;
    const curtidasDadas = publicacoes.filter((item) => item.curtido).length;
    const progresso = obterProgresso();
    const xp = 40 + publicacoes.length * 30 + projetos * 45 + comentarios * 12 + curtidasDadas * 6 + Number(progresso.xpExtra || 0);
    const nivel = Math.floor(xp / 100) + 1;
    const xpNoNivel = xp % 100;
    return { publicacoes, comentarios, projetos, curtidasDadas, xp, nivel, xpNoNivel };
}

function atualizarNivel() {
    const dados = calcularEstatisticas();
    const nivel = document.querySelector("#nivel-feed");
    const xp = document.querySelector("#xp-feed");
    const barra = document.querySelector("#barra-nivel-feed");
    if (nivel) nivel.textContent = String(dados.nivel);
    if (xp) xp.textContent = `${dados.xpNoNivel}/100 XP`;
    if (barra) barra.style.width = `${dados.xpNoNivel}%`;
    return dados;
}

function verificarConquistas() {
    const dados = atualizarNivel();
    desbloquearConquista("primeiro-acesso");
    if (dados.publicacoes.length >= 1) desbloquearConquista("primeira-publicacao");
    if (dados.projetos >= 1) desbloquearConquista("primeiro-projeto");
    if (dados.comentarios >= 1) desbloquearConquista("primeiro-comentario");
    if (dados.comentarios >= 5) desbloquearConquista("colaborador");
    const perfil = lerJSON(CHAVE_PERFIL, {});
    if (perfil.foto && perfil.sobre) desbloquearConquista("perfil-completo");
    atualizarNivel();
}

function formatarTempoNotificacao(dataISO) {
    const minutos = Math.floor((Date.now() - new Date(dataISO).getTime()) / 60000);
    if (minutos < 1) return "agora";
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas} h`;
    return `${Math.floor(horas / 24)} d`;
}

function renderizarNotificacoes() {
    const lista = document.querySelector("#lista-notificacoes");
    const contador = document.querySelector("#contador-notificacoes");
    if (!lista || !contador) return;
    const notificacoes = obterNotificacoes();
    const naoLidas = notificacoes.filter((item) => !item.lida).length;
    contador.textContent = String(naoLidas);
    contador.hidden = naoLidas === 0;
    if (!notificacoes.length) {
        lista.innerHTML = '<p class="notificacoes-vazias">Nenhuma notificação por enquanto.</p>';
        return;
    }
    lista.innerHTML = notificacoes.map((item) => {
        let iconeClasse = "fa-bell";
        let classeExtra = "";
        let htmlAcoes = "";

        if (item.tipo === "conquista") {
            iconeClasse = "fa-trophy";
            classeExtra = "conquista";
        } else if (item.tipo === "conexao") {
            iconeClasse = "fa-user-plus";
            classeExtra = "conexao";
            htmlAcoes = `
                <div class="notificacao-acoes">
                    <button class="notif-aceitar" data-notif-id="${item.id}"><i class="fa-solid fa-check"></i> Aceitar</button>
                    <button class="notif-recusar" data-notif-id="${item.id}"><i class="fa-solid fa-xmark"></i> Recusar</button>
                </div>
            `;
        }

        return `
            <article class="item-notificacao ${classeExtra} ${item.lida ? "" : "nao-lida"}" data-id="${item.id}">
                <span class="icone"><i class="fa-solid ${iconeClasse}"></i></span>
                <div>
                    <strong>${escaparHTML(item.titulo)}</strong>
                    <p>${escaparHTML(item.texto)}</p>
                    ${htmlAcoes}
                </div>
                <time>${formatarTempoNotificacao(item.data)}</time>
            </article>`;
    }).join("");
}

function iniciarNotificacoes() {
    if (!localStorage.getItem("@conexaopro:notificacoes-iniciais")) {
        adicionarNotificacao("Nova oportunidade", "Há duas vagas de estágio em Front-end disponíveis.");
        adicionarNotificacao("Evento chegando", "A Mostra de Projetos acontece em breve no auditório.");
        localStorage.setItem("@conexaopro:notificacoes-iniciais", "true");
    }
    renderizarNotificacoes();
}

function aplicarAvatar(elemento, foto, textoAlternativo, inicial) {
    if (!elemento) return;

    if (foto) {
        elemento.classList.add("com-foto");
        elemento.innerHTML = `<img src="${foto}" alt="${textoAlternativo}">`;
    } else {
        elemento.classList.remove("com-foto");
        elemento.textContent = inicial;
    }
}

// ===== FUNÇÕES DE PUBLICAÇÃO (mantidas do original) =====

const primeiraPublicacaoFixa = document.querySelector(".publicacao-fixa");
const modal = document.querySelector("#modal-publicacao");
const abrirModal = document.querySelector("#abrir-publicacao");
const fecharModal = document.querySelector("#fechar-modal");
const publicar = document.querySelector("#publicar");
const textoPublicacao = document.querySelector("#texto-publicacao");
const tipoPublicacao = document.querySelector("#tipo-publicacao");
const inputImagem = document.querySelector("#imagem-publicacao");
const selecionarImagem = document.querySelector("#selecionar-imagem");
const previewImagem = document.querySelector("#preview-imagem");

function alternarModal(abrir, tipo = null) {
    modal.classList.toggle("aberto", abrir);
    modal.setAttribute("aria-hidden", String(!abrir));
    document.body.style.overflow = abrir ? "hidden" : "";

    if (abrir) {
        if (tipo) tipoPublicacao.value = tipo;
        textoPublicacao.focus();
    } else {
        textoPublicacao.value = "";
        inputImagem.value = "";
        imagemSelecionada = "";
        publicacaoEmEdicao = null;
        publicar.textContent = "Publicar";
        previewImagem.hidden = true;
        previewImagem.removeAttribute("src");
    }
}

abrirModal?.addEventListener("click", () => alternarModal(true));
document.querySelector("#atalho-projeto")?.addEventListener("click", () => alternarModal(true, "Projeto"));
document.querySelector("#atalho-duvida")?.addEventListener("click", () => alternarModal(true, "Dúvida"));
fecharModal?.addEventListener("click", () => alternarModal(false));
modal?.addEventListener("click", (evento) => {
    if (evento.target === modal) alternarModal(false);
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && modal?.classList.contains("aberto")) {
        alternarModal(false);
    }
});

selecionarImagem?.addEventListener("click", () => inputImagem.click());

async function comprimirImagem(arquivo) {
    const dataUrl = await new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.addEventListener("load", () => resolve(String(leitor.result)));
        leitor.addEventListener("error", reject);
        leitor.readAsDataURL(arquivo);
    });

    const imagem = await new Promise((resolve, reject) => {
        const elemento = new Image();
        elemento.addEventListener("load", () => resolve(elemento));
        elemento.addEventListener("error", reject);
        elemento.src = dataUrl;
    });

    const limite = 1280;
    const proporcao = Math.min(1, limite / Math.max(imagem.width, imagem.height));
    const largura = Math.max(1, Math.round(imagem.width * proporcao));
    const altura = Math.max(1, Math.round(imagem.height * proporcao));

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;

    const contexto = canvas.getContext("2d");
    contexto.drawImage(imagem, 0, 0, largura, altura);

    return canvas.toDataURL("image/jpeg", 0.78);
}

inputImagem?.addEventListener("change", async () => {
    const arquivo = inputImagem.files?.[0];
    if (!arquivo || !arquivo.type.startsWith("image/")) return;

    if (arquivo.size > 12 * 1024 * 1024) {
        mostrarAviso("Escolha uma imagem com até 12 MB.");
        inputImagem.value = "";
        return;
    }

    selecionarImagem.disabled = true;
    selecionarImagem.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando imagem';

    try {
        imagemSelecionada = await comprimirImagem(arquivo);
        previewImagem.src = imagemSelecionada;
        previewImagem.hidden = false;
        mostrarAviso("Imagem pronta para publicar.");
    } catch (erro) {
        console.error("Falha ao preparar imagem:", erro);
        imagemSelecionada = "";
        previewImagem.hidden = true;
        mostrarAviso("Não foi possível carregar essa imagem.");
    } finally {
        selecionarImagem.disabled = false;
        selecionarImagem.innerHTML = '<i class="fa-regular fa-image"></i> Adicionar imagem';
    }
});

function escaparHTML(texto) {
    const elemento = document.createElement("div");
    elemento.textContent = texto ?? "";
    return elemento.innerHTML;
}

function carregarPublicacoes() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_PUBLICACOES));
        return Array.isArray(dados) ? dados : [];
    } catch {
        return [];
    }
}

function salvarPublicacoes(publicacoes) {
    try {
        localStorage.setItem(CHAVE_PUBLICACOES, JSON.stringify(publicacoes));
        return true;
    } catch (erro) {
        console.error("Não foi possível salvar as publicações:", erro);
        mostrarAviso("A imagem ficou grande demais para o navegador. Tente outra imagem menor.");
        return false;
    }
}

function normalizarPublicacao(publicacao) {
    return {
        ...publicacao,
        curtido: Boolean(publicacao.curtido),
        curtidas: Number(publicacao.curtidas || 0),
        comentarios: Array.isArray(publicacao.comentarios) ? publicacao.comentarios : []
    };
}

function criarHTMLComentarios(comentarios) {
    return comentarios.map((comentario) => `
        <div class="comentario-item">
            <strong>${escaparHTML(comentario.nome)}</strong>
            <span>${escaparHTML(comentario.texto)}</span>
        </div>
    `).join("");
}

function obterFotoAutor(publicacao) {
    if (publicacao.fotoAutor) return publicacao.fotoAutor;
    if (publicacao.matriculaAutor) {
        return lerJSON(`${CHAVE_PERFIL_BASE}:${publicacao.matriculaAutor}`, {}).foto || "";
    }
    if (publicacao.nome === sessao?.nome) return perfilSalvo.foto || "";
    return "";
}

function criarHTMLPublicacao(publicacaoOriginal) {
    const publicacao = normalizarPublicacao(publicacaoOriginal);
    const primeiroNome = publicacao.nome.split(" ")[0];
    const inicial = primeiroNome.charAt(0).toUpperCase();
    const imagem = publicacao.imagem
        ? `<img class="imagem-publicacao" src="${publicacao.imagem}" alt="Imagem anexada à publicação">`
        : "";
    const classeCurtida = publicacao.curtido ? "ativo" : "";
    const iconeCurtida = publicacao.curtido ? "fa-solid" : "fa-regular";
    const textoCurtida = publicacao.curtido ? "Curtido" : "Curtir";
    const fotoAutor = obterFotoAutor(publicacao);
    const avatarAutor = fotoAutor
        ? `<div class="avatar pequeno com-foto"><img src="${fotoAutor}" alt="Foto de ${escaparHTML(publicacao.nome)}"></div>`
        : `<div class="avatar pequeno">${inicial}</div>`;

    return `
        <article class="publicacao publicacao-usuario" data-id="${publicacao.id}">
            <header>
                ${avatarAutor}
                <div>
                    <strong>${escaparHTML(publicacao.nome)}</strong>
                    <span>${escaparHTML(publicacao.curso)} · agora</span>
                </div>
                <div class="acoes-publicacao-propria">
                    <button class="editar-publicacao" type="button" aria-label="Editar publicação" title="Editar publicação">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="excluir-publicacao" type="button" aria-label="Excluir publicação" title="Excluir publicação">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </header>
            <span class="tipo-publicacao">${escaparHTML(publicacao.tipo)}</span>
            <p>${escaparHTML(publicacao.texto)}</p>
            ${imagem}
            <div class="metricas">
                <span><b class="contador-curtidas">${publicacao.curtidas}</b> curtidas</span>
                <span><b class="contador-comentarios">${publicacao.comentarios.length}</b> comentários</span>
            </div>
            <footer>
                <button class="curtir ${classeCurtida}" type="button"><i class="${iconeCurtida} fa-thumbs-up"></i> ${textoCurtida}</button>
                <button class="comentar" type="button"><i class="fa-regular fa-comment"></i> Comentar</button>
                <button class="compartilhar" type="button"><i class="fa-solid fa-share-nodes"></i> Compartilhar</button>
            </footer>
            <section class="area-comentarios" ${publicacao.comentarios.length ? "" : "hidden"}>
                <form class="form-comentario">
                    <input type="text" maxlength="180" placeholder="Escreva um comentário..." required>
                    <button type="submit">Enviar</button>
                </form>
                <div class="lista-comentarios">${criarHTMLComentarios(publicacao.comentarios)}</div>
            </section>
        </article>`;
}

function renderizarPublicacoesSalvas() {
    if (!primeiraPublicacaoFixa) return;
    document.querySelectorAll(".publicacao-usuario").forEach((elemento) => elemento.remove());
    const publicacoes = carregarPublicacoes().map(normalizarPublicacao);
    publicacoes.forEach((publicacao) => {
        primeiraPublicacaoFixa.insertAdjacentHTML("beforebegin", criarHTMLPublicacao(publicacao));
    });
}

function atualizarPublicacao(id, alteracao) {
    const publicacoes = carregarPublicacoes().map(normalizarPublicacao);
    const indice = publicacoes.findIndex((item) => item.id === id);
    if (indice < 0) return null;

    publicacoes[indice] = { ...publicacoes[indice], ...alteracao };
    if (!salvarPublicacoes(publicacoes)) return null;
    return publicacoes[indice];
}

publicar?.addEventListener("click", () => {
    const texto = textoPublicacao.value.trim();
    if (!texto) {
        textoPublicacao.focus();
        return;
    }

    if (publicacaoEmEdicao) {
        const publicacoes = carregarPublicacoes().map(normalizarPublicacao);
        const indice = publicacoes.findIndex((item) => item.id === publicacaoEmEdicao);
        if (indice >= 0) {
            publicacoes[indice] = {
                ...publicacoes[indice],
                tipo: tipoPublicacao.value,
                texto,
                imagem: imagemSelecionada || publicacoes[indice].imagem
            };
            if (!salvarPublicacoes(publicacoes)) return;
            renderizarPublicacoesSalvas();
            alternarModal(false);
            mostrarAviso("Publicação atualizada!");
            verificarConquistas();
        }
        return;
    }

    const novaPublicacao = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        nome: sessao.nome,
        matriculaAutor: sessao.matricula,
        fotoAutor: perfilSalvo.foto || "",
        curso: sessao.curso,
        tipo: tipoPublicacao.value,
        texto,
        imagem: imagemSelecionada,
        curtido: false,
        curtidas: 0,
        comentarios: []
    };

    const publicacoes = carregarPublicacoes();
    publicacoes.unshift(novaPublicacao);
    if (!salvarPublicacoes(publicacoes)) return;

    renderizarPublicacoesSalvas();
    alternarModal(false);
    mostrarAviso("Publicação criada!");
    verificarConquistas();
});

async function compartilharPublicacao() {
    const texto = "Confira esta publicação no ConexãoPro!";
    try {
        if (navigator.share) {
            await navigator.share({ title: "ConexãoPro", text: texto });
        } else {
            await navigator.clipboard.writeText(texto);
            mostrarAviso("Texto da publicação copiado!");
        }
    } catch {
        // Cancelar o compartilhamento não é um erro.
    }
}

function mostrarAviso(mensagem) {
    const aviso = document.createElement("div");
    aviso.className = "aviso-flutuante";
    aviso.textContent = mensagem;
    document.body.appendChild(aviso);
    requestAnimationFrame(() => aviso.classList.add("visivel"));
    setTimeout(() => aviso.remove(), 2200);
}

function garantirAreaComentarios(publicacao) {
    let area = publicacao.querySelector(".area-comentarios");
    if (area) return area;

    area = document.createElement("section");
    area.className = "area-comentarios";
    area.innerHTML = `
        <form class="form-comentario">
            <input type="text" maxlength="180" placeholder="Escreva um comentário..." required>
            <button type="submit">Enviar</button>
        </form>
        <div class="lista-comentarios"></div>`;
    publicacao.appendChild(area);
    return area;
}

document.addEventListener("click", (evento) => {
    const botaoEditar = evento.target.closest(".editar-publicacao");
    if (botaoEditar) {
        const publicacao = botaoEditar.closest(".publicacao-usuario");
        const id = publicacao?.dataset.id;
        const registro = carregarPublicacoes().map(normalizarPublicacao).find((item) => item.id === id);
        if (!registro) return;

        publicacaoEmEdicao = id;
        tipoPublicacao.value = registro.tipo;
        textoPublicacao.value = registro.texto;
        imagemSelecionada = registro.imagem || "";
        if (imagemSelecionada) {
            previewImagem.src = imagemSelecionada;
            previewImagem.hidden = false;
        }
        publicar.textContent = "Salvar alterações";
        modal.classList.add("aberto");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        textoPublicacao.focus();
        return;
    }

    const botaoExcluir = evento.target.closest(".excluir-publicacao");
    if (botaoExcluir) {
        const publicacao = botaoExcluir.closest(".publicacao-usuario");
        const id = publicacao?.dataset.id;
        if (!id) return;

        if (!window.confirm("Excluir esta publicação?")) return;
        const publicacoes = carregarPublicacoes().filter((item) => item.id !== id);
        salvarPublicacoes(publicacoes);
        publicacao.remove();
        mostrarAviso("Publicação excluída.");
        verificarConquistas();
        return;
    }

    const botaoCurtir = evento.target.closest(".curtir");
    if (botaoCurtir) {
        const publicacao = botaoCurtir.closest(".publicacao");
        const id = publicacao?.dataset.id;
        const ativo = botaoCurtir.classList.toggle("ativo");
        botaoCurtir.innerHTML = ativo
            ? '<i class="fa-solid fa-thumbs-up"></i> Curtido'
            : '<i class="fa-regular fa-thumbs-up"></i> Curtir';

        const contador = publicacao?.querySelector(".contador-curtidas");
        const valorAtual = Number(contador?.textContent || 0);
        const novoValor = Math.max(0, valorAtual + (ativo ? 1 : -1));
        if (contador) contador.textContent = String(novoValor);
        botaoCurtir.classList.remove("animar-curtida");
        void botaoCurtir.offsetWidth;
        botaoCurtir.classList.add("animar-curtida");

        if (id) atualizarPublicacao(id, { curtido: ativo, curtidas: novoValor });
        verificarConquistas();
        return;
    }

    const botaoComentar = evento.target.closest(".comentar");
    if (botaoComentar) {
        const publicacao = botaoComentar.closest(".publicacao");
        if (!publicacao) return;
        const area = garantirAreaComentarios(publicacao);
        area.hidden = !area.hidden;
        if (!area.hidden) area.querySelector("input")?.focus();
        return;
    }

    if (evento.target.closest(".compartilhar")) {
        compartilharPublicacao();
    }
});

document.addEventListener("submit", (evento) => {
    const formulario = evento.target.closest(".form-comentario");
    if (!formulario) return;
    evento.preventDefault();

    const input = formulario.querySelector("input");
    const texto = input.value.trim();
    if (!texto) return;

    const publicacao = formulario.closest(".publicacao");
    const lista = formulario.parentElement.querySelector(".lista-comentarios");
    const item = document.createElement("div");
    item.className = "comentario-item";
    item.innerHTML = `<strong>${escaparHTML(sessao.nome)}</strong><span>${escaparHTML(texto)}</span>`;
    lista.prepend(item);
    input.value = "";

    const contador = publicacao?.querySelector(".contador-comentarios");
    if (contador) contador.textContent = String(lista.children.length);

    const id = publicacao?.dataset.id;
    if (id) {
        const publicacoes = carregarPublicacoes().map(normalizarPublicacao);
        const itemSalvo = publicacoes.find((registro) => registro.id === id);
        if (itemSalvo) {
            itemSalvo.comentarios.unshift({ nome: sessao.nome, matriculaAutor: sessao.matricula, texto });
            salvarPublicacoes(publicacoes);
        }
    }
});

// ===== NOTIFICAÇÕES =====

const botaoNotificacoes = document.querySelector("#abrir-notificacoes");
const painelNotificacoes = document.querySelector("#painel-notificacoes");
botaoNotificacoes?.addEventListener("click", (evento) => {
    evento.stopPropagation();
    const abrir = !painelNotificacoes.classList.contains("aberto");
    painelNotificacoes.classList.toggle("aberto", abrir);
    painelNotificacoes.setAttribute("aria-hidden", String(!abrir));
});

document.querySelector("#marcar-lidas")?.addEventListener("click", () => {
    const notificacoes = obterNotificacoes().map((item) => ({ ...item, lida: true }));
    salvarNotificacoes(notificacoes);
    renderizarNotificacoes();
});

document.querySelector("#lista-notificacoes")?.addEventListener("click", (evento) => {
    const item = evento.target.closest(".item-notificacao");
    if (!item) return;
    const notificacoes = obterNotificacoes().map((registro) => registro.id === item.dataset.id ? { ...registro, lida: true } : registro);
    salvarNotificacoes(notificacoes);
    renderizarNotificacoes();
});

document.addEventListener("click", async (evento) => {
    // Aceitar solicitação de conexão pela notificação
    const btnAceitar = evento.target.closest(".notif-aceitar");
    if (btnAceitar) {
        evento.stopPropagation();
        const notifId = btnAceitar.dataset.notifId;
        const notificacoes = obterNotificacoes();
        const notif = notificacoes.find(n => n.id === notifId);
        if (!notif || !notif.dadosConexao) return;

        try {
            await apiResponderConexao(notif.dadosConexao.conexaoId, "aceitar");
            // Marcar como lida e atualizar
            const atualizadas = notificacoes.map(n =>
                n.id === notifId ? { ...n, lida: true, texto: "✅ Conexão aceita! Vocês agora estão conectados." } : n
            );
            salvarNotificacoes(atualizadas);
            renderizarNotificacoes();
            mostrarAviso("Conexão aceita com sucesso!");
            carregarConexoesSidebar();
        } catch (erro) {
            mostrarAviso("Erro ao aceitar: " + erro.message);
        }
        return;
    }

    // Recusar solicitação de conexão pela notificação
    const btnRecusar = evento.target.closest(".notif-recusar");
    if (btnRecusar) {
        evento.stopPropagation();
        const notifId = btnRecusar.dataset.notifId;
        const notificacoes = obterNotificacoes();
        const notif = notificacoes.find(n => n.id === notifId);
        if (!notif || !notif.dadosConexao) return;

        try {
            await apiResponderConexao(notif.dadosConexao.conexaoId, "recusar");
            const atualizadas = notificacoes.map(n =>
                n.id === notifId ? { ...n, lida: true, texto: "❌ Solicitação recusada." } : n
            );
            salvarNotificacoes(atualizadas);
            renderizarNotificacoes();
            mostrarAviso("Solicitação recusada.");
        } catch (erro) {
            mostrarAviso("Erro ao recusar: " + erro.message);
        }
        return;
    }

    if (!painelNotificacoes?.classList.contains("aberto")) return;
    if (evento.target.closest("#painel-notificacoes") || evento.target.closest("#abrir-notificacoes")) return;
    painelNotificacoes.classList.remove("aberto");
    painelNotificacoes.setAttribute("aria-hidden", "true");
});

document.querySelector("#abrir-mensagens")?.addEventListener("click", () => {
    mostrarAviso("Mensagens estarão disponíveis na próxima sprint.");
});

// ===== INICIAR INTERFACE RESTANTE =====
function iniciarRestoDaInterface() {
    const perfilSalvo = lerJSON(
        sessao?.matricula ? `${CHAVE_PERFIL_BASE}:${sessao.matricula}` : CHAVE_PERFIL_BASE,
        {}
    );

    renderizarPublicacoesSalvas();
    iniciarNotificacoes();
    verificarConquistas();
    iniciarBuscaGlobal();
    iniciarPollingConexoes();
}

// ===== BUSCA GLOBAL (PESSOAS, PROJETOS, CURSOS) =====

const DADOS_CURSOS_BUSCA = [
    { titulo: "HTML e CSS", descricao: "Aprenda a criar sites modernos.", icone: "fa-html5", url: "cursos.html" },
    { titulo: "JavaScript", descricao: "Domine programação Web.", icone: "fa-js", url: "cursos.html" },
    { titulo: "React", descricao: "Desenvolvimento Front-end moderno.", icone: "fa-react", url: "cursos.html" },
    { titulo: "Python", descricao: "Programação Back-end.", icone: "fa-python", url: "cursos.html" },
    { titulo: "Java", descricao: "POO e aplicações corporativas.", icone: "fa-java", url: "cursos.html" },
    { titulo: "Banco de Dados", descricao: "SQL e Modelagem.", icone: "fa-database", url: "cursos.html" },
];

const DADOS_EVENTOS_BUSCA = [
    { titulo: "Mostra de Projetos Front-end", descricao: "Apresentação dos projetos finais da turma de Programador Front-end", tipo: "apresentacao", data: "30 JUL · 19h00", local: "Auditório Principal", url: "eventos.html" },
    { titulo: "Oficina de GitHub e Colaboração", descricao: "Aprenda a usar Git e GitHub na prática", tipo: "oficina", data: "02 AGO · 14h00", local: "Laboratório 3", url: "eventos.html" },
    { titulo: "Palestra: Tendências de IA na Educação", descricao: "Como a inteligência artificial está transformando a educação profissional", tipo: "palestra", data: "05 AGO · 10h00", local: "Auditório Principal", url: "eventos.html" },
    { titulo: "Hackathon Inovação SENAI 2026", descricao: "24 horas de programação e inovação em equipes", tipo: "hackathon", data: "15 AGO · 08h00", local: "Espaço Maker", url: "eventos.html" },
    { titulo: "Cerimônia de Formatura - Turma 2026", descricao: "Cerimônia de formatura dos cursos do SENAI", tipo: "institucional", data: "20 AGO · 18h00", local: "Centro de Eventos", url: "eventos.html" },
    { titulo: "Workshop: UX Design para Iniciantes", descricao: "Introdução ao design de experiência do usuário", tipo: "workshop", data: "08 AGO · 09h00", local: "Laboratório 1", url: "eventos.html" },
    { titulo: "Exposição de Robótica Industrial", descricao: "Demonstrações ao vivo de robôs e automação", tipo: "exibicao", data: "12 AGO · 10h00", local: "Hangar de Exposições", url: "eventos.html" },
    { titulo: "Feira de Inovação e Projetos", descricao: "Projetos de todas as áreas: mecânica, informática, eletrônica e logística", tipo: "exibicao", data: "25 AGO · 09h00", local: "Área Externa", url: "eventos.html" },
];

function getProjetosBusca() {
    const publicacoes = carregarPublicacoes();
    const projetos = publicacoes
        .filter(p => p.tipo === "Projeto")
        .map(p => ({
            titulo: p.texto.slice(0, 60) + (p.texto.length > 60 ? "..." : ""),
            descricao: `Por ${p.nome}`,
            autor: p.nome,
            url: `perfil.html`
        }));

    // Projetos estáticos
    const projetosEstaticos = [
        { titulo: "Sistema Financeiro", descricao: "Dashboard de controle financeiro pessoal", autor: "Everton Salles", url: "projetosv2.html" },
        { titulo: "Senai Food", descricao: "App de delivery para cantinas universitárias", autor: "Maria Silva", url: "projetosv2.html" },
        { titulo: "DevPad Online", descricao: "Editor de código colaborativo no navegador", autor: "Ricardo Santos", url: "projetosv2.html" },
        { titulo: "Portfólio Profissional", descricao: "Site responsivo com animações", autor: "Ana Beatriz", url: "projetosv2.html" },
        { titulo: "API Escolar", descricao: "API REST para gerenciamento escolar", autor: "Lucas Oliveira", url: "projetosv2.html" },
        { titulo: "FitLife", descricao: "App de acompanhamento de treinos", autor: "Camila Souza", url: "projetosv2.html" },
        { titulo: "Chat em Tempo Real", descricao: "Mensagens instantâneas com salas", autor: "João Pedro", url: "projetosv2.html" },
        { titulo: "TravelGo", descricao: "App de organização de viagens", autor: "Fernanda Costa", url: "projetosv2.html" },
    ];

    return [...projetosEstaticos, ...projetos];
}

function iniciarBuscaGlobal() {
    const inputBusca = document.querySelector("#busca");
    if (!inputBusca) return;

    // Evitar dupla inicialização (chamado no início e após validar sessão)
    if (buscaGlobalIniciada) return;
    buscaGlobalIniciada = true;

    // Criar container de resultados
    let painelResultados = document.querySelector("#resultados-busca");
    if (!painelResultados) {
        painelResultados = document.createElement("div");
        painelResultados.id = "resultados-busca";
        painelResultados.className = "resultados-busca";
        painelResultados.setAttribute("aria-label", "Resultados da pesquisa");
        inputBusca.parentElement.style.position = "relative";
        inputBusca.parentElement.appendChild(painelResultados);
    }

    let timeoutBusca = null;
    let pessoasCache = [];
    let indiceSelecionado = -1;

    // Carregar pessoas uma vez
    async function carregarPessoas() {
        try {
            pessoasCache = await apiListarUsuarios();
        } catch {
            pessoasCache = [];
        }
    }
    carregarPessoas();

    function fecharResultados() {
        painelResultados.classList.remove("aberto");
        painelResultados.innerHTML = "";
        indiceSelecionado = -1;
    }

    function navegarPara(url) {
        fecharResultados();
        inputBusca.value = "";
        window.location.href = url;
    }

    function renderizarResultados(termo) {
        const termoBusca = termo.trim().toLowerCase();
        if (!termoBusca || termoBusca.length < 2) {
            fecharResultados();
            return;
        }

        // Filtrar pessoas
        const pessoas = pessoasCache.filter(u =>
            u.nome.toLowerCase().includes(termoBusca) ||
            (u.curso || "").toLowerCase().includes(termoBusca) ||
            u.matricula.toLowerCase().includes(termoBusca)
        ).slice(0, 5);

        // Filtrar projetos
        const projetos = getProjetosBusca().filter(p =>
            p.titulo.toLowerCase().includes(termoBusca) ||
            p.descricao.toLowerCase().includes(termoBusca) ||
            (p.autor || "").toLowerCase().includes(termoBusca)
        ).slice(0, 4);

        // Filtrar cursos
        const cursos = DADOS_CURSOS_BUSCA.filter(c =>
            c.titulo.toLowerCase().includes(termoBusca) ||
            c.descricao.toLowerCase().includes(termoBusca)
        ).slice(0, 3);

        // Filtrar eventos
        const eventos = DADOS_EVENTOS_BUSCA.filter(e =>
            e.titulo.toLowerCase().includes(termoBusca) ||
            e.descricao.toLowerCase().includes(termoBusca) ||
            e.local.toLowerCase().includes(termoBusca) ||
            e.tipo.toLowerCase().includes(termoBusca)
        ).slice(0, 3);

        const total = pessoas.length + projetos.length + cursos.length + eventos.length;
        if (total === 0) {
            painelResultados.innerHTML = `
                <div class="resultado-vazio">
                    <i class="fa-solid fa-search"></i>
                    <span>Nenhum resultado encontrado para "<strong>${escaparHTML(termoBusca)}</strong>"</span>
                </div>
            `;
            painelResultados.classList.add("aberto");
            indiceSelecionado = -1;
            return;
        }

        let html = "";
        let idx = 0;

        if (pessoas.length > 0) {
            html += `<div class="resultado-categoria"><i class="fa-solid fa-users"></i> Pessoas</div>`;
            pessoas.forEach(p => {
                const inicial = p.nome.charAt(0).toUpperCase();
                const foto = p.foto ? `<img src="${p.foto}" alt="">` : inicial;
                html += `
                    <div class="resultado-item" data-index="${idx}" data-url="conexoes.html?usuario=${p.id}" tabindex="-1">
                        <span class="resultado-avatar">${foto}</span>
                        <div class="resultado-info">
                            <strong>${escaparHTML(p.nome)}</strong>
                            <small>${escaparHTML(p.curso || "Membro da comunidade")}</small>
                        </div>
                    </div>
                `;
                idx++;
            });
        }

        if (projetos.length > 0) {
            html += `<div class="resultado-categoria"><i class="fa-solid fa-diagram-project"></i> Projetos</div>`;
            projetos.forEach(p => {
                html += `
                    <div class="resultado-item" data-index="${idx}" data-url="${p.url}" tabindex="-1">
                        <span class="resultado-icone"><i class="fa-solid fa-code"></i></span>
                        <div class="resultado-info">
                            <strong>${escaparHTML(p.titulo)}</strong>
                            <small>${escaparHTML(p.descricao)}</small>
                        </div>
                    </div>
                `;
                idx++;
            });
        }

        if (cursos.length > 0) {
            html += `<div class="resultado-categoria"><i class="fa-solid fa-graduation-cap"></i> Cursos</div>`;
            cursos.forEach(c => {
                const isBrand = !c.icone.startsWith("fa-solid");
                const iconeClasse = isBrand ? `fa-brands ${c.icone}` : c.icone;
                html += `
                    <div class="resultado-item" data-index="${idx}" data-url="${c.url}" tabindex="-1">
                        <span class="resultado-icone"><i class="${iconeClasse}"></i></span>
                        <div class="resultado-info">
                            <strong>${escaparHTML(c.titulo)}</strong>
                            <small>${escaparHTML(c.descricao)}</small>
                        </div>
                    </div>
                `;
                idx++;
            });
        }

        if (eventos.length > 0) {
            html += `<div class="resultado-categoria"><i class="fa-solid fa-calendar-check"></i> Eventos</div>`;
            eventos.forEach(e => {
                html += `
                    <div class="resultado-item" data-index="${idx}" data-url="${e.url}" tabindex="-1">
                        <span class="resultado-icone"><i class="fa-solid fa-calendar-day"></i></span>
                        <div class="resultado-info">
                            <strong>${escaparHTML(e.titulo)}</strong>
                            <small>${escaparHTML(e.data)} · ${escaparHTML(e.local)}</small>
                        </div>
                    </div>
                `;
                idx++;
            });
        }

        // Rodapé com atalho
        html += `
            <div class="resultado-footer">
                <span><i class="fa-solid fa-arrow-up"></i><i class="fa-solid fa-arrow-down"></i> Navegar · <i class="fa-solid fa-return"></i> Abrir · <kbd>Esc</kbd> Fechar</span>
            </div>
        `;

        painelResultados.innerHTML = html;
        painelResultados.classList.add("aberto");
        indiceSelecionado = -1;

        // Eventos de clique
        painelResultados.querySelectorAll(".resultado-item").forEach(item => {
            item.addEventListener("click", () => {
                navegarPara(item.dataset.url);
            });
            item.addEventListener("mouseenter", () => {
                indiceSelecionado = parseInt(item.dataset.index);
                atualizarDestaque();
            });
        });
    }

    function atualizarDestaque() {
        painelResultados.querySelectorAll(".resultado-item").forEach(item => {
            item.classList.toggle("destacado", parseInt(item.dataset.index) === indiceSelecionado);
        });
        const item = painelResultados.querySelector(`.resultado-item[data-index="${indiceSelecionado}"]`);
        if (item) item.scrollIntoView({ block: "nearest" });
    }

    // Input event
    inputBusca.addEventListener("input", () => {
        clearTimeout(timeoutBusca);
        timeoutBusca = setTimeout(() => {
            renderizarResultados(inputBusca.value);
        }, 250);
    });

    // Focus
    inputBusca.addEventListener("focus", () => {
        if (inputBusca.value.trim().length >= 2) {
            renderizarResultados(inputBusca.value);
        }
    });

    // Teclado
    inputBusca.addEventListener("keydown", (e) => {
        const itens = painelResultados.querySelectorAll(".resultado-item");
        if (itens.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            indiceSelecionado = Math.min(indiceSelecionado + 1, itens.length - 1);
            atualizarDestaque();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            indiceSelecionado = Math.max(indiceSelecionado - 1, 0);
            atualizarDestaque();
        } else if (e.key === "Enter" && indiceSelecionado >= 0) {
            e.preventDefault();
            const item = itens[indiceSelecionado];
            if (item) navegarPara(item.dataset.url);
        } else if (e.key === "Escape") {
            fecharResultados();
            inputBusca.blur();
        }
    });

    // Fechar ao clicar fora
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".pesquisa") && !e.target.closest("#resultados-busca")) {
            fecharResultados();
        }
    });
}
