const CHAVE_PUBLICACOES = "@conexaopro:publicacoes";
const CHAVE_PERFIL_BASE = "@conexaopro:perfil";
const CHAVE_PROGRESSO = "@conexaopro:progresso";

let sessao = null;
let perfilSalvo = {};

function lerJSON(chave, fallback) {
    try {
        const valor = JSON.parse(localStorage.getItem(chave));
        return valor ?? fallback;
    } catch {
        return fallback;
    }
}

// ===== INICIALIZAÇÃO VIA API =====
(async function inicializar() {
    sessao = getSessao();
    if (!sessao) {
        window.location.replace("login.html");
        return;
    }

    // Validar sessão com o backend
    try {
        await apiValidarSessao();
        sessao = getSessao();
    } catch {
        window.location.replace("login.html");
        return;
    }

    await carregarDadosPerfil();
})();

async function carregarDadosPerfil() {
    if (!sessao) return;

    // O perfil é separado por matrícula para impedir que a foto de um usuário
    // apareça no perfil de outro usuário no mesmo navegador.
    const CHAVE_PERFIL = sessao?.matricula
        ? `${CHAVE_PERFIL_BASE}:${sessao.matricula}`
        : CHAVE_PERFIL_BASE;

    // Migração única dos dados da versão anterior.
    if (sessao?.matricula && !localStorage.getItem(CHAVE_PERFIL)) {
        const perfilAntigo = localStorage.getItem(CHAVE_PERFIL_BASE);
        if (perfilAntigo) {
            localStorage.setItem(CHAVE_PERFIL, perfilAntigo);
            localStorage.removeItem(CHAVE_PERFIL_BASE);
        }
    }

    const publicacoes = lerJSON(CHAVE_PUBLICACOES, []);
    perfilSalvo = lerJSON(CHAVE_PERFIL, {});
    const progressoSalvo = lerJSON(CHAVE_PROGRESSO, { conquistas: [], xpExtra: 0 });
    const projetos = publicacoes.filter((item) => item.tipo === "Projeto");
    const totalComentarios = publicacoes.reduce((total, item) => total + (Array.isArray(item.comentarios) ? item.comentarios.length : 0), 0);
    const totalCurtidas = publicacoes.reduce((total, item) => total + Number(item.curtidas || 0), 0);
    const xpTotal = 40 + publicacoes.length * 30 + projetos.length * 45 + totalComentarios * 12 + publicacoes.filter((item) => item.curtido).length * 6 + Number(progressoSalvo.xpExtra || 0);
    const nivel = Math.floor(xpTotal / 100) + 1;
    const forca = Math.min(96, 68 + Math.min(publicacoes.length * 4, 16) + (perfilSalvo.foto ? 6 : 0) + (perfilSalvo.sobre ? 6 : 0));
    const primeiroNome = sessao.nome.split(" ")[0];
    const inicial = primeiroNome.charAt(0).toUpperCase();

    function selecionar(seletor) {
        return document.querySelector(seletor);
    }

    selecionar("#nome-perfil").textContent = sessao.nome;
    selecionar("#curso-perfil").textContent = sessao.curso;
    selecionar("#avatar-inicial").textContent = inicial;
    selecionar("#nivel").textContent = String(nivel);
    selecionar("#forca-perfil").textContent = `${forca}%`;
    selecionar("#barra-forca").style.width = `${forca}%`;
    selecionar("#total-projetos").textContent = String(projetos.length);
    selecionar("#total-conquistas").textContent = String(progressoSalvo.conquistas.length);

    if (perfilSalvo.sobre) {
        selecionar("#texto-sobre").textContent = perfilSalvo.sobre;
    }

    if (perfilSalvo.foto) {
        const foto = selecionar("#avatar-foto");
        foto.src = perfilSalvo.foto;
        foto.hidden = false;
        selecionar("#avatar-inicial").hidden = true;
    }

    // ===== FUNÇÕES =====

    function salvarPerfilLocal(alteracao) {
        const atual = lerJSON(CHAVE_PERFIL, {});
        localStorage.setItem(CHAVE_PERFIL, JSON.stringify({ ...atual, ...alteracao }));
    }

    // Foto
    selecionar("#foto-perfil")?.addEventListener("change", async (evento) => {
        const arquivo = evento.target.files?.[0];
        if (!arquivo || !arquivo.type.startsWith("image/")) return;

        const leitor = new FileReader();
        leitor.onload = async () => {
            const foto = String(leitor.result);
            // Salvar local
            salvarPerfilLocal({ foto });
            // Salvar na API
            try {
                await apiAtualizarPerfil({ foto });
            } catch (erro) {
                console.error("Erro ao salvar foto na API:", erro);
            }
            selecionar("#avatar-foto").src = foto;
            selecionar("#avatar-foto").hidden = false;
            selecionar("#avatar-inicial").hidden = true;
        };
        leitor.readAsDataURL(arquivo);
    });

    function escaparHTML(texto) {
        const elemento = document.createElement("div");
        elemento.textContent = texto ?? "";
        return elemento.innerHTML;
    }

    function renderizarProjetos() {
        const grade = selecionar("#grade-projetos");
        if (!projetos.length) {
            grade.innerHTML = `
                <div class="projeto-vazio">
                    <i class="fa-solid fa-diagram-project"></i>
                    <p>Publique um projeto no feed para começar seu portfólio profissional.</p>
                </div>`;
            return;
        }

        grade.innerHTML = projetos.slice().reverse().map((projeto) => {
            const capa = projeto.imagem
                ? `<img src="${projeto.imagem}" alt="Imagem do projeto">`
                : `<i class="fa-solid fa-code"></i>`;
            return `
                <article class="projeto">
                    <div class="projeto-capa">${capa}</div>
                    <div class="projeto-corpo">
                        <strong>${escaparHTML(projeto.texto.slice(0, 55))}${projeto.texto.length > 55 ? "..." : ""}</strong>
                        <p>${escaparHTML(sessao.curso)} · ${Number(projeto.curtidas || 0)} curtidas</p>
                        <div class="tags"><span>HTML</span><span>CSS</span><span>JavaScript</span></div>
                    </div>
                </article>`;
        }).join("");
    }
    renderizarProjetos();

    if (projetos.length > 0) {
        const conquista = document.querySelector(".conquista.bloqueada");
        conquista?.classList.remove("bloqueada");
        if (conquista) {
            conquista.querySelector("strong").textContent = "Primeiro projeto";
            conquista.querySelector("small").textContent = "Projeto publicado no portfólio";
        }
    }

    function alternarModal(seletor, abrir) {
        const modal = selecionar(seletor);
        modal.classList.toggle("aberto", abrir);
        modal.setAttribute("aria-hidden", String(!abrir));
        document.body.style.overflow = abrir ? "hidden" : "";
    }

    // Sobre
    selecionar("#editar-sobre")?.addEventListener("click", () => {
        selecionar("#campo-sobre").value = selecionar("#texto-sobre").textContent.trim();
        alternarModal("#modal-sobre", true);
    });
    selecionar("#fechar-sobre")?.addEventListener("click", () => alternarModal("#modal-sobre", false));
    selecionar("#salvar-sobre")?.addEventListener("click", async () => {
        const texto = selecionar("#campo-sobre").value.trim();
        if (!texto) return;
        selecionar("#texto-sobre").textContent = texto;
        salvarPerfilLocal({ sobre: texto });
        try {
            await apiAtualizarPerfil({ sobre: texto });
        } catch (erro) {
            console.error("Erro ao salvar sobre na API:", erro);
        }
        alternarModal("#modal-sobre", false);
    });

    // Análise IA
    selecionar("#analisar-perfil")?.addEventListener("click", () => {
        const recomendacaoProjeto = projetos.length
            ? "Seu portfólio já possui projetos. O próximo passo é incluir links do GitHub e explicar o problema resolvido em cada projeto."
            : "Seu perfil ainda não possui projetos. Publique ao menos dois projetos para demonstrar sua evolução prática.";
        const recomendacaoInteracao = totalComentarios > 0
            ? `Você já participa das conversas da comunidade. Continue ajudando colegas para fortalecer sua presença profissional.`
            : "Comente em publicações de colegas e professores. Essa participação mostra colaboração e comunicação.";

        selecionar("#resultado-ia").innerHTML = `
            <article><i class="fa-solid fa-circle-check"></i><div><strong>Ponto forte</strong><p>Seu perfil está ${forca}% completo e demonstra foco em ${escaparHTML(sessao.curso)}.</p></div></article>
            <article><i class="fa-solid fa-diagram-project"></i><div><strong>Próximo passo</strong><p>${recomendacaoProjeto}</p></div></article>
            <article><i class="fa-solid fa-users"></i><div><strong>Visibilidade</strong><p>${recomendacaoInteracao}</p></div></article>
            <article><i class="fa-solid fa-arrow-trend-up"></i><div><strong>Indicador atual</strong><p>${publicacoes.length} publicações, ${totalCurtidas} curtidas recebidas e nível ${nivel}.</p></div></article>`;
        alternarModal("#modal-ia", true);
    });

    ["#fechar-ia", "#fechar-resultado"].forEach((seletor) => {
        selecionar(seletor)?.addEventListener("click", () => alternarModal("#modal-ia", false));
    });

    document.querySelectorAll(".modal").forEach((modal) => {
        modal.addEventListener("click", (evento) => {
            if (evento.target === modal) alternarModal(`#${modal.id}`, false);
        });
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            document.querySelectorAll(".modal.aberto").forEach((modal) => alternarModal(`#${modal.id}`, false));
        }
    });

    // Compartilhar
    selecionar("#compartilhar-perfil")?.addEventListener("click", async () => {
        const dados = {
            title: `Perfil de ${sessao.nome} | ConexãoPro`,
            text: `Conheça o perfil profissional de ${sessao.nome} no ConexãoPro.`,
            url: window.location.href
        };
        try {
            if (navigator.share) {
                await navigator.share(dados);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert("Link do perfil copiado!");
            }
        } catch {
            // O usuário pode cancelar o compartilhamento.
        }
    });

    // Sair
    selecionar("#sair")?.addEventListener("click", async () => {
        await apiSair();
        window.location.href = "index.html";
    });

    // ===== CONEXÕES: Adicionar seção de conexões no perfil =====
    await adicionarSecaoConexoes();
}

// ===== CONEXÕES NO PERFIL =====

async function adicionarSecaoConexoes() {
    // Adicionar seção de conexões na coluna lateral
    const colunaLateral = document.querySelector(".coluna-lateral");
    if (!colunaLateral) return;

    try {
        const dados = await apiListarConexoes();
        const conexoes = dados.aceitas || [];
        const pendentes = dados.pendentes || [];
        const enviadas = dados.enviadas || [];

        // Seção de Conexões
        const secaoConexoes = document.createElement("article");
        secaoConexoes.className = "card";
        secaoConexoes.innerHTML = `
            <header>
                <div>
                    <p class="eyebrow">Rede profissional</p>
                    <h2>Conexões (${conexoes.length})</h2>
                </div>
                <a href="conexoes.html">Gerenciar</a>
            </header>
            <div id="lista-conexoes-perfil">
                ${conexoes.length === 0 ? '<p style="font-size:0.82rem; color:#6b7294;">Você ainda não tem conexões. Encontre colegas na página de conexões.</p>' : ''}
            </div>
        `;
        colunaLateral.prepend(secaoConexoes);

        const listaConexoes = document.querySelector("#lista-conexoes-perfil");
        if (listaConexoes && conexoes.length > 0) {
            listaConexoes.innerHTML = conexoes.slice(0, 6).map(conn => {
                const inicial = conn.nome.charAt(0).toUpperCase();
                return `
                    <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(108,140,255,0.08);">
                        <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, #6c8cff, #4a6cf7); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:0.8rem; color:#fff; flex-shrink:0;">
                            ${inicial}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <strong style="font-size:0.82rem; color:#e0e4f0; display:block;">${conn.nome}</strong>
                            <small style="font-size:0.72rem; color:#6b7294;">${conn.curso || "Membro"}</small>
                        </div>
                        <a href="conexoes.html" style="font-size:0.7rem; color:#6c8cff;">Ver</a>
                    </div>
                `;
            }).join("");

            if (conexoes.length > 6) {
                listaConexoes.innerHTML += `
                    <a href="conexoes.html" style="display:block; margin-top:8px; font-size:0.78rem; color:#6c8cff; text-align:center; font-weight:500;">
                        +${conexoes.length - 6} outras conexões
                    </a>
                `;
            }
        }

        // Se houver solicitações pendentes, adicionar badge ou notificação
        if (pendentes.length > 0) {
            const headerConexoes = secaoConexoes.querySelector("header h2");
            if (headerConexoes) {
                headerConexoes.innerHTML = `Conexões (${conexoes.length}) <span style="background:#22C55E; color:#fff; font-size:0.65rem; padding:2px 8px; border-radius:10px; margin-left:6px;">${pendentes.length} nova${pendentes.length > 1 ? 's' : ''}</span>`;
            }
        }

    } catch (erro) {
        console.error("Erro ao carregar conexões no perfil:", erro);
    }
}
