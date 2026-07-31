// ===== ADMIN PAINEL =====
const ADMIN_TOKEN_KEY = "@senaiadmin:token";
const ADMIN_SESSAO_KEY = "@senaiadmin:sessao";

function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token) {
    if (token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
}

function getAdminSessao() {
    try {
        return JSON.parse(localStorage.getItem(ADMIN_SESSAO_KEY));
    } catch {
        return null;
    }
}

function setAdminSessao(usuario) {
    if (usuario) {
        localStorage.setItem(ADMIN_SESSAO_KEY, JSON.stringify(usuario));
    } else {
        localStorage.removeItem(ADMIN_SESSAO_KEY);
    }
}

async function adminFetch(caminho, opcoes = {}) {
    const token = getAdminToken();
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
    };

    const resposta = await fetch(`http://localhost:3000/api/admin${caminho}`, {
        ...opcoes,
        headers,
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(dados.erro || "Erro na requisição");
    }

    return dados;
}

async function adminLogin(matricula, senha) {
    const dados = await adminFetch("/login", {
        method: "POST",
        body: JSON.stringify({ matricula, senha }),
    });
    if (dados.token) {
        setAdminToken(dados.token);
        setAdminSessao(dados.usuario);
    }
    return dados;
}

function adminLogout() {
    setAdminToken(null);
    setAdminSessao(null);
    window.location.reload();
}

// ===== INTERFACE =====

function mostrarAviso(mensagem, tipo = "sucesso") {
    const aviso = document.getElementById("admin-toast");
    if (!aviso) return;
    aviso.textContent = mensagem;
    aviso.className = `admin-toast ${tipo}`;
    aviso.classList.add("visivel");
    clearTimeout(aviso._timer);
    aviso._timer = setTimeout(() => {
        aviso.classList.remove("visivel");
    }, 3000);
}

function toggleSecao(id) {
    document.querySelectorAll(".admin-secao").forEach((s) => s.classList.remove("ativa"));
    const secao = document.getElementById(id);
    if (secao) secao.classList.add("ativa");

    document.querySelectorAll(".admin-nav a").forEach((a) => a.classList.remove("ativo"));
    const link = document.querySelector(`.admin-nav a[data-secao="${id}"]`);
    if (link) link.classList.add("ativo");
}

// ===== DASHBOARD =====

async function carregarDashboard() {
    try {
        const stats = await adminFetch("/estatisticas");
        document.getElementById("stat-alunos").textContent = stats.totalAlunos;
        document.getElementById("stat-professores").textContent = stats.totalProfessores;
        document.getElementById("stat-total").textContent = stats.totalUsuarios;
        document.getElementById("stat-conexoes").textContent = stats.totalConexoes;
        document.getElementById("stat-pendentes").textContent = stats.totalPendentes;
    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    }
}

// ===== CRUD ALUNOS =====

let editandoId = null;

document.getElementById("form-aluno")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const dados = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("button[type='submit']");

    if (!dados.nome.trim() || !dados.matricula.trim() || !dados.senha) {
        mostrarAviso("Preencha todos os campos obrigatórios.", "erro");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Cadastrando...";

    try {
        await adminFetch("/usuarios", {
            method: "POST",
            body: JSON.stringify({
                nome: dados.nome.trim(),
                matricula: dados.matricula.trim(),
                curso: dados.curso || "",
                senha: dados.senha,
                tipo: "aluno",
            }),
        });
        mostrarAviso("Aluno cadastrado com sucesso!");
        form.reset();
        carregarTabelaUsuarios();
        carregarMatriculas();
        carregarDashboard();
    } catch (erro) {
        mostrarAviso(erro.message, "erro");
    } finally {
        btn.disabled = false;
        btn.textContent = "Cadastrar Aluno";
    }
});

document.getElementById("form-professor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const dados = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("button[type='submit']");

    if (!dados.nome.trim() || !dados.matricula.trim() || !dados.senha) {
        mostrarAviso("Preencha todos os campos obrigatórios.", "erro");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Cadastrando...";

    try {
        await adminFetch("/usuarios", {
            method: "POST",
            body: JSON.stringify({
                nome: dados.nome.trim(),
                matricula: dados.matricula.trim(),
                curso: dados.curso || "",
                senha: dados.senha,
                tipo: "professor",
            }),
        });
        mostrarAviso("Professor cadastrado com sucesso!");
        form.reset();
        carregarTabelaUsuarios();
        carregarMatriculas();
        carregarDashboard();
    } catch (erro) {
        mostrarAviso(erro.message, "erro");
    } finally {
        btn.disabled = false;
        btn.textContent = "Cadastrar Professor";
    }
});

// ===== TABELA DE USUÁRIOS =====

async function carregarTabelaUsuarios(filtro = "") {
    const tbody = document.querySelector("#tabela-usuarios tbody");
    if (!tbody) return;

    try {
        let url = "/usuarios";
        if (filtro) url += `?tipo=${filtro}`;
        const usuarios = await adminFetch(url);

        if (usuarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="vazio">Nenhum usuário cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = usuarios.map((u) => {
            const tipoLabel = u.tipo === "aluno" ? "Aluno" : "Professor";
            const tipoClass = u.tipo === "aluno" ? "tag-aluno" : "tag-professor";
            const data = new Date(u.criado_em + "Z").toLocaleDateString("pt-BR");
            return `
                <tr>
                    <td><strong>${escaparHTML(u.nome)}</strong></td>
                    <td>${escaparHTML(u.matricula)}</td>
                    <td>${escaparHTML(u.curso || "-")}</td>
                    <td><span class="tag-tipo ${tipoClass}">${tipoLabel}</span></td>
                    <td>${data}</td>
                    <td class="acoes">
                        <button class="btn-editar" onclick="editarUsuario(${u.id}, '${escaparHTML(u.nome)}', '${escaparHTML(u.matricula)}', '${escaparHTML(u.curso)}', '${u.tipo}')" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-excluir" onclick="excluirUsuario(${u.id})" title="Excluir"><i class="fa-regular fa-trash-can"></i></button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (erro) {
        tbody.innerHTML = `<tr><td colspan="6" class="vazio">Erro ao carregar: ${erro.message}</td></tr>`;
    }
}

document.querySelectorAll(".filtro-tabela").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filtro-tabela").forEach((b) => b.classList.remove("ativo"));
        btn.classList.add("ativo");
        carregarTabelaUsuarios(btn.dataset.filtro);
    });
});

// ===== EDITAR USUÁRIO =====

function editarUsuario(id, nome, matricula, curso, tipo) {
    editandoId = id;
    document.getElementById("edit-id").value = id;
    document.getElementById("edit-nome").value = nome;
    document.getElementById("edit-matricula").value = matricula;
    document.getElementById("edit-curso").value = curso;
    document.getElementById("edit-tipo").value = tipo;
    document.getElementById("edit-senha").value = "";

    document.getElementById("modal-editar").classList.add("aberto");
    document.getElementById("modal-editar").setAttribute("aria-hidden", "false");
}

document.getElementById("fechar-modal-editar")?.addEventListener("click", () => {
    document.getElementById("modal-editar").classList.remove("aberto");
    document.getElementById("modal-editar").setAttribute("aria-hidden", "true");
    editandoId = null;
});

document.getElementById("form-editar")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const dados = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("button[type='submit']");

    const body = {
        nome: dados.nome.trim(),
        matricula: dados.matricula.trim(),
        curso: dados.curso || "",
        tipo: dados.tipo,
    };
    if (dados.senha.trim()) body.senha = dados.senha.trim();

    btn.disabled = true;
    btn.textContent = "Salvando...";

    try {
        await adminFetch(`/usuarios/${dados.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
        });
        mostrarAviso("Usuário atualizado com sucesso!");
        document.getElementById("modal-editar").classList.remove("aberto");
        document.getElementById("modal-editar").setAttribute("aria-hidden", "true");
        editandoId = null;
        carregarTabelaUsuarios();
        carregarMatriculas();
    } catch (erro) {
        mostrarAviso(erro.message, "erro");
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar Alterações";
    }
});

// ===== EXCLUIR USUÁRIO =====

async function excluirUsuario(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
        await adminFetch(`/usuarios/${id}`, { method: "DELETE" });
        mostrarAviso("Usuário excluído com sucesso!");
        carregarTabelaUsuarios();
        carregarMatriculas();
        carregarDashboard();
    } catch (erro) {
        mostrarAviso(erro.message, "erro");
    }
}

// ===== MATRÍCULAS ATIVAS =====

async function carregarMatriculas() {
    const container = document.getElementById("lista-matriculas");
    if (!container) return;

    try {
        const matriculas = await adminFetch("/matriculas");

        if (matriculas.length === 0) {
            container.innerHTML = `<p class="vazio">Nenhuma matrícula cadastrada ainda.</p>`;
            return;
        }

        container.innerHTML = `
            <table class="admin-tabela">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Matrícula</th>
                        <th>Tipo</th>
                        <th>Curso</th>
                        <th>Senha</th>
                    </tr>
                </thead>
                <tbody>
                    ${matriculas.map((m) => `
                        <tr>
                            <td><strong>${escaparHTML(m.nome)}</strong></td>
                            <td><code>${escaparHTML(m.matricula)}</code></td>
                            <td><span class="tag-tipo ${m.tipo === 'aluno' ? 'tag-aluno' : 'tag-professor'}">${m.tipo === 'aluno' ? 'Aluno' : 'Professor'}</span></td>
                            <td>${escaparHTML(m.curso || "-")}</td>
                            <td><code>${escaparHTML(m.senha)}</code></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            <p class="aviso-matriculas">Use estas matrículas e senhas para testar o login no site.</p>
        `;
    } catch (erro) {
        container.innerHTML = `<p class="vazio">Erro ao carregar: ${erro.message}</p>`;
    }
}

// ===== LOGIN =====

document.getElementById("form-admin-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    const mensagem = document.getElementById("admin-login-msg");
    const btn = e.target.querySelector("button[type='submit']");

    if (!dados.matricula.trim() || !dados.senha) {
        mensagem.textContent = "Preencha todos os campos.";
        mensagem.style.color = "#fca5a5";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
        await adminLogin(dados.matricula.trim(), dados.senha);
        document.getElementById("admin-login").style.display = "none";
        document.getElementById("admin-painel").style.display = "block";
        inicializarPainel();
    } catch (erro) {
        mensagem.textContent = erro.message;
        mensagem.style.color = "#fca5a5";
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar no Painel";
    }
});

// ===== INICIALIZAR =====

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function inicializarPainel() {
    const sessao = getAdminSessao();
    if (sessao) {
        document.getElementById("admin-nome").textContent = sessao.nome;
    }

    // Logout
    document.getElementById("admin-sair")?.addEventListener("click", adminLogout);

    // Navegação
    document.querySelectorAll(".admin-nav a").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            toggleSecao(link.dataset.secao);
        });
    });

    // Carregar dados
    carregarDashboard();
    carregarTabelaUsuarios();
    carregarMatriculas();

    // Dashboard é padrão
    toggleSecao("secao-dashboard");
}

(function init() {
    const sessao = getAdminSessao();
    if (sessao && getAdminToken()) {
        document.getElementById("admin-login").style.display = "none";
        document.getElementById("admin-painel").style.display = "block";
        inicializarPainel();
    } else {
        document.getElementById("admin-login").style.display = "flex";
        document.getElementById("admin-painel").style.display = "none";
    }
})();
