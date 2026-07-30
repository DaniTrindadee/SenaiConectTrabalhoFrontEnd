const CHAVE_SESSAO = "@conexaopro:sessao";
const CHAVE_PUBLICACOES = "@conexaopro:publicacoes";
const CHAVE_PERFIL_BASE = "@conexaopro:perfil";
const CHAVE_PROGRESSO = "@conexaopro:progresso";

function lerJSON(chave, fallback) {
    try {
        const valor = JSON.parse(localStorage.getItem(chave));
        return valor ?? fallback;
    } catch {
        return fallback;
    }
}

const sessao = lerJSON(CHAVE_SESSAO, null);
if (!sessao) {
    window.location.replace("login.html");
}

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
const perfilSalvo = lerJSON(CHAVE_PERFIL, {});
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

function salvarPerfil(alteracao) {
    const atual = lerJSON(CHAVE_PERFIL, {});
    localStorage.setItem(CHAVE_PERFIL, JSON.stringify({ ...atual, ...alteracao }));
}

selecionar("#foto-perfil")?.addEventListener("change", (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        const foto = String(leitor.result);
        salvarPerfil({ foto });
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

selecionar("#editar-sobre")?.addEventListener("click", () => {
    selecionar("#campo-sobre").value = selecionar("#texto-sobre").textContent.trim();
    alternarModal("#modal-sobre", true);
});
selecionar("#fechar-sobre")?.addEventListener("click", () => alternarModal("#modal-sobre", false));
selecionar("#salvar-sobre")?.addEventListener("click", () => {
    const texto = selecionar("#campo-sobre").value.trim();
    if (!texto) return;
    selecionar("#texto-sobre").textContent = texto;
    salvarPerfil({ sobre: texto });
    alternarModal("#modal-sobre", false);
});

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

selecionar("#sair")?.addEventListener("click", () => {
    localStorage.removeItem(CHAVE_SESSAO);
    window.location.href = "index.html";
});
