const CHAVE_PUBLICACOES = "@conexaopro:publicacoes";
const CHAVE_PERFIL_BASE = "@conexaopro:perfil";
const CHAVE_PROGRESSO = "@conexaopro:progresso";
const CHAVE_NOTIFICACOES = "@conexaopro:notificacoes";
let sessao = null;
let imagemSelecionada = "";
let publicacaoEmEdicao = null;

// ===== SESSÃO VIA API =====
(async function inicializarSessao() {
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

    document.querySelector("#nome-usuario").textContent = sessao.nome;
    document.querySelector("#curso-usuario").textContent = sessao.curso;
    document.querySelector("#primeiro-nome").textContent = primeiroNome;
    document.querySelector("#nome-topo").textContent = primeiroNome;

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
    salvarJSON(CHAVE_NOTIFICACOES, notificacoes.slice(0, 30));
}

function adicionarNotificacao(titulo, texto, tipo = "geral") {
    const notificacoes = obterNotificacoes();
    notificacoes.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        titulo,
        texto,
        tipo,
        lida: false,
        data: new Date().toISOString()
    });
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
    lista.innerHTML = notificacoes.map((item) => `
        <article class="item-notificacao ${item.tipo === "conquista" ? "conquista" : ""} ${item.lida ? "" : "nao-lida"}" data-id="${item.id}">
            <span class="icone"><i class="fa-solid ${item.tipo === "conquista" ? "fa-trophy" : "fa-bell"}"></i></span>
            <div><strong>${escaparHTML(item.titulo)}</strong><p>${escaparHTML(item.texto)}</p></div>
            <time>${formatarTempoNotificacao(item.data)}</time>
        </article>`).join("");
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

document.addEventListener("click", (evento) => {
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
}
